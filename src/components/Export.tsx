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
import { MAX_WIDTH } from "./TldrawCanvas";
import calcCanvasNodeSizeAndImg from "../utils/calcCanvasNodeSizeAndImg";
import { Column } from "../utils/types";
import { render as renderToast } from "roamjs-components/components/Toast";
import { getNodeEnv } from "roamjs-components/util/env";
import apiGet from "roamjs-components/util/apiGet";

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
  columns?: Column[];
  isExportDiscourseGraph?: boolean;
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
  columns,
  title = "Share Data",
  isExportDiscourseGraph = false,
}) => {
  const exportId = useMemo(() => nanoid(), []);
  useEffect(() => {
    setDialogOpen(isOpen);
  }, [isOpen]);
  const [dialogOpen, setDialogOpen] = useState(isOpen);
  const exportTypes = useMemo(
    () => getExportTypes({ results, exportId, isExportDiscourseGraph }),
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
  const firstColumnKey = columns?.[0]?.key || "text";
  const currentPageUid = getCurrentPageUid();
  const currentPageTitle = getPageTitleByPageUid(currentPageUid);
  const [selectedPageTitle, setSelectedPageTitle] = useState(currentPageTitle);
  const [selectedPageUid, setSelectedPageUid] = useState(currentPageUid);
  const isCanvasPage = checkForCanvasPage(selectedPageTitle);
  const [isSendToGraph, setIsSendToGraph] = useState(false);
  const [livePages, setLivePages] = useState<Result[]>([]);
  const [selectedTabId, setSelectedTabId] = useState("sendto");
  useEffect(() => {
    if (isExportDiscourseGraph) setSelectedTabId("export");
  }, [isExportDiscourseGraph]);
  const [discourseGraphEnabled, setDiscourseGraphEnabled] = useState(() => {
    return getExtensionAPI().settings.get("discourse-graphs");
  });
  const [includeDiscourseContext, setIncludeDiscourseContext] = useState(
    discourseGraphEnabled as boolean
  );
  const handleSetSelectedPage = (title: string) => {
    setSelectedPageTitle(title);
    setSelectedPageUid(getPageUidByPageTitle(title));
  };

  const addToSelectedCanvas = async () => {
    if (typeof results !== "object") return;

    const PADDING_BETWEEN_SHAPES = 20;
    const COMMON_BOUNDS_XOFFSET = 250;
    const MAX_COLUMNS = 5;
    const COLUMN_WIDTH = Number(MAX_WIDTH.replace("px", ""));
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

    type TLdrawProps = {
      [key: string]: any;
    };
    type ShapeBounds = {
      x: number;
      y: number;
      w: number;
      h: number;
    };
    const extractShapesBounds = (tldraw: TLdrawProps): ShapeBounds[] => {
      return Object.keys(tldraw)
        .filter((key) => tldraw[key].typeName === "shape")
        .map((key) => {
          const shape = tldraw[key];
          return {
            x: shape.x,
            y: shape.y,
            w: shape.props.w,
            h: shape.props.h,
          };
        });
    };
    const shapeBounds = extractShapesBounds(tldraw);

    type CommonBounds = {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    const findCommonBounds = (shapes: ShapeBounds[]): CommonBounds => {
      if (!shapes.length) return { top: 0, right: 0, bottom: 0, left: 0 };

      let maxX = Number.MIN_SAFE_INTEGER;
      let maxY = Number.MIN_SAFE_INTEGER;
      let minX = Number.MAX_SAFE_INTEGER;
      let minY = Number.MAX_SAFE_INTEGER;

      shapes.forEach((shape) => {
        let rightX = shape.x + shape.w;
        let leftX = shape.x;
        let topY = shape.y;
        let bottomY = shape.y - shape.h;

        if (rightX > maxX) maxX = rightX;
        if (leftX < minX) minX = leftX;
        if (topY < minY) minY = topY;
        if (bottomY > maxY) maxY = bottomY;
      });

      return { top: minY, right: maxX, bottom: maxY, left: minX };
    };
    const commonBounds = findCommonBounds(shapeBounds);

    let currentRowHeight = 0;
    let nextShapeX = COMMON_BOUNDS_XOFFSET;
    let shapeY = commonBounds.top;
    for (const [i, r] of results.entries()) {
      const discourseNode = findDiscourseNode(r.uid);
      const nodeType = discourseNode ? discourseNode.type : "page-node";
      const extensionAPI = getExtensionAPI();
      const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
        nodeText: String(r[firstColumnKey]),
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
          w,
          h,
          uid: r.uid,
          title: r[firstColumnKey],
          imageUrl,
        },
        parentId: pageKey,
        y: shapeY,
        id: newShapeId,
        typeName: "shape",
        x: commonBounds.right + nextShapeX,
      };

      nextShapeX += COLUMN_WIDTH + PADDING_BETWEEN_SHAPES;
      if (h > currentRowHeight) currentRowHeight = h;
      if ((i + 1) % MAX_COLUMNS === 0) {
        shapeY += currentRowHeight + PADDING_BETWEEN_SHAPES;
        currentRowHeight = 0;
        nextShapeX = COMMON_BOUNDS_XOFFSET;
      }

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
            string: isPage ? `[[${r[firstColumnKey]}]]` : `((${r.uid}))`,
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
        livePages.map((r) => String(r[firstColumnKey]))
      );
      window.location.href = `${getRoamUrl()}/graph`;
    }
  };

  const handleSendTo = async () => {
    try {
      if (isSendToGraph) addToGraphOverView();
      else if (isCanvasPage) await addToSelectedCanvas();
      else addToSelectedPage();
      renderToast({
        content: "Results sent!",
        intent: "success",
        id: "query-builder-export-success",
      });
    } catch (e) {
      const error = e as Error;
      renderToast({
        content: "Looks like there was an error. The team has been notified.",
        intent: "danger",
        id: "query-builder-error",
      });
      apiPost({
        domain: "https://api.samepage.network",
        path: "errors",
        data: {
          method: "extension-error",
          type: "Query Builder Export Dialog Failed",
          message: error.message,
          stack: error.stack,
          version: process.env.VERSION,
          notebookUuid: JSON.stringify({
            owner: "RoamJS",
            app: "query-builder",
            workspace: window.roamAlphaAPI.graph.name,
          }),
        },
      }).catch(() => {});
    } finally {
      onClose();
    }
  };

  const handlePdfExport = async (
    files: {
      title: string;
      content: string;
    }[],
    filename: string
  ) => {
    const preparedFiles = files.map((f) => ({
      title: JSON.stringify(f.title),
      content: JSON.stringify(f.content),
    }));
    const domain =
      getNodeEnv() === "development"
        ? "http://localhost:3003"
        : "https://api.samepage.network";

    try {
      const response = await apiPost({
        domain,
        path: "pdf/query-builder",
        data: {
          files: preparedFiles,
          filename,
        },
      });
      const responseData = JSON.parse(response.data);
      const path = JSON.parse(responseData.body);
      const download = await apiGet<ArrayBuffer>({
        domain: "https://samepage.network",
        path,
        buffer: true,
      });

      if (download) {
        const blob = new Blob([download], { type: "application/zip" });
        saveAs(blob, `${filename}.zip`);
      }
      onClose();
    } catch (e) {
      setError("Failed to export files.");
    }
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

        <div className="flex justify-between items-end">
          <span>
            {typeof results === "function"
              ? "Calculating number of results..."
              : `Exporting ${results.length} results`}
          </span>
          <div className="flex flex-col items-end">
            <FormGroup
              className={`m-0 ${discourseGraphEnabled ? "" : "hidden"}`}
              inline
            >
              <Checkbox
                alignIndicator={"right"}
                checked={includeDiscourseContext}
                onChange={(e) => {
                  setIncludeDiscourseContext(
                    (e.target as HTMLInputElement).checked
                  );
                }}
                labelElement={
                  <Tooltip
                    className="m-0"
                    content={
                      "Include the Discourse Context of each result in the export."
                    }
                  >
                    <span>Discourse Context</span>
                  </Tooltip>
                }
              />
            </FormGroup>
            {window.samepage && (
              <FormGroup className="m-0 " inline>
                <Checkbox
                  alignIndicator={"right"}
                  checked={isSamePageEnabled}
                  onChange={(e) =>
                    setIsSamePageEnabled((e.target as HTMLInputElement).checked)
                  }
                  style={{ marginBottom: 0 }}
                  labelElement={
                    <Tooltip
                      className="m-0"
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
              </FormGroup>
            )}
          </div>
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
                      isExportDiscourseGraph,
                    });
                    if (!files.length) {
                      setDialogOpen(true);
                      setError("Failed to find any results to export.");
                      return;
                    }

                    if (activeExportType === "PDF") {
                      handlePdfExport(files, filename);
                      return;
                    }

                    files.forEach(({ title, content }) =>
                      zip.file(title, content)
                    );
                    zip.generateAsync({ type: "blob" }).then((content) => {
                      saveAs(content, `${filename}.zip`);
                      onClose();
                    });
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
                      type: "Query Builder Export Dialog Failed",
                      data: {
                        activeExportType,
                        filename,
                        results:
                          typeof results === "function" ? "dynamic" : results,
                      },
                      message: error.message,
                      stack: error.stack,
                      version: process.env.VERSION,
                      notebookUuid: JSON.stringify({
                        owner: "RoamJS",
                        app: "query-builder",
                        workspace: window.roamAlphaAPI.graph.name,
                      }),
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
        <Tabs
          id="export-tabs"
          large={true}
          selectedTabId={selectedTabId}
          onChange={(newTabId: string) => setSelectedTabId(newTabId)}
        >
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
