import createButtonObserver from "roamjs-components/dom/createButtonObserver";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getUidsFromId from "roamjs-components/dom/getUidsFromId";
import { renderQueryBuilder } from "./components/QueryBuilder";
import runExtension from "roamjs-components/util/runExtension";
import addStyle from "roamjs-components/dom/addStyle";
import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import toConfigPageName from "roamjs-components/util/toConfigPageName";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";
import getPageTitleValueByHtmlElement from "roamjs-components/dom/getPageTitleValueByHtmlElement";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import QueryPage, {
  render as renderQueryPage,
  renderQueryBlock,
} from "./components/QueryPage";
import QueryEditor from "./components/QueryEditor";
import ResultsView, { sortFunction } from "./components/ResultsView";
import fireQuery, {
  registerSelection,
  getWhereClauses,
  getDatalogQueryComponents,
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
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import type { InputTextNode } from "roamjs-components/types/native";
import MultiTextPanel from "roamjs-components/components/ConfigPanels/MultiTextPanel";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import CustomPanel from "roamjs-components/components/ConfigPanels/CustomPanel";
import NumberPanel from "roamjs-components/components/ConfigPanels/NumberPanel";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import type {
  CustomField,
  Field,
  SelectField,
} from "roamjs-components/components/ConfigPanels/types";
import getSettingIntFromTree from "roamjs-components/util/getSettingIntFromTree";
import migrateLegacySettings from "roamjs-components/util/migrateLegacySettings";
import QueryPagesPanel from "./components/QueryPagesPanel";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";

const extensionId = "query-builder";
const loadedElsewhere = document.currentScript
  ? !!document.currentScript.getAttribute("data-source")
  : false;

export default runExtension({
  migratedTo: loadedElsewhere ? undefined : "Query Builder",
  extensionId,
  run: async ({ extensionAPI }) => {
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
  min-width: 300px;
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
}`);
    migrateLegacySettings({
      extensionAPI,
      extensionId,
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
      ],
    });

    const h1Observer = createHTMLObserver({
      tag: "H1",
      className: "rm-title-display",
      callback: (h1: HTMLHeadingElement) => {
        const title = getPageTitleValueByHtmlElement(h1);
        if (
          ((extensionAPI.settings.get("query-pages") as string[]) || [])
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
              extensionAPI,
            });
          }
        }
      },
    });

    const queryBlockObserver = createButtonObserver({
      attribute: "query-block",
      render: (b) => renderQueryBlock(extensionAPI)(b),
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
          const tree = getBasicTreeByParentUid(parentUid);
          const resultNode = getSubTree({ tree, key: "results" });
          const sortsNode = getSubTree({
            tree: resultNode.children,
            key: "sorts",
          });
          const random = getSettingIntFromTree({
            tree: resultNode.children,
            key: "random",
          });
          const activeSort = sortsNode.children.map((s) => ({
            key: s.text,
            descending: toFlexRegex("true").test(s.children[0]?.text || ""),
          }));
          return fireQuery(parseQuery(parentUid)).then((results) => {
            const sortedResults = results.sort((a, b) => {
              for (const sort of activeSort) {
                const cmpResult = sortFunction(sort.key, sort.descending)(a, b);
                if (cmpResult !== 0) return cmpResult;
              }
              return 0;
            });
            const returnedResults =
              random > 0
                ? sortedResults.sort(() => 0.5 - Math.random()).slice(0, random)
                : sortedResults;
            return returnedResults
              .map((r) =>
                format.replace(/{([^}]+)}/, (_, i) => {
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
      QueryPage,
      ResultsView,
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
    };
  },
  unload: () => {
    delete window.roamjs.extension.queryBuilder;
    window.roamjs.extension?.smartblocks?.unregisterCommand("QUERYBUILDER");
  },
});
