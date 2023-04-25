import {
  createConfigObserver,
  render as configPageRender,
} from "roamjs-components/components/ConfigPage";
import {
  CustomField,
  Field,
  FlagField,
  SelectField,
  TextField,
} from "roamjs-components/components/ConfigPanels/types";
import DiscourseNodeConfigPanel from "./components/DiscourseNodeConfigPanel";
import DiscourseRelationConfigPanel from "./components/DiscourseRelationConfigPanel";
import CustomPanel from "roamjs-components/components/ConfigPanels/CustomPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import NumberPanel from "roamjs-components/components/ConfigPanels/NumberPanel";
import MultiTextPanel from "roamjs-components/components/ConfigPanels/MultiTextPanel";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";
import DEFAULT_RELATION_VALUES from "./data/defaultDiscourseRelations";
import { OnloadArgs } from "roamjs-components/types";
import getDiscourseNodes from "./utils/getDiscourseNodes";
import refreshConfigTree from "./utils/refreshConfigTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import { render } from "./components/DiscourseNodeMenu";
import { render as discourseOverlayRender } from "./components/DiscourseContextOverlay";
import { render as previewRender } from "./components/LivePreview";
import { render as renderReferenceContext } from "./components/ReferenceContext";
import DiscourseContext from "./components/DiscourseContext";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import isDiscourseNode from "./utils/isDiscourseNode";
import isFlagEnabled from "./utils/isFlagEnabled";
import addStyle from "roamjs-components/dom/addStyle";
import { render as exportRender } from "./components/ExportDialog";
import { registerSelection } from "./utils/fireQuery";
import deriveNodeAttribute from "./utils/deriveDiscourseNodeAttribute";
import matchDiscourseNode from "./utils/matchDiscourseNode";
import getPageTitleValueByHtmlElement from "roamjs-components/dom/getPageTitleValueByHtmlElement";
import React from "react";
import DiscourseNodeIndex from "./components/DiscourseNodeIndex";
import DiscourseNodeSpecification from "./components/DiscourseNodeSpecification";
import DiscourseNodeAttributes from "./components/DiscourseNodeAttributes";
import getSubTree from "roamjs-components/util/getSubTree";
import { render as cyRender } from "./components/CytoscapePlayground";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import createPage from "roamjs-components/writes/createPage";
import DEFAULT_NODE_VALUES from "./data/defaultDiscourseNodes";

export const SETTING = "discourse-graphs";

// TODO POST MIGRATE - move this logic within the toggle
const pageRefObservers = new Set<(s: HTMLSpanElement) => void>();
const pageRefObserverRef: { current?: MutationObserver } = {
  current: undefined,
};
const enablePageRefObserver = () =>
  (pageRefObserverRef.current = createHTMLObserver({
    useBody: true,
    tag: "SPAN",
    className: "rm-page-ref",
    callback: (s: HTMLSpanElement) => {
      pageRefObservers.forEach((f) => f(s));
    },
  }));
const disablePageRefObserver = () => {
  pageRefObserverRef.current?.disconnect();
  pageRefObserverRef.current = undefined;
};
const onPageRefObserverChange =
  (handler: (s: HTMLSpanElement) => void) => (b: boolean) => {
    if (b) {
      if (!pageRefObservers.size) enablePageRefObserver();
      pageRefObservers.add(handler);
    } else {
      pageRefObservers.delete(handler);
      if (!pageRefObservers.size) disablePageRefObserver();
    }
  };

const previewPageRefHandler = (s: HTMLSpanElement) => {
  const tag =
    s.getAttribute("data-tag") ||
    s.parentElement?.getAttribute("data-link-title");
  if (tag && !s.getAttribute("data-roamjs-discourse-augment-tag")) {
    s.setAttribute("data-roamjs-discourse-augment-tag", "true");
    const parent = document.createElement("span");
    previewRender({
      parent,
      tag,
      registerMouseEvents: ({ open, close }) => {
        s.addEventListener("mouseenter", (e) => open(e.ctrlKey));
        s.addEventListener("mouseleave", close);
      },
    });
    s.appendChild(parent);
  }
};

let enabled = false;

export const renderPlayground = (
  title: string,
  globalRefs: Parameters<typeof cyRender>[0]["globalRefs"]
) => {
  if (!enabled) return;
  const children = document.querySelector<HTMLDivElement>(
    ".roam-article .rm-block-children"
  );
  if (
    children &&
    children.parentElement &&
    !children.hasAttribute("data-roamjs-discourse-playground")
  ) {
    children.setAttribute("data-roamjs-discourse-playground", "true");
    const parent = document.createElement("div");
    children.parentElement.appendChild(parent);
    parent.style.height = "500px";
    cyRender({
      parent,
      title,
      previewEnabled: isFlagEnabled("preview"),
      globalRefs,
    });
  }
};

