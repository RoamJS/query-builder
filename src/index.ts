import createButtonObserver from "roamjs-components/dom/createButtonObserver";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getUidsFromId from "roamjs-components/dom/getUidsFromId";
import { renderQueryBuilder } from "./components/QueryBuilder";
import runExtension from "roamjs-components/util/runExtension";
import addStyle from "roamjs-components/dom/addStyle";
import getSubTree from "roamjs-components/util/getSubTree";
import getPageTitleValueByHtmlElement from "roamjs-components/dom/getPageTitleValueByHtmlElement";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import {
  render as renderQueryPage,
  renderQueryBlock,
} from "./components/QueryPage";
import { setBackendToken } from "./utils/fireQuery";
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

const loadedElsewhere = document.currentScript
  ? document.currentScript.getAttribute("data-source") === "discourse-graph"
  : false;

export default runExtension({
  migratedTo: loadedElsewhere ? undefined : "Query Builder",
  run: async (onloadArgs) => {
    const { extensionAPI } = onloadArgs;
    const style = addStyle(`.bp3-button:focus {
    outline-width: 2px;
}

.roamjs-query-condition-source, 
.roamjs-query-condition-relation,
.roamjs-query-return-node {
  min-width: 144px;
  max-width: 144px;
}

.roamjs-query-condition-relation,
.roamjs-query-return-node {
  padding-right: 8px;
}

.roamjs-query-condition-target { 
  flex-grow: 1;
  min-width: 260px;
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

.roamjs-query-embed > .page-embed > .roam-block-container > .rm-block-main,
.roamjs-query-embed > .page-embed > .roam-block-container > .rm-block-children > .rm-multibar {
  display: none;
}

.roamjs-query-embed > .page-embed > .roam-block-container > .rm-block-children {
  margin-left: initial;
}

.roamjs-query-embed > .rm-page-title {
  margin: 10px 0px 10px 24px;
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
}`);
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
        if (h1.parentElement.lastChild === h1) {
          h1.parentElement.appendChild(container);
        } else {
          h1.parentElement.insertBefore(container, h1.nextSibling);
        }
      }

      if (title.startsWith("discourse-graph/nodes/")) {
        renderDiscourseNodeTypeConfigPage({ title, h: h1, onloadArgs });
      } else if (
        getQueryPages(extensionAPI)
          .map(
            (t) =>
              new RegExp(
                `^${t.replace(/\*/g, ".*").replace(/([()])/g, "\\$1")}$`
              )
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
            defaultReturnNode: "node",
            onloadArgs,
          });
        }
      } else if (
        title.startsWith("Playground") &&
        !!h1.closest(".roam-article")
      ) {
        renderPlayground(title, globalRefs);
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
          id: SETTING,
          name: "Discourse Graphs Enabled",
          description:
            "Includes the ability to construct higher level discourse graph nodes and relations for higher order reasoning.",
          action: {
            type: "switch",
            onChange: (e) => {
              const flag = e.target.checked;
              toggleDiscourseGraphsMode(flag).then(() => {
                if (flag)
                  document
                    .querySelectorAll(`h1.rm-title-display`)
                    .forEach(h1ObserverCallback);
              });
            },
          },
        },
        {
          id: "token",
          name: "Backend Token (EXPERIMENTAL)",
          description:
            "Add your backend graph token to perform queries in the background instead of blocking the UI",
          action: {
            type: "input",
            placeholder: "roam-graph-token-xxxx",
            onChange: (e) => setBackendToken(e.target.value),
          },
        },
      ],
    });
    if (loadedElsewhere) {
      await extensionAPI.settings.set(SETTING, true);
      setTimeout(() => {
        setBackendToken((extensionAPI.settings.get("token") as string) || "");
        toggleDiscourseGraphsMode(true).then(() =>
          document
            .querySelectorAll(`h1.rm-title-display`)
            .forEach(h1ObserverCallback)
        );
      }, 1000);
    } else {
      setBackendToken((extensionAPI.settings.get("token") as string) || "");
    }
    const toggleDiscourseGraphsMode = await initializeDiscourseGraphsMode(
      onloadArgs
    );
    const toggleSortReferences = runSortReferences();
    if (!!extensionAPI.settings.get("sort-references")) {toggleSortReferences(true);}
    
    const globalRefs = {
      clearOnClick: ({
        parentUid,
        text,
      }: {
        parentUid: string;
        text: string;
      }) => {
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
      callback: h1ObserverCallback,
    });

    const queryBlockObserver = createButtonObserver({
      attribute: "query-block",
      render: (b) => renderQueryBlock(b, onloadArgs),
    });

    const originalQueryBuilderObserver = createButtonObserver({
      shortcut: "qb",
      attribute: "query-builder",
      render: (b: HTMLButtonElement) =>
        renderQueryBuilder({
          blockId: b.closest(".roam-block").id,
          parent: b.parentElement,
        }),
    });

    const dataAttribute = "data-roamjs-edit-query";
    const editQueryBuilderObserver = createHTMLObserver({
      callback: (b) => {
        if (!b.getAttribute(dataAttribute)) {
          b.setAttribute(dataAttribute, "true");
          const editButtonRoot = document.createElement("div");
          b.appendChild(editButtonRoot);
          const blockId = b.closest(".roam-block").id;
          const initialValue = getTextByBlockUid(
            getUidsFromId(blockId).blockUid
          );
          renderQueryBuilder({
            blockId,
            parent: editButtonRoot,
            initialValue,
          });
          const editButton = document.getElementById(
            `roamjs-query-builder-button-${blockId}`
          );
          editButton.addEventListener("mousedown", (e) => e.stopPropagation());
        }
      },
      tag: "DIV",
      className: "rm-query-title",
    });

    const qtObserver = runQueryTools(extensionAPI);

    registerSmartBlocksCommand({
      text: "QUERYBUILDER",
      delayArgs: true,
      help: "Run an existing query block and output the results.\n\n1. The reference to the query block\n2. The format to output each result",
      handler:
        ({ proccessBlockText, variables }) =>
        (arg, format = "(({uid}))") => {
          const queryUid = variables[arg] || arg;
          const parentUid = extractRef(queryUid);
          return runQuery(parentUid, extensionAPI).then(({ allResults }) => {
            return allResults
              .map((r) =>
                Object.fromEntries(
                  Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])
                )
              )
              .map((r) =>
                format.replace(/{([^}]+)}/, (_, i: string) => {
                  const value = r[i.toLowerCase()];
                  return typeof value === "string"
                    ? value
                    : typeof value === "number"
                    ? value.toString()
                    : value instanceof Date
                    ? window.roamAlphaAPI.util.dateToPageTitle(value)
                    : "";
                })
              )
              .map((s) => () => proccessBlockText(s))
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
        runQuery(parentUid, extensionAPI).then(({ allResults }) => allResults),
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
        ).map((b) => ({ uid: b[0][":block/uid"] })),
    };

    window.roamAlphaAPI.ui.commandPalette.addCommand({
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
            clearOnClick,
            onloadArgs,
          })
        ),
    });

    return {
      elements: [style],
      commands: ["Open Query Drawer"],
      observers: [
        h1Observer,
        qtObserver,
        originalQueryBuilderObserver,
        editQueryBuilderObserver,
        queryBlockObserver,
      ],
      unload: () => {
        window.roamjs.extension?.smartblocks?.unregisterCommand("QUERYBUILDER");
        toggleDiscourseGraphsMode(false);
      },
    };
  },
});
