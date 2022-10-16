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
import QueryPage, {
  render as renderQueryPage,
  renderQueryBlock,
} from "./components/QueryPage";
import QueryEditor from "./components/QueryEditor";
import ResultsView from "./components/ResultsView";
import fireQuery, {
  registerSelection,
  getWhereClauses,
  getDatalogQueryComponents,
  setBackendToken,
} from "./utils/fireQuery";
import parseQuery from "./utils/parseQuery";
import conditionToDatalog, {
  getConditionLabels,
  registerDatalogTranslator,
  unregisterDatalogTranslator,
} from "./utils/conditionToDatalog";
import runQueryTools from "./utils/runQueryTools";
import { ExportDialog } from "./components/Export";
import DefaultFilters from "./components/DefaultFilters";
import registerSmartBlocksCommand from "roamjs-components/util/registerSmartBlocksCommand";
import extractRef from "roamjs-components/util/extractRef";
import type { InputTextNode, PullBlock } from "roamjs-components/types/native";
import migrateLegacySettings from "roamjs-components/util/migrateLegacySettings";
import QueryPagesPanel, { getQueryPages } from "./components/QueryPagesPanel";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import runQuery from "./utils/runQuery";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { render as cyRender } from "./components/CytoscapePlayground";
import React from "react";
import isFlagEnabled from "./utils/isFlagEnabled";
import updateBlock from "roamjs-components/writes/updateBlock";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import createBlock from "roamjs-components/writes/createBlock";

const loadedElsewhere = document.currentScript
  ? !!document.currentScript.getAttribute("data-source")
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
    migrateLegacySettings({
      extensionAPI,
      extensionId: process.env.ROAMJS_EXTENSION_ID,
      specialKeys: {
        "Query Pages": (n) => [
          { value: n.children.map((c) => c.text), key: "query-pages" },
        ],
        "Default Filters": (n) => [
          {
            key: "default-filters",
            value: Object.fromEntries(
              n.children.map((c) => [
                c.text,
                {
                  includes: {
                    values: new Set(
                      getSubTree({
                        tree: c.children,
                        key: "includes",
                      }).children.map((i) => i.text)
                    ),
                  },
                  excludes: {
                    values: new Set(
                      getSubTree({
                        tree: c.children,
                        key: "excludes",
                      }).children.map((i) => i.text)
                    ),
                  },
                },
              ])
            ),
          },
        ],
        "Native Queries": (n) =>
          [
            {
              key: "sort-blocks",
              value: !!getSubTree({ key: "Sort Blocks", tree: n.children }).uid,
            },
            {
              key: "context",
              value: getSettingValueFromTree({
                key: "Context",
                tree: n.children,
              }),
            },
          ].filter((o) => typeof o.value !== "undefined"),
      },
    });

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
          name: "Hide Metadata",
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
    setTimeout(() => {
      setBackendToken((extensionAPI.settings.get("token") as string) || "");
    }, 1000);

    const globalRefs: { [key: string]: (...args: string[]) => void } = {
      clearOnClick: () => {},
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
        const pageTitle = getPageTitleByPageUid(parentUid);
        if (pageTitle.startsWith("Playground")) {
          globalRefs.clearOnClick(tag);
        } else {
          const order = getChildrenLengthByPageUid(parentUid);
          createBlock({ parentUid, node: { text }, order });
        }
      }
    };

    const h1Observer = createHTMLObserver({
      tag: "H1",
      className: "rm-title-display",
      callback: (h1: HTMLHeadingElement) => {
        const title = getPageTitleValueByHtmlElement(h1);
        if (
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
          const children = document.querySelector<HTMLDivElement>(
            ".roam-article .rm-block-children"
          );
          if (!children.hasAttribute("data-roamjs-discourse-playground")) {
            children.setAttribute("data-roamjs-discourse-playground", "true");
            const parent = document.createElement("div");
            children.parentElement.appendChild(parent);
            parent.style.height = "500px";
            // TODO POST MIGRATION - Instead of globalRefs, use dom event system
            cyRender({
              parent,
              title,
              previewEnabled: isFlagEnabled("preview"),
              globalRefs,
            });
          }
        }
      },
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
        ({ proccessBlockText }) =>
        (queryUid, format = "(({uid}))") => {
          const parentUid = extractRef(queryUid);
          return runQuery(parentUid, extensionAPI).then(({ allResults }) => {
            return allResults
              .map((r) =>
                format.replace(/{([^}]+)}/, (_, i: string) => {
                  const value = r[i];
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

    window.roamjs.extension.queryBuilder = {
      ExportDialog,
      QueryEditor,
      QueryPage: (props) =>
        React.createElement(
          ExtensionApiContextProvider,
          onloadArgs,
          React.createElement(QueryPage, props)
        ),
      ResultsView: (props) =>
        React.createElement(
          ExtensionApiContextProvider,
          onloadArgs,
          React.createElement(ResultsView, props)
        ),
      fireQuery,
      parseQuery,
      conditionToDatalog,
      getConditionLabels,
      registerSelection,
      registerDatalogTranslator,
      unregisterDatalogTranslator,

      // @ts-ignore This is used in d-g for the "involved with query" condition. Will be migrated here after idea is proven
      getWhereClauses,
      // @ts-ignore This is highly experimental - exposing this method for use in D-G.
      getDatalogQueryComponents,

      // ALL TYPES ABOVE THIS COMMENT ARE SCHEDULED TO MOVE BACK INTO QUERY BUILDER AS INTERNAL

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

    return {
      elements: [style],
      observers: [
        h1Observer,
        qtObserver,
        originalQueryBuilderObserver,
        editQueryBuilderObserver,
        queryBlockObserver,
      ],
      unload: () => {
        window.roamjs.extension?.smartblocks?.unregisterCommand("QUERYBUILDER");
      },
    };
  },
});
