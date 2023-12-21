import {
  Button,
  Checkbox,
  Classes,
  Dialog,
  InputGroup,
  Intent,
  Label,
  ProgressBar,
  Toaster,
  Toast,
  Tooltip,
  Tab,
  Tabs,
  RadioGroup,
  Radio,
  FormGroup,
} from "@blueprintjs/core";
import React, { useState, useEffect, useMemo } from "react";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import { saveAs } from "file-saver";
import { Result } from "roamjs-components/types/query-builder";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import getExportTypes, { updateExportProgress } from "../utils/getExportTypes";
import nanoid from "nanoid";
import apiPost from "roamjs-components/util/apiPost";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getExtensionAPI from "roamjs-components/util/extensionApiContext";
import getBlockProps from "../utils/getBlockProps";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import findDiscourseNode from "../utils/findDiscourseNode";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "../index";
import { createShapeId } from "@tldraw/tlschema";
import { defaultDiscourseNodeShapeProps } from "./TldrawCanvas";
import calcCanvasNodeSizeAndImg from "../utils/calcCanvasNodeSizeAndImg";

const ExportProgress = ({ id }: { id: string }) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const listener = ((e: CustomEvent) => {
      if (e.detail.id === id) setProgress(e.detail.progress);
    }) as EventListener;
    document.body.addEventListener("roamjs:export:progress", listener);
    return () =>
      document.body.removeEventListener("roamjs:export:progress", listener);
  }, [setProgress, id]);
  return (
    <Toaster position="bottom-right" maxToasts={1}>
      {progress ? (
        <Toast
          timeout={0}
          onDismiss={() => setProgress(0)}
          intent={Intent.PRIMARY}
          icon={"download"}
          message={
            <>
              <div>Exporting data...</div>
              <ProgressBar value={progress} intent={Intent.SUCCESS} />
              <span>{(progress * 100).toFixed(2)}%</span>
            </>
          }
        />
      ) : null}
    </Toaster>
  );
};

export type ExportDialogProps = {
  results?: Result[] | ((isSamePageEnabled: boolean) => Promise<Result[]>);
  title?: string;
};

type ExportDialogComponent = (
  props: RoamOverlayProps<ExportDialogProps>
) => JSX.Element;

const EXPORT_DESTINATIONS = [
  { id: "local", label: "Download Locally", active: true },
  { id: "app", label: "Store in Roam", active: false },
  { id: "samepage", label: "Store with SamePage", active: false },
];
const exportDestinationById = Object.fromEntries(
  EXPORT_DESTINATIONS.map((ed) => [ed.id, ed])
);