export const renderDiscourseNodeTypeConfigPage = ({
  title,
  h,
  onloadArgs,
}: {
  title: string;
  h: HTMLHeadingElement;
  onloadArgs: OnloadArgs;
}) => {
  if (!enabled) return;
  const nodeText = title.substring("discourse-graph/nodes/".length);
  const allNodes = getDiscourseNodes();
  const node = allNodes.find(({ text }) => text === nodeText);
  if (node) {
    const renderNode = () =>
      configPageRender({
        h,
        title,
        config: [
          // @ts-ignore
          {
            title: "Index",
            description: "Index of all of the pages in your graph of this type",
            Panel: CustomPanel,
            options: {
              component: ({ uid }) =>
                React.createElement(DiscourseNodeIndex, {
                  node,
                  parentUid: uid,
                  onloadArgs,
                }),
            },
          } as Field<CustomField>,
          // @ts-ignore
          {
            title: "Format",
            description: `The format ${nodeText} pages should have.`,
            defaultValue: "\\",
            Panel: TextPanel,
            options: {
              placeholder: `Include "{content}" in format`,
            },
          } as Field<TextField>,
          // @ts-ignore
          {
            title: "Specification",
            description: `The conditions specified to identify a ${nodeText} node.`,
            Panel: CustomPanel,
            options: {
              component: ({ uid }) =>
                React.createElement(DiscourseNodeSpecification, {
                  node,
                  parentUid: uid,
                }),
            },
          } as Field<CustomField>,
          {
            title: "Shortcut",
            description: `The trigger to quickly create a ${nodeText} page from the node menu.`,
            defaultValue: "\\",
            // @ts-ignore
            Panel: TextPanel,
          },
          {
            title: "Description",
            description: `Describing what the ${nodeText} node represents in your graph.`,
            // @ts-ignore
            Panel: TextPanel,
          },
          {
            title: "Template",
            description: `The template that auto fills ${nodeText} page when generated.`,
            // @ts-ignore
            Panel: BlocksPanel,
          },
          // @ts-ignore
          {
            title: "Attributes",
            description: `A set of derived properties about the node based on queryable data.`,
            Panel: CustomPanel,
            options: {
              component: DiscourseNodeAttributes,
            },
          } as Field<CustomField>,
          // @ts-ignore
          {
            title: "Overlay",
            description: `Select which attribute is used for the Discourse Overlay`,
            Panel: SelectPanel,
            options: {
              items: () =>
                getSubTree({
                  parentUid: getPageUidByPageTitle(title),
                  key: "Attributes",
                }).children.map((c) => c.text),
            },
          } as Field<SelectField>,
        ],
      });

    renderNode();
  }
};

