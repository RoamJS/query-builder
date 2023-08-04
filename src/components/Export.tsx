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
  parentUid: string;
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
  parentUid,
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
        <div className="flex justify-between items-center">
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
    <div className={Classes.DIALOG_FOOTER}>
      <div className={Classes.DIALOG_FOOTER_ACTIONS}>
        <Button text={"Cancel"} intent={Intent.NONE} onClick={onClose} />
        <Button
          text={"Send To Current Canvas"}
          intent={Intent.PRIMARY}
          onClick={() => {
            typeof results === "object"
              ? tempAddToCurrentCanvas(results)
              : null;
            setDialogOpen(false);
          }}
          style={{ minWidth: 64 }}
          disabled={loading}
        />
      </div>
    </div>
  );

  const tempAddToCurrentCanvas = (r: Result[]) => {
    r.map((r) => {
      document.dispatchEvent(
        new CustomEvent("roamjs:query-builder:action", {
          detail: {
            action: "canvas",
            uid: r.uid,
            val: r.text,
            queryUid: parentUid,
          },
        })
      );
    });
  };

  return (
    <>
      <Dialog
        isOpen={dialogOpen}
        canEscapeKeyClose={false}
        canOutsideClickClose={false}
        isCloseButtonShown={false}
        title={`Export Query Results`}
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
