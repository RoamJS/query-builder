import {
  Button,
  Classes,
  Dialog,
  Icon,
  InputGroup,
  Intent,
  Label,
  MenuItem,
  Spinner,
  SpinnerSize,
  Tooltip,
} from "@blueprintjs/core";
import React, { useState } from "react";
import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import type { TreeNode, ViewType, PullBlock } from "roamjs-components/types";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import { saveAs } from "file-saver";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import { ExportDialogComponent } from "roamjs-components/types/query-builder";

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

export const ExportDialog = ({
  children,
  onClose,
  isOpen = true,
  results = [],
  exportTypes = [
    {
      name: "CSV",
      callback: async ({ filename }) => {
        const resolvedResults = Array.isArray(results)
          ? results
          : await results();
        const keys = Object.keys(resolvedResults[0]).filter(
          (u) => !/uid/i.test(u)
        );
        const header = `${keys.join(",")}\n`;
        const data = resolvedResults
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
        (Array.isArray(results) ? results : await results())
          .map(({ uid, ...rest }) => {
            const v = (
              (
                window.roamAlphaAPI.data.fast.q(
                  `[:find (pull ?b [:children/view-type]) :where [?b :block/uid "${uid}"]]`
                )[0]?.[0] as PullBlock
              )?.[":children/view-type"] || ":bullet"
            ).slice(1) as ViewType;
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
}: React.PropsWithChildren<Parameters<ExportDialogComponent>[0]>) => {
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
  const [graph, setGraph] = useState<string>("");
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      canEscapeKeyClose
      canOutsideClickClose
      title={`Export Query Results`}
      autoFocus={false}
      enforceFocus={false}
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
        <span>
          Exporting{" "}
          {typeof results === "function" ? "unknown number of" : results.length}{" "}
          results
        </span>
        {children}
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
                    const zip = await window.RoamLazy.JSZip().then(
                      (j) => new j()
                    );
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
                        saveAs(content, `${filename}.zip`);
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

export default ExportDialog;