const initializeDiscourseGraphsMode = async (args: OnloadArgs) => {
  const unloads = new Set<() => void>();
  const toggle = async (flag: boolean) => {
    if (flag && !enabled) {
      window.roamjs.version = {
        ...window.roamjs.version,
        ["discourse-graph"]: args.extension.version,
      };
      unloads.add(function removeVersion() {
        delete window.roamjs.version.discourseGraph;
        unloads.delete(removeVersion);
      });

      const style =
        addStyle(`.roamjs-discourse-live-preview>div>div>.rm-block-main,
  .roamjs-discourse-live-preview>div>div>.rm-inline-references,
  .roamjs-discourse-live-preview>div>div>.rm-block-children>.rm-multibar {
  display: none;
  }
  
  .roamjs-discourse-live-preview>div>div>.rm-block-children {
  margin-left: -4px;
  }
  
  .roamjs-discourse-live-preview {
  overflow-y: scroll;
  }
  
  .roamjs-discourse-context-title { 
  font-size: 16px;
  color: #106ba3;
  cursor: pointer; 
  }
  
  .roamjs-discourse-context-title:hover { 
  text-decoration: underline;
  }
  
  .roamjs-discourse-edit-relations {
  border: 1px solid gray;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  height: 400px;
  width: 100%;
  position: relative;
  }
  
  .roamjs-discourse-edit-relations > div:focus {
  outline: none;
  }
  
  .roamjs-discourse-drawer > .bp3-overlay {
  pointer-events: none;
  }
  
  div.roamjs-discourse-drawer div.bp3-drawer {
  pointer-events: all;
  width: 40%;
  }
  
  .roam-main {
  position: relative;
  }
  
  .roamjs-discourse-condition-source, 
  .roamjs-discourse-condition-relation,
  .roamjs-discourse-return-node,
  .roamjs-discourse-return-wrapper {
  min-width: 144px;
  max-width: 144px;
  }
  
  .roamjs-discourse-condition-relation,
  .roamjs-discourse-return-wrapper {
  padding-right: 8px;
  }
  
  .roamjs-discourse-condition-target { 
  flex-grow: 1; 
  display: flex; 
  min-width: 300px;
  }
  
  .roamjs-discourse-condition-relation .bp3-popover-target,
  .roamjs-discourse-condition-target .roamjs-page-input-target { 
  width: 100%
  }
  
  .roamjs-discourse-results-sort button {
  font-size: 10px;
  padding: 0 4px;
  }
  
  .roamjs-discourse-results-sort button,
  .roamjs-discourse-results-sort .bp3-menu {
  font-size: 10px;
  padding: 0 4px;
  width: 88px;
  max-width: 88px;
  min-width: 88px;
  }
  
  .roamjs-discourse-results-sort .bp3-button-text {
  margin-right: 2;
  }
  
  .roamjs-discourse-hightlighted-result {
  background: #FFFF00;
  }
  
  .roamjs-discourse-editor-preview > .roam-block-container > .rm-block-main,
  .roamjs-discourse-editor-preview > .roam-block-container > .rm-block-children > .rm-multibar,
  .roamjs-discourse-editor-preview > .roam-block-container > .rm-block-children > .roam-block-container > .rm-block-main > .controls,
  .roamjs-discourse-editor-preview > .roam-block-container > .rm-block-children > .roam-block-container > .rm-block-children > .rm-multibar {
  visibility: hidden;
  }
  
  .roamjs-discourse-editor-preview {
  margin-left: -32px;
  margin-top: -8px;
  }
  
  .roamjs-discourse-editor-preview 
  > .roam-block-container 
  > .rm-block-children 
  > .roam-block-container 
  > .rm-block-main {
  font-size: 24px;
  font-weight: 700;
  }
  
  .roamjs-discourse-editor-preview .rm-block-main {
  pointer-events: none;
  }
  
  .roamjs-connected-ref > div {
  display: none;
  }
  
  .roamjs-discourse-result-panel {
  width: 100%;
  }
  
  .roamjs-attribute-value {
  flex-grow: 1; 
  margin: 0 16px;
  }
  
  .roamjs-discourse-results-view ul::-webkit-scrollbar {
  width: 6px;
  }
  
  .roamjs-discourse-results-view ul::-webkit-scrollbar-thumb {
  background: #888;
  }
  
  .roamjs-discourse-playground-dialog .bp3-popover-wrapper,
  .roamjs-discourse-playground-dialog .roamjs-autocomplete-input-target,
  .roamjs-discourse-playground-dialog textarea,
  .roamjs-discourse-playground-dialog input {
  display: inline-block;
  width: 100%;
  }
  
  .roamjs-discourse-playground-dialog textarea {
  min-height: 96px;
  }
  
  .bp3-tabs.bp3-vertical>.bp3-tab-panel {
  flex-grow: 1;
  }`);
      unloads.add(function removeStyle() {
        style.remove();
        unloads.delete(removeStyle);
      });

      const overlayPageRefHandler = (s: HTMLSpanElement) => {
        if (s.parentElement && !s.parentElement.closest(".rm-page-ref")) {
          const tag =
            s.getAttribute("data-tag") ||
            s.parentElement.getAttribute("data-link-title");
          if (
            tag &&
            !s.getAttribute("data-roamjs-discourse-overlay") &&
            isDiscourseNode(getPageUidByPageTitle(tag))
          ) {
            s.setAttribute("data-roamjs-discourse-overlay", "true");
            const parent = document.createElement("span");
            discourseOverlayRender({
              parent,
              tag: tag.replace(/\\"/g, '"'),
              onloadArgs: args,
            });
            if (s.hasAttribute("data-tag")) {
              s.appendChild(parent);
            } else {
              s.parentElement.appendChild(parent);
            }
          }
        }
      };

      const { pageUid, observer } = await createConfigObserver({
        title: "roam/js/discourse-graph",
        config: {
          tabs: [
            {
              id: "home",
              fields: [
                {
                  title: "trigger",
                  description:
                    "The trigger to create the node menu. Must refresh after editing.",
                  defaultValue: "\\",
                  // @ts-ignore
                  Panel: TextPanel,
                },
                // @ts-ignore
                {
                  title: "preview",
                  description:
                    "Whether or not to display page previews when hovering over page refs",
                  Panel: FlagPanel,
                  options: {
                    onChange: onPageRefObserverChange(previewPageRefHandler),
                  },
                } as Field<FlagField>,
              ],
            },
            {
              id: "grammar",
              fields: [
                // @ts-ignore
                {
                  title: "nodes",
                  Panel: CustomPanel,
                  description: "The types of nodes in your discourse graph",
                  options: {
                    component: DiscourseNodeConfigPanel,
                  },
                } as Field<CustomField>,
                // @ts-ignore
                {
                  title: "relations",
                  Panel: CustomPanel,
                  description: "The types of relations in your discourse graph",
                  defaultValue: DEFAULT_RELATION_VALUES,
                  options: {
                    component: DiscourseRelationConfigPanel,
                  },
                } as Field<CustomField>,
                // @ts-ignore
                {
                  title: "overlay",
                  Panel: FlagPanel,
                  description:
                    "Whether to overlay discourse context information over node references",
                  options: {
                    onChange: (val) => {
                      onPageRefObserverChange(overlayPageRefHandler)(val);
                    },
                  },
                } as Field<FlagField>,
              ],
            },
            {
              id: "export",
              fields: [
                {
                  title: "max filename length",
                  // @ts-ignore
                  Panel: NumberPanel,
                  description:
                    "Set the maximum name length for markdown file exports",
                  defaultValue: 64,
                },
                {
                  title: "remove special characters",
                  // @ts-ignore
                  Panel: FlagPanel,
                  description:
                    "Whether or not to remove the special characters in a file name",
                },
                {
                  title: "simplified filename",
                  // @ts-ignore
                  Panel: FlagPanel,
                  description:
                    "For discourse nodes, extract out the {content} from the page name to become the file name",
                },
                {
                  title: "frontmatter",
                  // @ts-ignore
                  Panel: MultiTextPanel,
                  description:
                    "Specify all the lines that should go to the Frontmatter of the markdown file",
                },
                {
                  title: "resolve block references",
                  // @ts-ignore
                  Panel: FlagPanel,
                  description:
                    "Replaces block references in the markdown content with the block's content",
                },
                {
                  title: "resolve block embeds",
                  // @ts-ignore
                  Panel: FlagPanel,
                  description:
                    "Replaces block embeds in the markdown content with the block's content tree",
                },
                // @ts-ignore
                {
                  title: "link type",
                  Panel: SelectPanel,
                  description: "How to format links that appear in your export",
                  options: {
                    items: ["alias", "wikilinks"],
                  },
                } as Field<SelectField>,
              ],
            },
          ],
        },
      });
      unloads.add(function configObserverDisconnect() {
        observer?.disconnect();
        unloads.delete(configObserverDisconnect);
      });

      refreshConfigTree();
      if (getDiscourseNodes().length === 0) {
        await Promise.all(
          DEFAULT_NODE_VALUES.map(
            (n) =>
              getPageUidByPageTitle(`discourse-graph/nodes/${n.text}`) ||
              createPage({
                title: `discourse-graph/nodes/${n.text}`,
                uid: n.type,
                tree: [
                  { text: "Format", children: [{ text: n.format }] },
                  { text: "Shortcut", children: [{ text: n.shortcut }] },
                ],
              })
          )
        );
      }

      const hashChangeListener = (e: HashChangeEvent) => {
        if (
          e.oldURL.endsWith(pageUid) ||
          getDiscourseNodes().some(({ type }) => e.oldURL.endsWith(type))
        ) {
          refreshConfigTree();
        }
      };
      window.addEventListener("hashchange", hashChangeListener);
      unloads.add(function removeHashChangeListener() {
        window.removeEventListener("hashchange", hashChangeListener);
        unloads.delete(removeHashChangeListener);
      });

      const unregisterDatalog = refreshConfigTree().concat([
        registerSelection({
          test: /^(.*)-(.*)$/,
          pull: ({ returnNode }) => `(pull ?${returnNode} [:node/title])`,
          mapper: () => {
            return `This selection is deprecated. Define a Node Attribute and use \`discourse:attribute\` instead.`;
          },
        }),
        registerSelection({
          test: /^discourse:(.*)$/,
          pull: ({ returnNode }) => `(pull ?${returnNode} [:block/uid])`,
          mapper: (r, key) => {
            const attribute = key.substring("discourse:".length);
            const uid = r[":block/uid"] || "";
            return deriveNodeAttribute({ uid, attribute });
          },
        }),
        registerSelection({
          test: /^\s*type\s*$/i,
          pull: ({ returnNode }) =>
            `(pull ?${returnNode} [:node/title :block/string])`,
          mapper: (r) => {
            const title = r[":node/title"] || "";
            return (
              getDiscourseNodes().find((n) =>
                matchDiscourseNode({
                  ...n,
                  title,
                })
              )?.text || (r[":block/string"] ? "block" : "page")
            );
          },
        }),
      ]);
      unloads.add(function unregisterAllDatalog() {
        unregisterDatalog.forEach((u) => u());
        unloads.delete(unregisterAllDatalog);
      });
      const configTree = getBasicTreeByParentUid(pageUid);

      const trigger = getSettingValueFromTree({
        tree: configTree,
        key: "trigger",
        defaultValue: "\\",
      }).trim();
      const keydownListener = (e: KeyboardEvent) => {
        if (e.key === trigger) {
          const target = e.target as HTMLElement;
          if (
            target.tagName === "TEXTAREA" &&
            target.classList.contains("rm-block-input")
          ) {
            render({ textarea: target as HTMLTextAreaElement });
            e.preventDefault();
            e.stopPropagation();
          }
        }
      };
      document.addEventListener("keydown", keydownListener);
      unloads.add(function removeKeydownListener() {
        document.removeEventListener("keydown", keydownListener);
        unloads.delete(removeKeydownListener);
      });

      const discourseContextObserver = createHTMLObserver({
        tag: "DIV",
        useBody: true,
        className: "rm-reference-main",
        callback: async (d: HTMLElement) => {
          const isMain = !!d.closest(".roam-article");
          const uid = isMain
            ? await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid()
            : getPageUidByPageTitle(getPageTitleValueByHtmlElement(d));
          if (
            uid &&
            isDiscourseNode(uid) &&
            !d.getAttribute("data-roamjs-discourse-context")
          ) {
            d.setAttribute("data-roamjs-discourse-context", "true");
            const parent =
              d.querySelector("div.rm-reference-container") || d.children[0];
            if (parent && parent.parentElement) {
              const p = document.createElement("div");
              parent.parentElement.insertBefore(p, parent);
              renderWithUnmount(
                React.createElement(DiscourseContext, {
                  uid,
                  results: [],
                }),
                p,
                args
              );
            }
          }
        },
      });
      unloads.add(function removeDiscourseContextObserver() {
        discourseContextObserver.disconnect();
        unloads.delete(removeDiscourseContextObserver);
      });

      if (isFlagEnabled("preview")) pageRefObservers.add(previewPageRefHandler);
      if (isFlagEnabled("grammar.overlay")) {
        pageRefObservers.add(overlayPageRefHandler);
      }
      if (pageRefObservers.size) enablePageRefObserver();

      const queryPages = args.extensionAPI.settings.get("query-pages");
      const queryPageArray = Array.isArray(queryPages)
        ? queryPages
        : typeof queryPages === "object"
        ? []
        : typeof queryPages === "string" && queryPages
        ? [queryPages]
        : [];
      if (!queryPageArray.includes("discourse-graph/queries/*")) {
        args.extensionAPI.settings.set("query-pages", [
          ...queryPageArray,
          "discourse-graph/queries/*",
        ]);
      }
      unloads.add(function removeQueryPage() {
        args.extensionAPI.settings.set(
          "query-pages",
          (
            (args.extensionAPI.settings.get("query-pages") as string[]) || []
          ).filter((s) => s !== "discourse-graph/queries/*")
        );
        unloads.delete(removeQueryPage);
      });

      window.roamAlphaAPI.ui.commandPalette.addCommand({
        label: "Export Discourse Graph",
        callback: () => exportRender({}),
      });
      unloads.add(function removeExportCommand() {
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
          label: "Export Discourse Graph",
        });
        unloads.delete(removeExportCommand);
      });

      if (isFlagEnabled("render references")) {
        createHTMLObserver({
          className: "rm-sidebar-window",
          tag: "div",
          callback: (d) => {
            const label = d.querySelector<HTMLSpanElement>(
              ".window-headers div span"
            );
            if (label && label.innerText.startsWith("Outline")) {
              const titleEl =
                d.querySelector<HTMLHeadingElement>(".rm-title-display");
              const title = titleEl && getPageTitleValueByHtmlElement(titleEl);
              if (title && isDiscourseNode(getPageUidByPageTitle(title))) {
                const container = renderReferenceContext({ title });
                d.appendChild(container);
              }
            }
          },
        });
      }
    } else if (!flag && enabled) {
      unloads.forEach((u) => u());
      unloads.clear();
    }
    enabled = flag;
  };
  await toggle(!!args.extensionAPI.settings.get(SETTING));
  return toggle;
};

export default initializeDiscourseGraphsMode;
