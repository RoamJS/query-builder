import {
  Button,
  Checkbox,
  Classes,
  Dialog,
  InputGroup,
  Intent,
  Label,
  ProgressBar,
  Tooltip,
} from "@blueprintjs/core";
import React, { useState, useEffect, useMemo } from "react";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import { saveAs } from "file-saver";
import { Result } from "roamjs-components/types/query-builder";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import getExportTypes from "../utils/getExportTypes";

export type ExportDialogProps = {
  results?: Result[] | ((isSamePageEnabled: boolean) => Promise<Result[]>);
};

type ExportDialogComponent = (
  props: RoamOverlayProps<ExportDialogProps>
) => JSX.Element;

const ExportDialog: ExportDialogComponent = ({
  onClose,
  isOpen = true,
  results = [],
}) => {
  const exportTypes = useMemo(() => getExportTypes({ results }), [results]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
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
  const [graph, setGraph] = useState<string>("");
  const [isSamePageEnabled, setIsSamePageEnabled] = useState(false);
  useEffect(() => {
    const body = document.querySelector(".roamjs-export-dialog-body");
    if (body) {
      const listener = ((e: CustomEvent) => {
        setLoadingProgress(e.detail.progress);
      }) as EventListener;
      body.addEventListener("roamjs:loading:progress", listener);
      return () =>
        body.removeEventListener("roamjs:loading:progress", listener);
    }
  }, [setLoadingProgress]);
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      canEscapeKeyClose
      canOutsideClickClose
      title={`Export Query Results`}
      autoFocus={false}
      enforceFocus={false}
      portalClassName={"roamjs-export-dialog-body"}
    >
      <div className={Classes.DIALOG_BODY}>
        <Label>
          Export Type
          <MenuItemSelect
            items={[
              ...exportTypes
                .map((e) => e.name)
                .filter(
                  (t) =>
                    window.roamjs.loaded.has("samepage") ||
                    window.roamjs.loaded.has("multiplayer") ||
                    t !== "graph"
                ),
            ]}
            activeItem={activeExportType}
            onItemSelect={(et) => setActiveExportType(et)}
          />
        </Label>
        {activeExportType === "graph" && (
          <Label>
            Graph
            <InputGroup
              value={graph}
              onChange={(et) => setGraph(et.target.value)}
            />
          </Label>
        )}
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
          {loading && <ProgressBar value={loadingProgress} />}
          <Button
            text={"Export"}
            intent={Intent.PRIMARY}
            onClick={() => {
              setLoading(true);
              setLoadingProgress(0);
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
                    const files = await exportType.callback({
                      filename,
                      graph,
                      isSamePageEnabled,
                    });
                    if (!files.length) {
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
                  }
                } catch (e) {
                  console.error(e);
                  setError((e as Error).message);
                } finally {
                  setLoading(false);
                  setLoadingProgress(0);
                }
              }, 1);
            }}
            style={{ minWidth: 64 }}
            disabled={loading}
          />
        </div>
      </div>
    </Dialog>
  );
};

export const render = (props: ExportDialogProps) =>
  renderOverlay({ Overlay: ExportDialog, props });

export default ExportDialog;