const ExportDialog: ExportDialogComponent = ({
  onClose,
  isOpen,
  results = [],
  title = "Share Data",
}) => {
  const exportId = useMemo(() => nanoid(), []);
  useEffect(() => {
    setDialogOpen(isOpen);
  }, [isOpen]);
  const [dialogOpen, setDialogOpen] = useState(isOpen);
  const exportTypes = useMemo(
    () => getExportTypes({ results, exportId }),
    [results, exportId]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const today = new Date();
  const [filename, setFilename] = useState(
    `${
      window.roamAlphaAPI.graph.name
    }_query-results_${`${today.getFullYear()}${(today.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}${today
      .getHours()
      .toString()
      .padStart(2, "0")}${today.getMinutes().toString().padStart(2, "0")}`}`
  );
  const [activeExportType, setActiveExportType] = useState<string>(
    exportTypes[0].name
  );
  const [activeExportDestination, setActiveExportDestination] =
    useState<string>(EXPORT_DESTINATIONS[0].id);
  const [isSamePageEnabled, setIsSamePageEnabled] = useState(false);

  const checkForCanvasPage = (title: string) => {
    const canvasPageFormat =
      (getExtensionAPI().settings.get("canvas-page-format") as string) ||
      DEFAULT_CANVAS_PAGE_FORMAT;
    return new RegExp(`^${canvasPageFormat}$`.replace(/\*/g, ".+")).test(title);
  };
  const currentPageUid = getCurrentPageUid();
  const currentPageTitle = getPageTitleByPageUid(currentPageUid);
  const [selectedPageTitle, setSelectedPageTitle] = useState(currentPageTitle);
  const [selectedPageUid, setSelectedPageUid] = useState(currentPageUid);
  const isCanvasPage = checkForCanvasPage(selectedPageTitle);
  const [isSendToGraph, setIsSendToGraph] = useState(false);
  const [livePages, setLivePages] = useState<Result[]>([]);
  const getDiscourseGraphSetting = () =>
    getExtensionAPI().settings.get("discourse-graphs");
  const [discourseGraphSetting, setDiscourseGraphSetting] = useState(
    getDiscourseGraphSetting()
  );
  const discourseGraphEnabled = useMemo(
    () => discourseGraphSetting,
    [discourseGraphSetting]
  );
  const [includeDiscourseContext, setIncludeDiscourseContext] = useState(
    discourseGraphSetting as boolean
  );
  const handleSetSelectedPage = (title: string) => {
    setSelectedPageTitle(title);
    setSelectedPageUid(getPageUidByPageTitle(title));
  };

  const addToSelectedCanvas = async () => {
    const props = getBlockProps(selectedPageUid) as Record<string, unknown>;
    const rjsqb = props["roamjs-query-builder"] as Record<string, unknown>;
    const tldraw = rjsqb["tldraw"] as Record<string, unknown>;

    const getPageKey = (obj: Record<string, unknown>): string | undefined => {
      for (const key in obj) {
        if (
          obj[key] &&
          typeof obj[key] === "object" &&
          (obj[key] as any)["typeName"] === "page"
        ) {
          return key;
        }
      }
    };

    const pageKey = getPageKey(tldraw);

    if (typeof results !== "object") return;
    for (const [i, r] of results.entries()) {
      const discourseNode = findDiscourseNode(r.uid);
      const nodeType = discourseNode ? discourseNode.type : "page-node";
      const extensionAPI = getExtensionAPI();
      const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
        text: r.text,
        uid: r.uid,
        nodeType,
        extensionAPI,
      });
      const newShapeId = createShapeId();
      const newShape = {
        rotation: 0,
        isLocked: false,
        type: nodeType,
        props: {
          opacity: defaultDiscourseNodeShapeProps.opacity,
          w,
          h,
          uid: r.uid,
          title: r.text,
          imageUrl,
        },
        parentId: pageKey,
        y: 50 + i * 100,
        id: newShapeId,
        typeName: "shape",
        x: 50 * i,
      };

      tldraw[newShapeId] = newShape;
    }

    const newStateId = nanoid();
    window.roamAlphaAPI.updateBlock({
      block: {
        uid: selectedPageUid,
        props: {
          ...props,
          ["roamjs-query-builder"]: {
            ...rjsqb,
            stateId: newStateId,
          },
        },
      },
    });
  };

  const addToSelectedPage = () => {
    if (typeof results === "object") {
      results.map((r) => {
        const isPage = !!getPageTitleByPageUid(r.uid);
        window.roamAlphaAPI.data.block.create({
          location: { "parent-uid": selectedPageUid, order: "last" },
          block: {
            string: isPage ? `[[${r.text}]]` : `((${r.uid}))`,
          },
        });
      });
    }
  };

  useEffect(() => {
    if (isSendToGraph) {
      if (typeof results === "object") {
        const livePages = results.filter((r) => !!getPageTitleByPageUid(r.uid));
        setLivePages(livePages);
      }
    }
  }, [isSendToGraph, results]);
  const addToGraphOverView = () => {
    if (typeof results === "object") {
      window.roamAlphaAPI.ui.graphView.wholeGraph.setMode("Explore");
      window.roamAlphaAPI.ui.graphView.wholeGraph.setExplorePages(
        livePages.map((r) => r.text)
      );
      window.location.href = `${getRoamUrl()}/graph`;
    }
  };

  const handleSendTo = () => {
    if (isSendToGraph) {
      addToGraphOverView();
    } else if (isCanvasPage) {
      addToSelectedCanvas();
    } else {
      addToSelectedPage();
    }
    onClose();
  };

  const ExportPanel = (
    <>
      <div className={Classes.DIALOG_BODY}>
        <div className="flex justify-between items-center gap-16">
          <Label className="flex-grow">
            Export Type
            <MenuItemSelect
              items={exportTypes.map((e) => e.name)}
              activeItem={activeExportType}
              onItemSelect={(et) => setActiveExportType(et)}
            />
          </Label>
          <Label className="flex-grow">
            Destination
            <MenuItemSelect
              items={EXPORT_DESTINATIONS.map((ed) => ed.id)}
              transformItem={(s) => exportDestinationById[s].label}
              activeItem={activeExportDestination}
              onItemSelect={(et) => setActiveExportDestination(et)}
            />
          </Label>
        </div>
        <Label>
          Filename
          <InputGroup
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
        </Label>
        <FormGroup
          className={discourseGraphEnabled ? "" : "hidden"}
          label="Include Discourse Context"
          inline
        >
          <Checkbox
            checked={includeDiscourseContext}
            onChange={(e) => {
              setIncludeDiscourseContext(
                (e.target as HTMLInputElement).checked
              );
              console.log(
                (e.target as HTMLInputElement).checked ? "true" : "false"
              );
            }}
          />
        </FormGroup>
        <div className="text-right">
          <span>
            {typeof results === "function"
              ? "Calculating number of results..."
              : `Exporting ${results.length} results`}
          </span>
          {window.samepage && (
            <Checkbox
              checked={isSamePageEnabled}
              onChange={(e) =>
                setIsSamePageEnabled((e.target as HTMLInputElement).checked)
              }
              style={{ marginBottom: 0 }}
              labelElement={
                <Tooltip
                  content={
                    "Use SamePage's backend to gather this export [EXPERIMENTAL]."
                  }
                >
                  <img
                    src="https://samepage.network/images/logo.png"
                    height={24}
                    width={24}
                  />
                </Tooltip>
              }
            />
          )}
        </div>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <span style={{ color: "darkred" }}>{error}</span>
          <Button text={"Cancel"} intent={Intent.NONE} onClick={onClose} />
          <Button
            text={"Export"}
            intent={Intent.PRIMARY}
            onClick={() => {
              if (!exportDestinationById[activeExportDestination].active) {
                setError(
                  `Export destination ${exportDestinationById[activeExportDestination].label} is not yet supported.`
                );
                return;
              }
              setLoading(true);
              updateExportProgress({ progress: 0, id: exportId });
              setError("");
              setTimeout(async () => {
                try {
                  const exportType = exportTypes.find(
                    (e) => e.name === activeExportType
                  );
                  if (exportType && window.RoamLazy) {
                    const zip = await window.RoamLazy.JSZip().then(
                      (j) => new j()
                    );
                    setDialogOpen(true);
                    setLoading(false);
                    updateExportProgress({
                      progress: 0.0001,
                      id: exportId,
                    });
                    const files = await exportType.callback({
                      filename,
                      isSamePageEnabled,
                      includeDiscourseContext,
                    });
                    if (!files.length) {
                      setDialogOpen(true);
                      setError("Failed to find any results to export.");
                    } else {
                      files.forEach(({ title, content }) =>
                        zip.file(title, content)
                      );
                      zip.generateAsync({ type: "blob" }).then((content) => {
                        saveAs(content, `${filename}.zip`);
                        onClose();
                      });
                    }
                  } else {
                    setError(`Unsupported export type: ${exportType}`);
                  }
                } catch (e) {
                  const error = e as Error;
                  apiPost({
                    domain: "https://api.samepage.network",
                    path: "errors",
                    data: {
                      method: "extension-error",
                      type: "RoamJS Export Dialog Failed",
                      data: {
                        activeExportType,
                        filename,
                        results:
                          typeof results === "function" ? "dynamic" : results,
                      },
                      message: error.message,
                      stack: error.stack,
                      version: process.env.VERSION,
                    },
                  }).catch(() => {});
                  setDialogOpen(true);
                  setError((e as Error).message);
                } finally {
                  updateExportProgress({ progress: 0, id: exportId });
                }
              }, 1);
            }}
            style={{ minWidth: 64 }}
            disabled={loading}
          />
        </div>
      </div>
    </>
  );

  const SendToPanel = (
    <>
      <div className={Classes.DIALOG_BODY}>
        <RadioGroup
          onChange={(e: React.FormEvent<HTMLInputElement>) =>
            setIsSendToGraph(isSendToGraph ? false : true)
          }
          selectedValue={isSendToGraph ? "graph" : "page"}
        >
          <Radio value="graph" label="Visualize in Graph Overview" />
          <Radio value="page" label="Send to Page" />
        </RadioGroup>
        {!isSendToGraph && (
          <div className="mb-2.5">
            <AutocompleteInput
              value={selectedPageTitle}
              setValue={(title) => handleSetSelectedPage(title)}
              onBlur={(title) => handleSetSelectedPage(title)}
              options={getAllPageNames()}
            />
          </div>
        )}
        {isSendToGraph && !livePages.length ? (
          <div className="my-2.5">No Pages found in Results</div>
        ) : null}
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button text={"Cancel"} intent={Intent.NONE} onClick={onClose} />
          <Button
            text={`Send ${
              isSendToGraph ? livePages.length : results.length
            } results`}
            intent={Intent.PRIMARY}
            onClick={handleSendTo}
            style={{ minWidth: 64 }}
            disabled={isSendToGraph ? !livePages.length : false}
          />
        </div>
      </div>
    </>
  );

  return (
    <>
      <Dialog
        isOpen={dialogOpen}
        canEscapeKeyClose={false}
        canOutsideClickClose={false}
        isCloseButtonShown={false}
        title={title}
        autoFocus={false}
        enforceFocus={false}
        portalClassName={"roamjs-export-dialog-body"}
      >
        <Tabs id="export-tabs" large={true}>
          <Tab id="sendto" title="Send To" panel={SendToPanel} />
          <Tab id="export" title="Export" panel={ExportPanel} />
        </Tabs>
      </Dialog>
      <ExportProgress id={exportId} />
    </>
  );
};

export const render = (props: ExportDialogProps) =>
  renderOverlay({ Overlay: ExportDialog, props });

export default ExportDialog;
