import createButtonObserver from "roamjs-components/dom/createButtonObserver";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getUidsFromId from "roamjs-components/dom/getUidsFromId";
import { renderQueryBuilder } from "./components/QueryBuilder";
import runExtension from "roamjs-components/util/runExtension";
import addStyle from "roamjs-components/dom/addStyle";
import getPageTitleValueByHtmlElement from "roamjs-components/dom/getPageTitleValueByHtmlElement";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import {
  render as renderQueryPage,
  renderQueryBlock,
} from "./components/QueryPage";
import runQueryTools from "./utils/runQueryTools";
import DefaultFilters from "./components/DefaultFilters";
import registerSmartBlocksCommand from "roamjs-components/util/registerSmartBlocksCommand";
import extractRef from "roamjs-components/util/extractRef";
import type { InputTextNode, PullBlock } from "roamjs-components/types/native";
import QueryPagesPanel, { getQueryPages } from "./components/QueryPagesPanel";
import runQuery from "./utils/runQuery";
import runSortReferences from "./utils/runSortReferences";
import updateBlock from "roamjs-components/writes/updateBlock";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import createBlock from "roamjs-components/writes/createBlock";
import initializeDiscourseGraphsMode, {
  renderDiscourseNodeTypeConfigPage,
  renderPlayground,
  SETTING,
} from "./discourseGraphsMode";
import getPageMetadata from "./utils/getPageMetadata";
import { render as queryRender } from "./components/QueryDrawer";
import createPage from "roamjs-components/writes/createPage";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import { renderTldrawCanvas } from "./components/tldraw/Tldraw";
import { QBGlobalRefs } from "./utils/types";
import localStorageSet from "roamjs-components/util/localStorageSet";
import localStorageGet from "roamjs-components/util/localStorageGet";
import localStorageRemove from "roamjs-components/util/localStorageRemove";
import { getNodeEnv } from "roamjs-components/util/env";
import createBlockObserver from "roamjs-components/dom/createBlockObserver";
import getUids from "roamjs-components/dom/getUids";
import { render as renderMessageBlock } from "./components/MessageBlock";
import getBlockProps, { json } from "./utils/getBlockProps";
import resolveQueryBuilderRef from "./utils/resolveQueryBuilderRef";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import { render as renderToast } from "roamjs-components/components/Toast";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import { openCanvasDrawer } from "./components/tldraw/CanvasDrawer";
import isDiscourseNode from "./utils/isDiscourseNode";
import fireQuery, {
  FireQueryArgs,
  fireQuerySync,
  getDatalogQuery,
} from "./utils/fireQuery";
import parseQuery from "./utils/parseQuery";
import { render as exportRender } from "./components/Export";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import {
  NodeMenuTriggerComponent,
  render as renderDiscourseNodeMenu,
} from "./components/DiscourseNodeMenu";
import { logTimestamp, renderQueryTester } from "./components/QueryTester";
import { queries } from "./utils/queryData";
import nanoid from "nanoid";
const loadedElsewhere = document.currentScript
  ? document.currentScript.getAttribute("data-source") === "discourse-graph"
  : false;

export const DEFAULT_CANVAS_PAGE_FORMAT = "Canvas/*";

