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
import QueryPage, { render as renderQueryPage } from "./components/QueryPage";
import QueryEditor from "./components/QueryEditor";
import ResultsView from "./components/ResultsView";
import fireQuery, { registerSelection } from "./utils/fireQuery";
import parseQuery from "./utils/parseQuery";
import conditionToDatalog, {
  getConditionLabels,
  registerDatalogTranslator,
  unregisterDatalogTranslator,
} from "./utils/conditionToDatalog";

const ID = "query-builder";
const loadedElsewhere = !!document.currentScript.getAttribute("data-source");

runExtension(ID, async () => {
  addStyle(`.bp3-button:focus {
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
.roamjs-query-condition-target .roamjs-page-input-target { 
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

  if (!loadedElsewhere) {
    const { pageUid } = await createConfigObserver({
      title: toConfigPageName(ID),
      config: {
        tabs: [
          {
            id: "Home",
            fields: [
              {
                title: "Query Pages",
                type: "multitext",
                description:
                  "The title formats of pages that you would like to serve as pages that generate queries",
                defaultValue: ["queries/*"],
              },
              {
                title: "Hide Metadata",
                description:
                  "Hide the Roam blocks that are used to power each query",
                type: "flag",
              },
            ],
          },
        ],
      },
    });

    const getQueryPages = () => {
      const configTree = getBasicTreeByParentUid(pageUid);
      return getSubTree({
        tree: configTree,
        key: "Query Pages",
      }).children.map(
        (t) =>
          new RegExp(
            `^${t.text.replace(/\*/g, ".*").replace(/([()])/g, "\\$1")}$`
          )
      );
    };

    const queryPages = {
      current: getQueryPages(),
    };
    window.addEventListener("hashchange", (e) => {
      if (e.oldURL.endsWith(pageUid)) {
        queryPages.current = getQueryPages();
      }
    });

    createHTMLObserver({
      tag: "H1",
      className: "rm-title-display",
      callback: (h1: HTMLHeadingElement) => {
        const title = getPageTitleValueByHtmlElement(h1);
        if (queryPages.current.some((r) => r.test(title))) {
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
            const tree = getBasicTreeByParentUid(pageUid);
            const hideMetadata = !!getSubTree({
              key: "Hide Metadata",
              tree,
            }).uid;
            renderQueryPage({
              hideMetadata,
              pageUid: uid,
              parent,
              defaultReturnNode: "block",
            });
          }
        }
      },
    });

    createButtonObserver({
      shortcut: "qb",
      attribute: "query-builder",
      render: (b: HTMLButtonElement) =>
        renderQueryBuilder({
          blockId: b.closest(".roam-block").id,
          parent: b.parentElement,
        }),
    });

    const dataAttribute = "data-roamjs-edit-query";
    createHTMLObserver({
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
  }

  window.roamjs.extension.queryBuilder = {
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
  };
});
