import {
  Button,
  Classes,
  Dialog,
  InputGroup,
  Intent,
  Label,
  Spinner,
  SpinnerSize,
  Tooltip,
} from "@blueprintjs/core";
import React, { useMemo, useState } from "react";
import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import getGraph from "roamjs-components/util/getGraph";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { TreeNode, ViewType, PullBlock } from "roamjs-components/types";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import format from "date-fns/format";
import download from "downloadjs";
import JSZip from "jszip";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";

type ExportDialogType =
  typeof window.roamjs.extension.queryBuilder.ExportDialog;
type Props = Parameters<ExportDialogType>[0];

const viewTypeToPrefix = {
  bullet: "- ",
  document: "",
  numbered: "1. ",
};

const collectUids = (t: TreeNode): string[] => [
  t.uid,
  ...t.children.flatMap(collectUids),
];

const normalize = (t: string) => `${t.replace(/[<>:"/\\|?*[]]/g, "")}.md`;

const titleToFilename = (t: string) => {
  const name = normalize(t);
  return name.length > 64
    ? `${name.substring(0, 31)}...${name.slice(-30)}`
    : name;
};

const toMarkdown = ({
  c,
  i = 0,
  v = "bullet",
}: {
  c: TreeNode;
  i?: number;
  v?: ViewType;
}): string =>
  `${"".padStart(i * 4, " ")}${viewTypeToPrefix[v]}${
    c.heading ? `${"".padStart(c.heading, "#")} ` : ""
  }${c.text
    .replace(BLOCK_REF_REGEX, (_, blockUid) => {
      const reference = getTextByBlockUid(blockUid);
      return reference || blockUid;
    })
    .trim()}${(c.children || [])
    .filter((nested) => !!nested.text || !!nested.children?.length)
    .map(
      (nested) =>
        `\n\n${toMarkdown({ c: nested, i: i + 1, v: c.viewType || v })}`
    )
    .join("")}`;

export const ExportDialog: ExportDialogType = ({
  onClose,
  isOpen = true,
  exportTypes,
  results = [],
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState(
    `${getGraph()}_query-results_${format(new Date(), "yyyyMMddhhmm")}`
  );
  const [activeExportType, setActiveExportType] = useState<string>(
    exportTypes[0].name
  );
  const graphs = useMemo(
    () => window.roamjs.extension?.multiplayer?.getConnectedGraphs?.() || [],
    []
  );
  const [graph, setGraph] = useState<string>(graphs[0]);
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      canEscapeKeyClose
      canOutsideClickClose
      title={`Export Query Results`}
    >
      <div className={Classes.DIALOG_BODY}>
        <Label>
          Export Type
          <MenuItemSelect
            items={[
              ...exportTypes
                .map((e) => e.name)
                .filter((t) => graphs.length || t !== "graph"),
            ]}
            activeItem={activeExportType}
            onItemSelect={(et) => setActiveExportType(et)}
          />
        </Label>
        {activeExportType === "graph" && (
          <Label>
            Graph
            <MenuItemSelect
              items={graphs}
              activeItem={graph}
              onItemSelect={(et) => setGraph(et)}
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
        <span>Exporting {results.length} Results</span>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <span style={{ color: "darkred" }}>{error}</span>
          {loading && <Spinner size={SpinnerSize.SMALL} />}
          <Button
            text={"Export"}
            intent={Intent.PRIMARY}
            onClick={() => {
              setLoading(true);
              setError("");
              setTimeout(async () => {
                try {
                  const exportType = exportTypes.find(
                    (e) => e.name === activeExportType
                  );
                  if (exportType) {
                    const zip = new JSZip();
                    const files = await exportType.callback({
                      filename,
                      graph,
                    });
                    if (!files.length) {
                      onClose();
                    } else {
                      files.forEach(({ title, content }) =>
                        zip.file(title, content)
                      );
                      zip.generateAsync({ type: "blob" }).then((content) => {
                        download(content, `${filename}.zip`, "application/zip");
                        onClose();
                      });
                    }
                  }
                } catch (e) {
                  setError(e.message);
                  setLoading(false);
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

export const Export = ({
  results,
  exportTypes = [
    {
      name: "CSV",
      callback: async ({ filename }) => {
        const keys = Object.keys(results[0]).filter((u) => !/uid/i.test(u));
        const header = `${keys.join(",")}\n`;
        const data = results
          .map((r) =>
            keys
              .map((k) => r[k].toString())
              .map((v) => (v.includes(",") ? `"${v}"` : v))
          )
          .join("\n");
        return [
          {
            title: `${filename.replace(/\.csv/, "")}.csv`,
            content: `${header}${data}`,
          },
        ];
      },
    },
    {
      name: "Markdown",
      callback: async () =>
        results
          .map(({ uid, ...rest }) => {
            const v =
              ((
                window.roamAlphaAPI.data.fast.q(
                  `[:find ?b (pull ?b [:children/view-type]) :where [?b :block/uid "${uid}"]]`
                )[0]?.[0] as PullBlock
              )?.[":children/view-type"].slice(1) as ViewType) || "bullet";
            const treeNode = getFullTreeByParentUid(uid);

            const content = `---\nurl: ${getRoamUrl(uid)}\n${Object.keys(rest)
              .filter((k) => !/uid/i.test(k))
              .map(
                (k) => `${k}: ${rest[k].toString()}`
              )}---\n\n${treeNode.children
              .map((c) => toMarkdown({ c, v, i: 0 }))
              .join("\n")}\n`;
            return { title: rest.text, content };
          })
          .map(({ title, content }) => ({
            title: titleToFilename(title),
            content,
          })),
    },
  ],
}: Pick<Props, "exportTypes" | "results">) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Tooltip content={"Export Results"}>
        <Button icon={"export"} onClick={() => setIsOpen(true)} minimal />
      </Tooltip>
      <ExportDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        results={results}
        exportTypes={exportTypes}
      />
    </>
  );
};

export default Export;