export default runExtension(async (onloadArgs) => {
  const { extensionAPI } = onloadArgs;
  const style = addStyle(`.bp3-button:focus {
    outline-width: 2px;
}

.roamjs-item-dirty, 
.roamjs-item-dirty.bp3-menu-item .bp3-icon, 
.roamjs-item-dirty.bp3-button .bp3-icon {
  color: #a82a2a;
}

.roamjs-query-condition-type,
.roamjs-query-condition-source, 
.roamjs-query-condition-relation,
.roamjs-query-return-node {
  min-width: 144px;
  max-width: 144px;
}

.roamjs-query-condition-relation,
.roamjs-query-return-node,
.roamjs-query-condition-target {
  padding-right: 8px;
}

.roamjs-query-condition-target { 
  flex-grow: 1;
  min-width: 240px;
}

.roamjs-query-condition-relation .bp3-popover-target,
.roamjs-query-condition-target .roamjs-autocomplete-input-target { 
  width: 100%
}

.roamjs-query-hightlighted-result {
  background: #FFFF00;
}

.roamjs-query-embed .rm-block-separator {
  display: none;
}

.roamjs-query-embed span.bp3-popover-target {
  display: inline-block;
}

.roamjs-query-embed > .page-embed {
  margin-left: 24px;
}

/* width */
.roamjs-query-results-view ul::-webkit-scrollbar {
  width: 6px;
}

/* Handle */
.roamjs-query-results-view ul::-webkit-scrollbar-thumb {
  background: #888;
}

.roamjs-query-builder-parent .roamjs-edit-component {
  display: none;
}

.roamjs-query-results-view thead td .bp3-button,
.roamjs-query-results-view thead td .bp3-button svg,
.roamjs-query-results-view thead td .bp3-icon svg  {
  width: 12px;
  height: 12px;
  min-width: 12px;
  min-height: 12px;
}

.roamjs-query-results-view table.bp3-html-table td {
  padding: 8px;
}

.roamjs-view-select button {
  width: 100%;
  display: flex;
  justify-content: space-between;
}

.roamjs-view-select {
  flex: 1;
}

.roamjs-view-select > span {
  width: 100%;
}

svg.rs-svg-container {
  overflow: visible;
}

.roamjs-tldraw-node .rm-api-render--block .rm-block__controls,
.rs-shape .rm-api-render--block .rm-block__ref-count {
  display: none;
}


.roamjs-kanban-container .roamjs-kanban-column {
  width: inherit;
}

.roamjs-kanban-container .roamjs-kanban-column .rm-block-separator {
  display:none;
}
.roamjs-extra-row td {
  position: relative;
  background-color: #F5F8FA;
  padding: 16px;
  max-height: 240px;
  overflow-y: scroll;
}

.roamjs-export-dialog-body .bp3-tab-list {
  padding: 10px 20px;
  border-bottom: 1px solid rgba(16,22,26,0.15);
}

.roamjs-kanban-card .card-selections tr:first-child td {
  box-shadow: none;
}
.roamjs-query-results-view .roamjs-kanban-card .card-selections table.bp3-html-table td {
  padding: 0.50rem;
}
.roamjs-query-column-views .bp3-running-text table th,
.roamjs-query-column-views table.bp3-html-table th, 
.roamjs-query-column-views .bp3-running-text table td, 
.roamjs-query-column-views table.bp3-html-table td {
  vertical-align: initial;
}
`);
  const isCanvasPage = (title: string) => {
    const canvasPageFormat =
      (extensionAPI.settings.get("canvas-page-format") as string) ||
      DEFAULT_CANVAS_PAGE_FORMAT;
    return new RegExp(`^${canvasPageFormat}$`.replace(/\*/g, ".+")).test(title);
  };
  const h1ObserverCallback = (h1: HTMLHeadingElement) => {
    const title = getPageTitleValueByHtmlElement(h1);
    if (!!extensionAPI.settings.get("show-page-metadata")) {
      const { displayName, date } = getPageMetadata(title);
      const container = document.createElement("div");
      const oldMarginBottom = getComputedStyle(h1).marginBottom;
      container.style.marginTop = `${
        4 - Number(oldMarginBottom.replace("px", "")) / 2
      }px`;
      container.style.marginBottom = oldMarginBottom;
      const label = document.createElement("i");
      label.innerText = `Created by ${
        displayName || "Anonymous"
      } on ${date.toLocaleString()}`;
      container.appendChild(label);
      if (h1.parentElement) {
        if (h1.parentElement.lastChild === h1) {
          h1.parentElement.appendChild(container);
        } else {
          h1.parentElement.insertBefore(container, h1.nextSibling);
        }
      }
    }

    if (title.startsWith("discourse-graph/nodes/")) {
      renderDiscourseNodeTypeConfigPage({ title, h: h1, onloadArgs });
    } else if (
      getQueryPages(extensionAPI)
        .map(
          (t) =>
            new RegExp(`^${t.replace(/\*/g, ".*").replace(/([()])/g, "\\$1")}$`)
        )
        .some((r) => r.test(title))
    ) {
      const uid = getPageUidByPageTitle(title);
      const attribute = `data-roamjs-${uid}`;
      const containerParent = h1.parentElement?.parentElement;
      if (containerParent && !containerParent.hasAttribute(attribute)) {
        containerParent.setAttribute(attribute, "true");
        const parent = document.createElement("div");
        const configPageId = title.split("/").slice(-1)[0];
        parent.id = `${configPageId}-config`;
        containerParent.insertBefore(
          parent,
          h1.parentElement?.nextElementSibling || null
        );
        renderQueryPage({
          pageUid: uid,
          parent,
          onloadArgs,
        });
      }
    } else if (
      title.startsWith("Playground") &&
      !!h1.closest(".roam-article")
    ) {
      renderPlayground(title, globalRefs);
    } else if (isCanvasPage(title) && !!h1.closest(".roam-article")) {
      renderTldrawCanvas(title, onloadArgs);
    }
  };
  extensionAPI.settings.panel.create({
    tabTitle: "Query Builder",
    settings: [
      {
        id: "query-pages",
        name: "Query Pages",
        description:
          "The title formats of pages that you would like to serve as pages that generate queries",
        action: {
          type: "reactComponent",
          component: QueryPagesPanel(extensionAPI),
        },
      },
      {
        id: "hide-metadata",
        name: "Hide Query Metadata",
        description: "Hide the Roam blocks that are used to power each query",
        action: {
          type: "switch",
        },
      },
      {
        id: "default-filters",
        name: "Default Filters",
        description:
          "Any filters that should be applied to your results by default",
        action: {
          type: "reactComponent",
          component: DefaultFilters(extensionAPI),
        },
      },
      {
        id: "default-page-size",
        name: "Default Page Size",
        description: "The default page size used for query results",
        action: {
          type: "input",
          placeholder: "10",
        },
      },
      {
        id: "sort-blocks",
        name: "Sort Blocks",
        action: { type: "switch" },
        description:
          "Whether to sort the blocks within the pages returned by native roam queries instead of the pages themselves.",
      },
      {
        id: "context",
        name: "Context",
        action: { type: "input", placeholder: "1" },
        description:
          "How many levels of context to include with each query result for all queries by default",
      },
      {
        id: "default-sort",
        action: {
          type: "select",
          items: [
            "Alphabetically",
            "Alphabetically Descending",
            "Word Count",
            "Word Count Descending",
            "Created Date",
            "Created Date Descending",
            "Edited Date",
            "Edited Date Descending",
            "Daily Note",
            "Daily Note Descending",
          ],
        },
        name: "Default Sort",
        description:
          "The default sorting all native queries in your graph should use",
      },
      {
        id: "sort-references",
        name: "Sortable Linked References",
        action: {
          type: "switch",
          onChange: (e) => toggleSortReferences(e.target.checked),
        },
        description:
          "Whether or not to enable sorting on the linked references section",
      },
      {
        id: "show-page-metadata",
        name: "Show Page Metadata",
        description:
          "Show page metadata below each page title, such as the author and when it was created.",
        action: {
          type: "switch",
        },
      },
      {
        id: "canvas-page-format",
        name: "Canvas Page Format",
        description: "The page format for canvas pages",
        action: {
          type: "input",
          placeholder: DEFAULT_CANVAS_PAGE_FORMAT,
        },
      },
      {
        id: SETTING,
        name: "Discourse Graphs Enabled",
        description:
          "Includes the ability to construct higher level discourse graph nodes and relations for higher order reasoning.",
        action: {
          type: "switch",
          onChange: (e) => {
            const flag = e.target.checked;
            toggleDiscourseGraphsMode(flag).then(() => {
              if (flag) {
                document
                  .querySelectorAll<HTMLHeadingElement>(`h1.rm-title-display`)
                  .forEach(h1ObserverCallback);
              }
              if (getNodeEnv() === "development") {
                if (flag) {
                  localStorageSet(SETTING, "true");
                } else {
                  localStorageRemove(SETTING);
                }
              }
            });
          },
        },
      },
      {
        id: "discourse-node-menu-trigger",
        name: "Personal Node Menu Trigger",
        action: {
          type: "reactComponent",
          component: () => NodeMenuTriggerComponent(extensionAPI),
        },

        description:
          "Override the global trigger for the Discourse Node Menu. Must refresh after editing.",
      },
    ],
  });
  if (loadedElsewhere) {
    await extensionAPI.settings.set(SETTING, true);
    setTimeout(() => {
      toggleDiscourseGraphsMode(true).then(() =>
        document
          .querySelectorAll<HTMLHeadingElement>(`h1.rm-title-display`)
          .forEach(h1ObserverCallback)
      );
    }, 1000);
  }
  const toggleDiscourseGraphsMode =
    await initializeDiscourseGraphsMode(onloadArgs);
  if (getNodeEnv() === "development" && localStorageGet(SETTING)) {
    extensionAPI.settings.set(SETTING, true);
    toggleDiscourseGraphsMode(true);
  }

  const toggleSortReferences = runSortReferences();
  if (!!extensionAPI.settings.get("sort-references")) {
    toggleSortReferences(true);
  }

  const globalRefs: QBGlobalRefs = {
    clearOnClick: ({ parentUid, text }) => {
      const order = getChildrenLengthByPageUid(parentUid);
      createBlock({ parentUid, node: { text }, order });
    },
  };

  const clearOnClick = async (tag: string) => {
    const uid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"] || "";
    const text = `[[${tag}]]`;
    if (uid) {
      const currentText = getTextByBlockUid(uid);
      updateBlock({
        text: `${currentText} ${text}`,
        uid,
      });
    } else {
      const parentUid = await window.roamAlphaAPI.ui.mainWindow
        .getOpenPageOrBlockUid()
        .then(
          (uid) => uid || window.roamAlphaAPI.util.dateToPageTitle(new Date())
        );
      globalRefs.clearOnClick({ parentUid, text });
    }
  };

  const h1Observer = createHTMLObserver({
    tag: "H1",
    className: "rm-title-display",
    callback: (e) => h1ObserverCallback(e as HTMLHeadingElement),
  });

  const queryBlockObserver = createButtonObserver({
    attribute: "query-block",
    render: (b) => renderQueryBlock(b, onloadArgs),
  });

  const originalQueryBuilderObserver = createButtonObserver({
    shortcut: "qb",
    attribute: "query-builder",
    render: (b: HTMLButtonElement) => {
      const blockId = b.closest<HTMLDivElement>(".roam-block")?.id;
      const parent = b.parentElement;
      if (blockId && parent) {
        renderQueryBuilder({
          blockId,
          parent,
        });
      }
    },
  });

  const dataAttribute = "data-roamjs-edit-query";
  const editQueryBuilderObserver = createHTMLObserver({
    callback: (b) => {
      if (!b.getAttribute(dataAttribute)) {
        b.setAttribute(dataAttribute, "true");
        const editButtonRoot = document.createElement("div");
        b.appendChild(editButtonRoot);
        const blockId = b.closest(".roam-block")?.id;
        const initialValue = getTextByBlockUid(getUidsFromId(blockId).blockUid);
        if (blockId) {
          renderQueryBuilder({
            blockId,
            parent: editButtonRoot,
            initialValue,
          });
          const editButton = document.getElementById(
            `roamjs-query-builder-button-${blockId}`
          );
          if (editButton)
            editButton.addEventListener("mousedown", (e) =>
              e.stopPropagation()
            );
        }
      }
    },
    tag: "DIV",
    className: "rm-query-title",
  });

  const qtObserver = runQueryTools(extensionAPI);

  registerSmartBlocksCommand({
    text: "QUERYBUILDER",
    delayArgs: true,
    help: "Run an existing query block and output the results.\n\n1. The reference to the query block\n2. The format to output each result\n3. (Optional) The number of results returned",
    handler: ({ proccessBlockText, variables, processBlock }) =>
      function runQueryBuilderCommand(arg, ...args) {
        const inputArgs = args.filter((a) => a.includes("="));
        const regularArgs = args.filter((a) => !a.includes("="));
        const lastArg = regularArgs[regularArgs.length - 1];
        const lastArgIsLimitArg = !Number.isNaN(Number(lastArg));
        const { format: formatArg, limit } = lastArgIsLimitArg
          ? {
              format: regularArgs.slice(0, -1).join(","),
              limit: Number(lastArg),
            }
          : { format: regularArgs.join(","), limit: 0 };
        const formatArgAsUid = extractRef(formatArg);
        const format = isLiveBlock(formatArgAsUid)
          ? {
              text: getTextByBlockUid(formatArgAsUid),
              children: getBasicTreeByParentUid(formatArgAsUid),
              uid: formatArgAsUid,
            }
          : { text: formatArg, children: [], uid: "" };
        const queryRef = variables[arg] || arg;
        const parentUid = resolveQueryBuilderRef({ queryRef, extensionAPI });
        return runQuery({
          parentUid,
          extensionAPI,
          inputs: Object.fromEntries(
            inputArgs
              .map((i) => i.split("=").slice(0, 2) as [string, string])
              .map(([k, v]) => [k, variables[v] || v])
          ),
        }).then(({ allProcessedResults }) => {
          const results = limit
            ? allProcessedResults.slice(0, limit)
            : allProcessedResults;
          return results
            .map((r) =>
              Object.fromEntries(
                Object.entries(r).map(([k, v]) => [
                  k.toLowerCase(),
                  typeof v === "string"
                    ? v
                    : typeof v === "number"
                      ? v.toString()
                      : v instanceof Date
                        ? window.roamAlphaAPI.util.dateToPageTitle(v)
                        : "",
                ])
              )
            )
            .flatMap((r) => {
              if (processBlock && format.uid) {
                const blockFormatter = (node: InputTextNode) => () => {
                  Object.entries(r).forEach(([k, v]) => {
                    variables[k] = v;
                  });
                  return processBlock(node);
                };
                return format.text
                  ? blockFormatter(format)
                  : format.children.map(blockFormatter);
              }

              const s = format.text.replace(
                /{([^}]+)}/g,
                (_, i: string) => r[i.toLowerCase()]
              );
              return [() => proccessBlockText(s)];
            })
            .reduce(
              (prev, cur) => prev.then((p) => cur().then((c) => p.concat(c))),
              Promise.resolve([] as InputTextNode[])
            );
        });
      },
  });

  // @ts-ignore
  window.roamjs.extension.queryBuilder = {
    runQuery: (parentUid: string) =>
      runQuery({ parentUid, extensionAPI }).then(
        ({ allProcessedResults }) => allProcessedResults
      ),
    runQuerySync: (parentUid: string) => {
      const queryArgs = parseQuery(parentUid);
      return fireQuerySync(queryArgs);
    },
    listActiveQueries: () =>
      (
        window.roamAlphaAPI.data.fast.q(
          `[:find (pull ?b [:block/uid]) :where [or-join [?b] 
                 [and [?b :block/string ?s] [[clojure.string/includes? ?s "{{query block}}"]] ]
                 ${getQueryPages(extensionAPI).map(
                   (p) =>
                     `[and [?b :node/title ?t] [[re-pattern "^${p.replace(
                       /\*/,
                       ".*"
                     )}$"] ?regex] [[re-find ?regex ?t]]]`
                 )}
            ]]`
        ) as [PullBlock][]
      ).map((b) => ({ uid: b[0][":block/uid"] || "" })),
    isDiscourseNode: isDiscourseNode,
  };

  extensionAPI.ui.commandPalette.addCommand({
    label: "Open Canvas Drawer",
    callback: openCanvasDrawer,
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "getDatalogQuery",
    callback: () => {
      const _args: FireQueryArgs = {
        customNode: "",
        definedSelections: [],
        isCustomEnabled: false,
        returnNode: "Evidence",
        conditions: [
          {
            source: "Evidence",
            relation: "Consistent With",
            target: "2yEG0_6MI",
            uid: "UyEG8O76I",
            type: "clause",
          },
        ],
        selections: [
          {
            uid: "yshtDCXmF",
            label: "context",
            text: "node:UyEG8O76I-Context",
          },
        ],
        isSamePageEnabled: false,
        context: {
          relationsInQuery: [
            {
              id: "fpwvws-ic",
              text: "Consistent With",
              target: "85wgkuO31",
              isComplement: true,
            },
          ],
          customNodes: [
            {
              format: "[[EXP]] - {content}",
              text: "Experiment",
              shortcut: "X",
              type: "DoIcrR_MO",
              specification: [],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: false,
            },
            {
              format: "[[RES]] - {content} - {Experiment}",
              text: "Result",
              shortcut: "R",
              type: "q3B9CaO6Q",
              specification: [],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: false,
            },
            {
              format: "[[THE]] - {content}",
              text: "Theory",
              shortcut: "T",
              type: "84l8tEeA2",
              specification: [],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: false,
            },
            {
              format: "[[ISS]] - {content}",
              text: "Issue",
              shortcut: "I",
              type: "8tpfgIm5Z",
              specification: [],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: false,
            },
            {
              format: "[[ART]] - {content}",
              text: "Artifact",
              shortcut: "A",
              type: "S276jHf0s",
              specification: [],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: false,
            },
            {
              format: "[[CLM]] - {content}",
              text: "Claim",
              shortcut: "C",
              type: "sys03tzKR",
              specification: [],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: true,
            },
            {
              format: "[[R-N]] - {content}",
              text: "R-Note",
              shortcut: "R",
              type: "PYci7eFJP",
              specification: [
                {
                  uid: "PpR0iQyUo",
                  source: "R-Note",
                  target: "R-Note",
                  relation: "references title",
                  type: "clause",
                  not: false,
                },
              ],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: false,
            },
            {
              format: "[[MTD]] - {content}",
              text: "Method",
              shortcut: "M",
              type: "HdsmkNfKE",
              specification: [],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: false,
            },
            {
              format: "@{content}",
              text: "Source",
              shortcut: "S",
              type: "OZhxQs38_",
              specification: [],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: false,
            },
            {
              format: "[[PTN]] - {content}",
              text: "Pattern",
              shortcut: "P",
              type: "ceW_PoMVt",
              specification: [],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: false,
            },
            {
              format: "[[B]] - {content}",
              text: "B",
              shortcut: "B",
              type: "YjF0S0tKS",
              specification: [],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: false,
            },
            {
              format: "[[A]] - {content}",
              text: "A",
              shortcut: "A",
              type: "B676vtaon",
              specification: [],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: false,
            },
            {
              format: "[[EVD]] - {content} - {Source}",
              text: "Evidence",
              shortcut: "E",
              type: "85wgkuO31",
              specification: [],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: false,
            },
            {
              format: "[[QUE]] - {content}",
              text: "Question",
              shortcut: "Q",
              type: "CK3kwflMN",
              specification: [],
              backedBy: "user",
              canvasSettings: {},
              graphOverview: false,
            },
            {
              text: "Page",
              type: "page-node",
              shortcut: "p",
              format: "{content}",
              specification: [
                {
                  type: "clause",
                  source: "Page",
                  relation: "has title",
                  target: "/^(.*)$/",
                  uid: "aln15HgZG",
                },
              ],
              canvasSettings: {
                color: "#000000",
              },
              backedBy: "default",
            },
            {
              text: "Block",
              type: "blck-node",
              shortcut: "b",
              format: "{content}",
              specification: [
                {
                  type: "clause",
                  source: "Block",
                  relation: "is in page",
                  target: "_",
                  uid: "U0dpStPzk",
                },
              ],
              canvasSettings: {
                color: "#505050",
              },
              backedBy: "default",
            },
          ],
          customRelations: [
            {
              id: "DXvDSKe94",
              label: "Informs",
              source: "85wgkuO31",
              destination: "CK3kwflMN",
              complement: "Informed By",
              query:
                '[:find\r\n  (pull ?Question [:block/string :node/title :block/uid])\r\n  (pull ?Question [:block/uid])\r\n:where\r\n  (or-join [?9zmVOCQFE-QUE-.*?$-regex ?9zmVOCQFE-Question-uid ?Question ?9zmVOCQFE-{{placeholder}}-uid ?{{placeholder}}]\r\n    (and\r\n      [?9zmVOCQFE-Page :block/uid "{{placeholder}}"]\r\n      [?9zmVOCQFE-Page :block/uid ?9zmVOCQFE-{{placeholder}}-uid]\r\n      [?{{placeholder}} :block/uid ?9zmVOCQFE-{{placeholder}}-uid]\r\n      [?9zmVOCQFE-Block :block/refs ?9zmVOCQFE-Page]\r\n      [?9zmVOCQFE-Block :block/page ?9zmVOCQFE-ParentPage]\r\n      [?9zmVOCQFE-ParentPage :node/title ?9zmVOCQFE-ParentPage-Title]\r\n      [?9zmVOCQFE-ParentPage :block/uid ?9zmVOCQFE-Question-uid]\r\n      [?Question :block/uid ?9zmVOCQFE-Question-uid]\r\n      [(re-pattern "^\\\\[\\\\[QUE\\\\]\\\\] - (.*?)$") ?9zmVOCQFE-QUE-.*?$-regex]\r\n      [(re-find ?9zmVOCQFE-QUE-.*?$-regex ?9zmVOCQFE-ParentPage-Title)]\r\n    )\r\n    (and\r\n      [?9zmVOCQFE-SrcPage :block/uid "{{placeholder}}"]\r\n      [?9zmVOCQFE-LinkPage :node/title "Informs"]\r\n      [?9zmVOCQFE-SrcPage :block/uid ?9zmVOCQFE-{{placeholder}}-uid]\r\n      [?{{placeholder}} :block/uid ?9zmVOCQFE-{{placeholder}}-uid]\r\n      [?9zmVOCQFE-SrcBlock :block/refs ?9zmVOCQFE-SrcPage]\r\n      [?9zmVOCQFE-SrcBlock :block/refs ?9zmVOCQFE-LinkPage]\r\n      [?9zmVOCQFE-SrcBlock :block/parents ?9zmVOCQFE-DstBlock]\r\n      [?9zmVOCQFE-DstBlock :block/refs ?9zmVOCQFE-DstPage]\r\n      [?9zmVOCQFE-DstPage :node/title ?9zmVOCQFE-DstPage-Title]\r\n      [?9zmVOCQFE-DstPage :block/uid ?9zmVOCQFE-Question-uid]\r\n      [?Question :block/uid ?9zmVOCQFE-Question-uid]\r\n      [(re-pattern "^\\\\[\\\\[QUE\\\\]\\\\] - (.*?)$") ?9zmVOCQFE-QUE-.*?$-regex]\r\n      [(re-find ?9zmVOCQFE-QUE-.*?$-regex ?9zmVOCQFE-DstPage-Title)]\r\n    ))\r\n]',
              complementQuery: "",
              triples: [
                ["Page", "is a", "source"],
                ["Block", "references", "Page"],
                ["Block", "is in page", "ParentPage"],
                ["ParentPage", "is a", "destination"],
              ],
            },
            {
              id: "DXvDSKe94",
              label: "Informs",
              source: "85wgkuO31",
              destination: "CK3kwflMN",
              complement: "Informed By",
              query:
                '[:find\r\n  (pull ?Question [:block/string :node/title :block/uid])\r\n  (pull ?Question [:block/uid])\r\n:where\r\n  (or-join [?9zmVOCQFE-QUE-.*?$-regex ?9zmVOCQFE-Question-uid ?Question ?9zmVOCQFE-{{placeholder}}-uid ?{{placeholder}}]\r\n    (and\r\n      [?9zmVOCQFE-Page :block/uid "{{placeholder}}"]\r\n      [?9zmVOCQFE-Page :block/uid ?9zmVOCQFE-{{placeholder}}-uid]\r\n      [?{{placeholder}} :block/uid ?9zmVOCQFE-{{placeholder}}-uid]\r\n      [?9zmVOCQFE-Block :block/refs ?9zmVOCQFE-Page]\r\n      [?9zmVOCQFE-Block :block/page ?9zmVOCQFE-ParentPage]\r\n      [?9zmVOCQFE-ParentPage :node/title ?9zmVOCQFE-ParentPage-Title]\r\n      [?9zmVOCQFE-ParentPage :block/uid ?9zmVOCQFE-Question-uid]\r\n      [?Question :block/uid ?9zmVOCQFE-Question-uid]\r\n      [(re-pattern "^\\\\[\\\\[QUE\\\\]\\\\] - (.*?)$") ?9zmVOCQFE-QUE-.*?$-regex]\r\n      [(re-find ?9zmVOCQFE-QUE-.*?$-regex ?9zmVOCQFE-ParentPage-Title)]\r\n    )\r\n    (and\r\n      [?9zmVOCQFE-SrcPage :block/uid "{{placeholder}}"]\r\n      [?9zmVOCQFE-LinkPage :node/title "Informs"]\r\n      [?9zmVOCQFE-SrcPage :block/uid ?9zmVOCQFE-{{placeholder}}-uid]\r\n      [?{{placeholder}} :block/uid ?9zmVOCQFE-{{placeholder}}-uid]\r\n      [?9zmVOCQFE-SrcBlock :block/refs ?9zmVOCQFE-SrcPage]\r\n      [?9zmVOCQFE-SrcBlock :block/refs ?9zmVOCQFE-LinkPage]\r\n      [?9zmVOCQFE-SrcBlock :block/parents ?9zmVOCQFE-DstBlock]\r\n      [?9zmVOCQFE-DstBlock :block/refs ?9zmVOCQFE-DstPage]\r\n      [?9zmVOCQFE-DstPage :node/title ?9zmVOCQFE-DstPage-Title]\r\n      [?9zmVOCQFE-DstPage :block/uid ?9zmVOCQFE-Question-uid]\r\n      [?Question :block/uid ?9zmVOCQFE-Question-uid]\r\n      [(re-pattern "^\\\\[\\\\[QUE\\\\]\\\\] - (.*?)$") ?9zmVOCQFE-QUE-.*?$-regex]\r\n      [(re-find ?9zmVOCQFE-QUE-.*?$-regex ?9zmVOCQFE-DstPage-Title)]\r\n    ))\r\n]',
              complementQuery: "",
              triples: [
                ["DstPage", "is a", "destination"],
                ["SrcPage", "is a", "source"],
                ["SrcBlock", "references", "SrcPage"],
                ["DstBlock", "references", "DstPage"],
                ["LinkPage", "has title", "Informs"],
                ["SrcBlock", "references", "LinkPage"],
                ["DstBlock", "has descendant", "SrcBlock"],
              ],
            },
            {
              id: "Fd4HnEX0p",
              label: "Supports",
              source: "85wgkuO31",
              destination: "sys03tzKR",
              complement: "Supported By",
              query: "",
              complementQuery: "",
              triples: [
                ["Page", "is a", "source"],
                ["Block", "references", "Page"],
                ["Context", "references", "SPage"],
                ["SPage", "has title", "SupportedBy"],
                ["Context", "has child", "Block"],
                ["PBlock", "references", "ParentPage"],
                ["PBlock", "has child", "Context"],
                ["ParentPage", "is a", "destination"],
              ],
            },
            {
              id: "Fd4HnEX0p",
              label: "Supports",
              source: "85wgkuO31",
              destination: "sys03tzKR",
              complement: "Supported By",
              query: "",
              complementQuery: "",
              triples: [
                ["Context", "references", "SPage"],
                ["Page", "is a", "source"],
                ["Context", "references", "Page"],
                ["Context", "is in page", "ParentPage"],
                ["ParentPage", "is a", "destination"],
                ["SPage", "has title", "SupportedBy"],
              ],
            },
            {
              id: "Fd4HnEX0p",
              label: "Supports",
              source: "85wgkuO31",
              destination: "sys03tzKR",
              complement: "Supported By",
              query: "",
              complementQuery: "",
              triples: [
                ["Context", "references", "CPage"],
                ["Context", "references", "EPage"],
                ["Context", "references", "SPage"],
                ["CPage", "is a", "destination"],
                ["EPage", "is a", "source"],
                ["SPage", "has title", "SupportedBy"],
              ],
            },
            {
              id: "Fd4HnEX0p",
              label: "Supports",
              source: "85wgkuO31",
              destination: "sys03tzKR",
              complement: "Supported By",
              query: "",
              complementQuery: "",
              triples: [
                ["DstPage", "is a", "destination"],
                ["DstBlock", "references", "DstPage"],
                ["RelPage", "has title", "SupportedBy"],
                ["SrcPage", "is a", "source"],
                ["Context", "references", "SrcPage"],
                ["Context", "references", "RelPage"],
                ["DstBlock", "has child", "Context"],
              ],
            },
            {
              id: "Fd4HnEX0p",
              label: "Supports",
              source: "85wgkuO31",
              destination: "sys03tzKR",
              complement: "Supported By",
              query: "",
              complementQuery: "",
              triples: [
                ["Page", "is a", "source"],
                ["Block", "references", "Page"],
                ["Context", "has child", "Block"],
                ["ParentPage", "is a", "destination"],
                ["SPage", "has title", "SupportedBy"],
                ["Context", "is in page", "ParentPage"],
                ["Context", "references", "SPage"],
              ],
            },
            {
              id: "Fd4HnEX0p",
              label: "Supports",
              source: "85wgkuO31",
              destination: "sys03tzKR",
              complement: "Supported By",
              query: "",
              complementQuery: "",
              triples: [
                ["Block29", "is a", "source"],
                ["Block30", "is a", "destination"],
                ["Context", "references", "Block30"],
                ["Block32", "has descendant", "Context"],
                ["Block33", "has title", "Supports"],
                ["Context", "references", "Block33"],
                ["Block32", "references", "Block29"],
              ],
            },
            {
              id: "M_0CySPtb",
              label: "Opposes",
              source: "85wgkuO31",
              destination: "sys03tzKR",
              complement: "Opposed By",
              query: "",
              complementQuery: "",
              triples: [
                ["Page", "is a", "source"],
                ["Block", "references", "Page"],
                ["SBlock", "references", "SPage"],
                ["SPage", "has title", "Opposed By"],
                ["SBlock", "has child", "Block"],
                ["PBlock", "references", "ParentPage"],
                ["PBlock", "has child", "SBlock"],
                ["ParentPage", "is a", "destination"],
              ],
            },
            {
              id: "TyLWOdB4U",
              label: "Supports",
              source: "sys03tzKR",
              destination: "sys03tzKR",
              complement: "Supported By",
              query: "",
              complementQuery: "",
              triples: [
                ["DstPage", "is a", "destination"],
                ["DstBlock", "references", "DstPage"],
                ["SrcBlock", "references", "SrcPage"],
                ["SrcPage", "is a", "source"],
                ["RPage", "has title", "SupportedBy"],
                ["RBlock", "references", "RPage"],
                ["DstBlock", "has child", "RBlock"],
                ["RBlock", "has child", "SrcBlock"],
              ],
            },
            {
              id: "fxY-tTHCE",
              label: "Informs",
              source: "sys03tzKR",
              destination: "CK3kwflMN",
              complement: "Informed By",
              query: "",
              complementQuery: "",
              triples: [
                ["Context", "is in page", "DstPage"],
                ["Context", "references", "SrcPage"],
                ["SrcPage", "is a", "source"],
                ["DstPage", "is a", "destination"],
              ],
            },
            {
              id: "fpwvws-ic",
              label: "Consistent With",
              source: "85wgkuO31",
              destination: "85wgkuO31",
              complement: "Consistent With",
              query: "",
              complementQuery: "",
              triples: [
                ["Page", "is a", "source"],
                ["Block2", "references", "Page"],
                ["Block3", "references", "Page2"],
                ["Page2", "is a", "destination"],
                ["Context", "has child", "Block2"],
                ["Context", "has child", "Block3"],
                ["Context", "references", "page3"],
                ["page3", "has title", "SupportedBy"],
              ],
            },
            {
              id: "fpwvws-ic",
              label: "Consistent With",
              source: "85wgkuO31",
              destination: "85wgkuO31",
              complement: "Consistent With",
              query: "",
              complementQuery: "",
              triples: [
                ["Page", "is a", "source"],
                ["Block", "references", "Page"],
                ["SBlock", "references", "SPage"],
                ["SPage", "has title", "OpposedBy"],
                ["SBlock", "has child", "Block"],
                ["PBlock", "references", "ParentPage"],
                ["PBlock", "has child", "SBlock"],
                ["ParentPage", "is a", "destination"],
              ],
            },
            {
              id: "fpwvws-ic",
              label: "Consistent With",
              source: "85wgkuO31",
              destination: "85wgkuO31",
              complement: "Consistent With",
              query: "",
              complementQuery: "",
              triples: [
                ["Block16", "is a", "source"],
                ["Block14", "is a", "destination"],
                ["Block19", "has title", "consistentWith"],
                ["Block17", "has child", "Block24"],
                ["Block24", "references", "Block19"],
                ["Block24", "references", "Block14"],
                ["Block17", "references", "Block16"],
              ],
            },
            {
              id: "5h91Rpo_w",
              label: "Informs",
              source: "OZhxQs38_",
              destination: "sys03tzKR",
              complement: "Informed By",
              query: "",
              complementQuery: "",
              triples: [
                ["Context", "is in page", "Page2"],
                ["Page2", "is a", "destination"],
                ["Context", "references", "Page"],
                ["Page", "is a", "source"],
              ],
            },
            {
              id: "SPnC4rDfE",
              label: "Informs",
              source: "OZhxQs38_",
              destination: "CK3kwflMN",
              complement: "Informed By",
              query: "",
              complementQuery: "",
              triples: [
                ["Page", "is a", "source"],
                ["Context", "references", "Page"],
                ["Context", "is in page", "Page2"],
                ["Page2", "is a", "destination"],
              ],
            },
            {
              id: "LWkn2SVzt",
              label: "Informs",
              source: "OZhxQs38_",
              destination: "84l8tEeA2",
              complement: "Informed By",
              query: "",
              complementQuery: "",
              triples: [
                ["Page", "is a", "source"],
                ["Block1", "references", "Page"],
                ["Block1", "is in page", "Page2"],
                ["Page2", "is a", "destination"],
              ],
            },
            {
              id: "CFnThTTI0",
              label: "Informs",
              source: "85wgkuO31",
              destination: "84l8tEeA2",
              complement: "Informed By",
              query: "",
              complementQuery: "",
              triples: [
                ["Context", "is in page", "DstPage"],
                ["Context", "references", "SrcPage"],
                ["SrcPage", "is a", "source"],
                ["DstPage", "is a", "destination"],
              ],
            },
            {
              id: "CFnThTTI0",
              label: "Informs",
              source: "85wgkuO31",
              destination: "84l8tEeA2",
              complement: "Informed By",
              query: "",
              complementQuery: "",
              triples: [
                ["DstPage", "is a", "destination"],
                ["SrcPage", "is a", "source"],
                ["SrcBlock", "references", "SrcPage"],
                ["DstBlock", "references", "DstPage"],
                ["LinkPage", "has title", "Informs"],
                ["SrcBlock", "references", "LinkPage"],
                ["DstBlock", "has descendant", "SrcBlock"],
              ],
            },
            {
              id: "bTXP3AKwO",
              label: "Informs",
              source: "OZhxQs38_",
              destination: "ceW_PoMVt",
              complement: "Informed By",
              query: "",
              complementQuery: "",
              triples: [
                ["Page", "is a", "source"],
                ["Context", "references", "Page"],
                ["Context", "is in page", "Page2"],
                ["Page2", "is a", "destination"],
              ],
            },
            {
              id: "9xn6lpbAD",
              label: "Informs",
              source: "85wgkuO31",
              destination: "ceW_PoMVt",
              complement: "Informed By",
              query: "",
              complementQuery: "",
              triples: [
                ["SrcBlock", "is in page", "DstPage"],
                ["SrcBlock", "references", "SrcPage"],
                ["SrcPage", "is a", "source"],
                ["DstPage", "is a", "destination"],
              ],
            },
            {
              id: "9xn6lpbAD",
              label: "Informs",
              source: "85wgkuO31",
              destination: "ceW_PoMVt",
              complement: "Informed By",
              query: "",
              complementQuery: "",
              triples: [
                ["DstPage", "is a", "destination"],
                ["SrcPage", "is a", "source"],
                ["SrcBlock", "references", "SrcPage"],
                ["DstBlock", "references", "DstPage"],
                ["LinkPage", "has title", "Informs"],
                ["SrcBlock", "references", "LinkPage"],
                ["DstBlock", "has descendant", "SrcBlock"],
              ],
            },
            {
              id: "HjthZkfw7",
              label: "SourceFor",
              source: "OZhxQs38_",
              destination: "85wgkuO31",
              complement: "FromSource",
              query: "",
              complementQuery: "",
              triples: [
                ["Page", "is a", "source"],
                ["Page2", "is a", "destination"],
                ["Page2", "references", "Page"],
              ],
            },
            {
              id: "uZu_VeT5Q",
              label: "SourceFor",
              source: "DoIcrR_MO",
              destination: "q3B9CaO6Q",
              complement: "FromSource",
              query: "",
              complementQuery: "",
              triples: [
                ["Page", "is a", "source"],
                ["Page2", "is a", "destination"],
                ["Page2", "references", "Page"],
              ],
            },
            {
              id: "_qxDacB9c",
              label: "IssueFor",
              source: "8tpfgIm5Z",
              destination: "DoIcrR_MO",
              complement: "RelatedIssue",
              query: "",
              complementQuery: "",
              triples: [
                ["Block1", "is a", "destination"],
                ["Block0", "is in page", "Block1"],
                ["Block2", "is a", "source"],
                ["Block0", "references", "Block2"],
              ],
            },
            {
              id: "txJiNh8Pz",
              label: "UsedIn",
              source: "ceW_PoMVt",
              destination: "S276jHf0s",
              complement: "Uses",
              query: "",
              complementQuery: "",
              triples: [
                ["Block0", "is a", "source"],
                ["Block1", "is a", "destination"],
                ["Context", "references", "Block1"],
                ["Context", "is in page", "Block0"],
                ["Context", "references", "Block3"],
                ["Block3", "has title", "UsedIn"],
              ],
            },
            {
              id: "Syi_vj27y",
              label: "Informs",
              source: "sys03tzKR",
              destination: "sys03tzKR",
              complement: "Informed By",
              query: "",
              complementQuery: "",
              triples: [
                ["Page", "is a", "source"],
                ["Block", "references", "Page"],
                ["Block", "is in page", "ParentPage"],
                ["ParentPage", "is a", "destination"],
              ],
            },
            {
              id: "Syi_vj27y",
              label: "Informs",
              source: "sys03tzKR",
              destination: "sys03tzKR",
              complement: "Informed By",
              query: "",
              complementQuery: "",
              triples: [
                ["DstPage", "is a", "destination"],
                ["SrcPage", "is a", "source"],
                ["SrcBlock", "references", "SrcPage"],
                ["DstBlock", "references", "DstPage"],
                ["LinkPage", "has title", "Informs"],
                ["SrcBlock", "references", "LinkPage"],
                ["DstBlock", "has descendant", "SrcBlock"],
              ],
            },
            {
              id: "OtFiizJEX",
              label: "IsTo",
              source: "B676vtaon",
              destination: "YjF0S0tKS",
              complement: "Informed By",
              query: "",
              complementQuery: "",
              triples: [
                ["Page", "is a", "source"],
                ["Block2", "references", "Page"],
                ["Block3", "references", "Page2"],
                ["Page2", "is a", "destination"],
                ["Context", "has child", "Block2"],
                ["Context", "has child", "Block3"],
                ["Context", "references", "page3"],
                ["page3", "has title", "SupportedBy"],
              ],
            },
            {
              id: "OtFiizJEX",
              label: "IsTo",
              source: "B676vtaon",
              destination: "YjF0S0tKS",
              complement: "Informed By",
              query: "",
              complementQuery: "",
              triples: [
                ["Block16", "is a", "source"],
                ["Block14", "is a", "destination"],
                ["Block19", "has title", "consistentWith"],
                ["Block17", "has child", "Block24"],
                ["Block24", "references", "Block19"],
                ["Block24", "references", "Block14"],
                ["Block17", "references", "Block16"],
              ],
            },
          ],
        },
      };
      const {
        isCustomEnabled,
        customNode,
        isSamePageEnabled,
        definedSelections,
        ...args
      } = _args;
      const query = getDatalogQuery(args);
      console.log(query);
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Run Test Queries - then",
    callback: async () => {
      type QueryConfig = {
        query: string;
      };
      const executeQueriesWithLogs = async (queries: QueryConfig[]) => {
        const startTime = Date.now();

        const queryPromises = queries.map((q) => {
          logTimestamp("🔍🟢", `Running query: ${q.query}`);
          return window.roamAlphaAPI.data.async.q(q.query).then((result) => {
            console.log(`Query completed after ${Date.now() - startTime}ms:`, {
              query: q,
              result,
            });
            return result;
          });
        });

        const results = await Promise.all(queryPromises);
        console.log(
          `All queries completed after ${Date.now() - startTime}ms:`,
          results
        );
        return results;
      };
      await executeQueriesWithLogs(queries);
    },
  });

  extensionAPI.ui.commandPalette.addCommand({
    label: "Run Test Queries",
    callback: async () => {
      type QueryConfig = {
        query: string;
      };

      const executeQueriesWithLogs = async (queries: QueryConfig[]) => {
        const startTime = Date.now();
        logTimestamp("🔍🟢", `Start`);
        const results = await Promise.all(
          queries.map((q) => {
            const queryName =
              (q.query.match(/\?(\w+)/)?.[1] || "unnamed") + `-${nanoid(4)}`;
            logTimestamp("🔍🟢", `Running query: ${queryName}`);

            return window.roamAlphaAPI.data.async.q(q.query);
          })
        );
        console.log(
          `All queries completed after ${Date.now() - startTime}ms:`,
          results
        );
        return results;
      };
      await executeQueriesWithLogs(queries);
    },
  });

  extensionAPI.ui.commandPalette.addCommand({
    label: "Query Tester",
    callback: () => {
      renderQueryTester({
        onClose: () => {},
        isOpen: true,
      });
    },
  });

  extensionAPI.ui.commandPalette.addCommand({
    label: "Open Query Drawer",
    callback: () =>
      Promise.resolve(
        getPageUidByPageTitle("roam/js/query-builder/drawer") ||
          createPage({
            title: "roam/js/query-builder/drawer",
          })
      ).then((blockUid) =>
        queryRender({
          blockUid,
          //@ts-ignore
          clearOnClick,
          onloadArgs,
        })
      ),
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Create Query Block",
    callback: async () => {
      const uid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      if (!uid) {
        renderToast({
          id: "query-builder-create-block",
          content: "Must be focused on a block to create a Query Block",
        });
        return;
      }

      // setTimeout is needed because sometimes block is left blank
      setTimeout(async () => {
        await updateBlock({
          uid,
          text: "{{query block}}",
          open: false,
        });
      }, 200);

      await createBlock({
        node: {
          text: "scratch",
          children: [
            {
              text: "custom",
            },
            {
              text: "selections",
            },
            {
              text: "conditions",
              children: [
                {
                  text: "clause",
                  children: [
                    {
                      text: "source",
                      children: [{ text: "node" }],
                    },
                    {
                      text: "relation",
                    },
                  ],
                },
              ],
            },
          ],
        },
        parentUid: uid,
      });
      document.querySelector("body")?.click();
      // TODO replace with document.body.dispatchEvent(new CustomEvent)
      setTimeout(() => {
        const el = document.querySelector(`.roam-block[id*="${uid}"]`);
        const conditionEl = el?.querySelector(
          ".roamjs-query-condition-relation"
        );
        const conditionInput = conditionEl?.querySelector(
          "input"
        ) as HTMLInputElement;
        conditionInput?.focus();
      }, 200);
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Export Current Page",
    callback: () => {
      const pageUid = getCurrentPageUid();
      const pageTitle = getPageTitleByPageUid(pageUid);
      exportRender({
        results: [
          {
            uid: pageUid,
            text: pageTitle,
          },
        ],
        title: "Export Current Page",
        initialPanel: "export",
      });
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Preview Current Query Builder Results",
    callback: () => {
      const target = document.activeElement as HTMLElement;
      const uid = getBlockUidFromTarget(target);
      document.body.dispatchEvent(
        new CustomEvent("roamjs-query-builder:fire-query", { detail: uid })
      );
    },
  });

  const renderCustomBlockView = ({
    view,
    blockUid,
    parent,
  }: {
    view: string;
    parent: HTMLElement;
    blockUid: string;
  }) => {
    if (view === "Message") {
      renderMessageBlock({ parent, onloadArgs, blockUid });
    }
  };

  /** 
     * Roam team is working on a way to register custom block views
     * This is exciting! commented this out so that the feature could stay somewhat hidden
     * But hint at how we'd like to register our custom view in the future.
     * The way that users will be able to add custom block views is using SmartBlock's SETPROPS command.
    extensionAPI.ui.commandPalette.addCommand({
      label: "(QB) Change Block View",
      callback: async () => {
        const uid =
          window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"] ||
          (await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid()) ||
          window.roamAlphaAPI.util.dateToPageUid(new Date());
        renderFormDialog({
          onSubmit: (values) => {
            const props = getBlockProps(uid);
            const qbprops = props["roamjs-query-builder"] || {};
            const view = values.view as string;
            window.roamAlphaAPI.updateBlock({
              block: {
                uid,
                props: {
                  ...props,
                  "roamjs-query-builder": {
                    ...qbprops,
                    view,
                  },
                },
              },
            });
            document
              .querySelectorAll<HTMLDivElement>(`.roam-block[id*="${uid}"`)
              .forEach((parent) =>
                renderCustomBlockView({
                  view,
                  blockUid: uid,
                  parent,
                })
              );
          },
          title: "Set Custom View For Block",
          fields: {
            view: {
              type: "select",
              label: "View Type",
              options: ["Standard", "Message"],
            },
          },
        });
      },
    });
    */

  renderToast({
    id: "discourse-graph-loaded",
    content: "Successfully loaded",
    intent: "success",
    timeout: 500,
  });

  const [viewBlockObserver] = createBlockObserver({
    onBlockLoad: (b) => {
      const { blockUid } = getUids(b);
      const props = getBlockProps(blockUid) as Record<string, json>;
      const qbprops = (props["roamjs-query-builder"] || {}) as Record<
        string,
        json
      >;
      renderCustomBlockView({
        view: qbprops["view"] as string,
        blockUid,
        parent: b,
      });
    },
  });

  const pageActionListener = ((
    e: CustomEvent<{
      action: string;
      uid: string;
      val: string;
      onRefresh: () => void;
    }>
  ) => {
    if (!/page/i.test(e.detail.action)) return;
    window.roamAlphaAPI.ui.mainWindow
      .getOpenPageOrBlockUid()
      .then((u) => u || window.roamAlphaAPI.util.dateToPageUid(new Date()))
      .then((parentUid) => {
        createBlock({
          parentUid,
          order: Number.MAX_VALUE,
          node: { text: `[[${e.detail.val}]]` },
        });
      });
  }) as EventListener;
  document.addEventListener("roamjs:query-builder:action", pageActionListener);
  return {
    elements: [style],
    observers: [
      h1Observer,
      qtObserver,
      originalQueryBuilderObserver,
      editQueryBuilderObserver,
      queryBlockObserver,
      viewBlockObserver,
    ],
    unload: () => {
      window.roamjs.extension?.smartblocks?.unregisterCommand("QUERYBUILDER");
      toggleDiscourseGraphsMode(false);
      // @ts-ignore - tldraw throws a warning on multiple loads
      delete window[Symbol.for("__signia__")];
      document.removeEventListener(
        "roamjs:query-builder:action",
        pageActionListener
      );
    },
  };
});
