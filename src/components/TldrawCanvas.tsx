import React, { useRef, useState, useMemo, useEffect } from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import isFlagEnabled from "../utils/isFlagEnabled";
import {
  App as TldrawApp,
  defineShape,
  TLInstance,
  TLUser,
  TldrawEditorConfig,
  Canvas,
  TldrawEditor,
  ContextMenu,
  TldrawUi,
  TLBaseShape,
  TLOpacityType,
  TLBoxUtil,
  HTMLContainer,
  TLBoxTool,
  TLArrowTool,
  toolbarItem,
  MenuGroup,
  menuItem,
  TLTranslationKey,
  TL_COLOR_TYPES,
  StateNodeConstructor,
  TLArrowUtil,
  TLArrowShapeProps,
  OnClickHandler,
  Vec2dModel,
  createShapeId,
  TLStore,
  SubMenu,
  OnBeforeCreateHandler,
} from "@tldraw/tldraw";
import {
  Button,
  Classes,
  Dialog,
  // Icon,
  // InputGroup,
  Intent,
  // Position,
  // Tooltip,
} from "@blueprintjs/core";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import "@tldraw/tldraw/editor.css";
import "@tldraw/tldraw/ui.css";
import getSubTree from "roamjs-components/util/getSubTree";
import { AddPullWatch } from "roamjs-components/types";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import createPage from "roamjs-components/writes/createPage";
import fireQuery from "../utils/fireQuery";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import PageInput from "roamjs-components/components/PageInput";
import getDiscourseNodes, { DiscourseNode } from "../utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "../utils/getDiscourseRelations";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { useValue } from "signia-react";
import { RoamOverlayProps } from "roamjs-components/util/renderOverlay";
import findDiscourseNode from "../utils/findDiscourseNode";
import getBlockProps, { normalizeProps } from "../utils/getBlockProps";

declare global {
  interface Window {
    tldrawApps: Record<string, TldrawApp>;
  }
}

type Props = {
  title: string;
  previewEnabled: boolean;
};

const THROTTLE = 350;
const TEXT_TYPE = "&TEX-node";

const discourseContext: {
  nodes: Record<string, DiscourseNode & { index: number }>;
  relations: DiscourseRelation[];
} = { nodes: {}, relations: [] };

type NodeDialogProps = {
  label: string;
  onSuccess: (label: string) => void;
  nodeType: string;
};

const LabelDialog = ({
  isOpen,
  onClose,
  label: _label,
  onSuccess,
  nodeType,
}: RoamOverlayProps<NodeDialogProps>) => {
  const [label, setLabel] = useState(_label);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const onSubmit = () => {
    setLoading(false);
    onSuccess(label);
    onClose();
  };
  useEffect(() => {
    if (nodeType !== TEXT_TYPE) {
      const conditionUid = window.roamAlphaAPI.util.generateUID();
      fireQuery({
        returnNode: "node",
        selections: [],
        conditions: [
          {
            source: "node",
            relation: "is a",
            target: nodeType,
            uid: conditionUid,
            type: "clause",
          },
        ],
      }).then((results) => setOptions(results.map((r) => r.text)));
    }
  }, [nodeType]);
  return (
    <>
      <Dialog
        isOpen={isOpen}
        title={"Edit Discourse Node Label"}
        onClose={onClose}
        canOutsideClickClose
        canEscapeKeyClose
        autoFocus={false}
        className={"roamjs-discourse-playground-dialog"}
      >
        <div className={Classes.DIALOG_BODY}>
          {nodeType !== TEXT_TYPE ? (
            <AutocompleteInput
              value={label}
              setValue={setLabel}
              onConfirm={onSubmit}
              options={options}
              multiline
            />
          ) : (
            <PageInput
              value={label}
              setValue={setLabel}
              onConfirm={onSubmit}
              multiline
            />
          )}
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button text={"Cancel"} onClick={onClose} disabled={loading} />
            <Button
              text={"Set"}
              intent={Intent.PRIMARY}
              onClick={onSubmit}
              disabled={loading}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
};

type DiscourseProps = {
  w: number;
  h: number;
  opacity: TLOpacityType;
  uid: string;
  title: string;
};

type DiscourseNodeShape = TLBaseShape<string, DiscourseProps>;

type DiscourseRelationShape = TLBaseShape<
  string,
  Omit<DiscourseProps, "w" | "h"> & TLArrowShapeProps
>;

const COLOR_ARRAY = Array.from(TL_COLOR_TYPES);
const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 64;

class DiscourseNodeUtil extends TLBoxUtil<DiscourseNodeShape> {
  constructor(app: TldrawApp, type = TEXT_TYPE) {
    super(app, type);
    this.onBeforeCreate = this.onBeforeCreate.bind(this);
  }

  override isAspectRatioLocked = (_shape: DiscourseNodeShape) => false;
  override canResize = (_shape: DiscourseNodeShape) => true;
  override canBind = (_shape: DiscourseNodeShape) => true;
  override canEdit = () => true;

  override defaultProps(): DiscourseNodeShape["props"] {
    return {
      opacity: "1",
      w: 160,
      h: 64,
      uid: window.roamAlphaAPI.util.generateUID(),
      title: "",
    };
  }
  override onBeforeCreate: OnBeforeCreateHandler<DiscourseNodeShape> = (
    shape
  ) => {
    if (!shape.props.title) {
      this.app.setEditingId(shape.id);
    }
  };
  // TODO: onDelete - remove connected edges

  render(shape: DiscourseNodeShape) {
    const discourseNodeIndex = discourseContext.nodes[this.type]?.index ?? -1;
    const { alias, color } =
      discourseContext.nodes[this.type]?.canvasSettings || {};
    const isEditing = useValue(
      "isEditing",
      () => this.app.editingId === shape.id,
      [this.app, shape.id]
    );
    return (
      <HTMLContainer
        id={shape.id}
        className="flex items-center justify-center pointer-events-auto rounded-2xl text-black"
        style={{
          background:
            color ||
            `var(--palette-${
              COLOR_ARRAY[
                discourseNodeIndex >= 0 &&
                discourseNodeIndex < COLOR_ARRAY.length - 1
                  ? discourseNodeIndex + 1
                  : 0
              ]
            })`,
        }}
      >
        <div className="px-8 py-2" style={{ pointerEvents: "all" }}>
          {alias
            ? new RegExp(alias).exec(shape.props.title)?.[1] ||
              shape.props.title
            : shape.props.title}
          <LabelDialog
            isOpen={isEditing}
            onClose={() => {
              this.app.setEditingId(null);
            }}
            label={shape.props.title}
            nodeType={this.type}
            onSuccess={(label) => {
              this.updateProps(shape.id, {
                title: label,
              });
              const oldTitle = getPageTitleByPageUid(shape.props.uid);
              if (oldTitle && oldTitle !== label) {
                window.roamAlphaAPI.updatePage({
                  page: {
                    uid: shape.props.uid,
                    title: label,
                  },
                });
              } else if (isLiveBlock(shape.props.uid)) {
                window.roamAlphaAPI.updateBlock({
                  block: {
                    uid: shape.props.uid,
                    string: label,
                  },
                });
              } else if (!oldTitle) {
                // TODO - this needs to actually be replaced by what we derive the 
                // node creation process to be based on the type
                window.roamAlphaAPI.createPage({
                  page: {
                    title: label,
                    uid: shape.props.uid,
                  },
                });
              }
            }}
          />
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: DiscourseNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  updateProps(
    id: DiscourseNodeShape["id"],
    props: Partial<DiscourseNodeShape["props"]>
  ) {
    // @ts-ignore
    this.app.updateShapes([{ id, props }]);
  }
}

class DiscourseRelationUtil extends TLArrowUtil<DiscourseRelationShape> {
  constructor(app: TldrawApp, type: string) {
    super(app, type);
  }
  defaultProps() {
    const colorIndex = discourseContext.relations.findIndex(
      (r) => r.id === this.type
    );
    const color =
      colorIndex >= 0 && colorIndex < discourseContext.relations.length
        ? COLOR_ARRAY[colorIndex]
        : COLOR_ARRAY[0];
    return {
      opacity: "1" as const,
      dash: "draw" as const,
      size: "m" as const,
      fill: "none" as const,
      color,
      labelColor: color,
      bend: 0,
      start: { type: "point" as const, x: 0, y: 0 },
      end: { type: "point" as const, x: 0, y: 0 },
      arrowheadStart: "none" as const,
      arrowheadEnd: "arrow" as const,
      text: "",
      font: "draw" as const,
      uid: window.roamAlphaAPI.util.generateUID(),
      title: "",
    };
  }
}

const TldrawCanvas = ({ title }: Props) => {
  const serializeRef = useRef(0);
  const deserializeRef = useRef(0);
  const allRelations = useMemo(
    () => (discourseContext.relations = getDiscourseRelations()),
    []
  );
  // TODO: We need to stop splitting a single relation into multiple. Supporting OR solves this.
  const allRelationsById = useMemo(
    () => Object.fromEntries(allRelations.map((r) => [r.id, r])),
    [allRelations]
  );
  const allRelationIds = useMemo(() => {
    return Object.keys(allRelationsById);
  }, [allRelations]);
  const allNodes = useMemo(() => {
    const allNodes = getDiscourseNodes(allRelations);
    discourseContext.nodes = Object.fromEntries(
      allNodes.map((n, index) => [n.type, { ...n, index }])
    );
    return allNodes;
  }, [allRelations]);
  const allNodesWithTextNode = useMemo(
    () =>
      [
        {
          type: TEXT_TYPE,
          shortcut: "t",
          canvasSettings: {} as Record<string, string>,
          text: "Text Node",
        },
      ].concat(allNodes),
    [allNodes]
  );
  const customTldrawConfig = useMemo(
    () =>
      new TldrawEditorConfig({
        tools: allNodesWithTextNode
          .map(
            (n): StateNodeConstructor =>
              class extends TLBoxTool {
                static id = n.type;
                static initial = "idle";
                shapeType = n.type;
                override styles = ["opacity" as const];
              }
          )
          .concat(
            allRelationIds.map(
              (id) =>
                class extends TLArrowTool {
                  static id = id;
                  static initial = "idle";
                  static children = TLArrowTool.children;
                  shapeType = id;
                  override styles = ["opacity" as const];
                }
            )
          ),
        shapes: [
          ...allNodesWithTextNode.map((n) =>
            defineShape<DiscourseNodeShape>({
              type: n.type,
              getShapeUtil: () =>
                class extends DiscourseNodeUtil {
                  constructor(app: TldrawApp) {
                    super(app, n.type);
                  }
                },
            })
          ),
          ...allRelationIds.map((id) =>
            defineShape<DiscourseRelationShape>({
              type: id,
              getShapeUtil: () =>
                class extends DiscourseRelationUtil {
                  constructor(app: TldrawApp) {
                    super(app, id);
                  }
                },
            })
          ),
        ],
        allowUnknownShapes: true,
      }),
    [allNodesWithTextNode]
  );
  const pageUid = useMemo(() => getPageUidByPageTitle(title), [title]);
  const tree = useMemo(() => getBasicTreeByParentUid(pageUid), [pageUid]);
  const appRef = useRef<TldrawApp>();
  const lastInsertRef = useRef<Vec2dModel>();
  const initialState = useMemo(() => {
    const persisted = getSubTree({
      parentUid: pageUid,
      tree,
      key: "State",
    });
    if (!persisted.uid) {
      // we create a block so that the page is not garbage collected
      createBlock({
        node: {
          text: "State",
        },
        parentUid: pageUid,
      });
    }
    const instanceId = TLInstance.createCustomId(pageUid);
    const userId = TLUser.createCustomId(getCurrentUserUid());
    const props = getBlockProps(pageUid);
    const rjsqb = props["roamjs-query-builder"] as Record<string, unknown>;
    const data = rjsqb?.tldraw as Parameters<TLStore["deserialize"]>[0];
    return { instanceId, userId, data };
  }, [tree, pageUid]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [maximized, setMaximized] = useState(false);
  const store = useMemo(() => {
    const _store = customTldrawConfig.createStore({
      initialData: initialState.data,
      instanceId: initialState.instanceId,
      userId: initialState.userId,
    });
    _store.listen((rec) => {
      if (rec.source === "user") {
        clearTimeout(serializeRef.current);
        serializeRef.current = window.setTimeout(() => {
          const state = _store.serialize();
          const props = getBlockProps(pageUid);
          const rjsqb =
            typeof props["roamjs-query-builder"] === "object"
              ? props["roamjs-query-builder"]
              : {};
          window.roamAlphaAPI.updateBlock({
            block: {
              uid: pageUid,
              props: {
                ...props,
                ["roamjs-query-builder"]: {
                  ...rjsqb,
                  tldraw: state,
                },
              },
            },
          });
        }, THROTTLE);
      }
    });
    return _store;
  }, [initialState, serializeRef]);

  useEffect(() => {
    const pullWatchProps: Parameters<AddPullWatch> = [
      "[:edit/user :block/props]",
      `[:block/uid "${pageUid}"]`,
      (_, after) => {
        const props = normalizeProps(after?.[":block/props"] || {});
        const rjsqb = props["roamjs-query-builder"] as Record<string, unknown>;
        const state = rjsqb?.tldraw as Parameters<typeof store.deserialize>[0];
        const editingUser = after?.[":edit/user"]?.[":db/id"];
        if (!state || !editingUser) return;
        const editingUserUid = window.roamAlphaAPI.pull(
          "[:user/uid]",
          editingUser
        )?.[":user/uid"];
        if (
          !editingUserUid ||
          TLUser.createCustomId(editingUserUid) === initialState.userId
        )
          return;
        clearTimeout(deserializeRef.current);
        deserializeRef.current = window.setTimeout(() => {
          store.deserialize(state);
        }, THROTTLE);
      },
    ];
    window.roamAlphaAPI.data.addPullWatch(...pullWatchProps);
    return () => {
      window.roamAlphaAPI.data.removePullWatch(...pullWatchProps);
    };
  }, [initialState, store]);
  useEffect(() => {
    const actionListener = ((
      e: CustomEvent<{
        action: string;
        uid: string;
        val: string;
        onRefresh: () => void;
      }>
    ) => {
      if (!/canvas/i.test(e.detail.action)) return;
      const app = appRef.current;
      if (!app) return;
      const { x, y } = app.pageCenter;
      const { w, h } = app.pageBounds;
      const lastTime = lastInsertRef.current;
      const position = lastTime
        ? {
            x: lastTime.x + w * 0.025,
            y: lastTime.y + h * 0.05,
          }
        : { x: x - DEFAULT_WIDTH / 2, y: y - DEFAULT_HEIGHT / 2 };
      const nodeType = findDiscourseNode(e.detail.uid, allNodes);
      app.createShapes([
        {
          type: nodeType ? nodeType.type : TEXT_TYPE,
          id: createShapeId(),
          props: {
            uid: e.detail.uid,
            title: e.detail.val,
          },
          ...position,
        },
      ]);
      lastInsertRef.current = position;
      e.detail.onRefresh();
    }) as EventListener;
    document.addEventListener("roamjs:query-builder:action", actionListener);
    return () => {
      document.removeEventListener(
        "roamjs:query-builder:action",
        actionListener
      );
    };
  }, [appRef, allNodes]);
  return (
    <div
      className={`border border-gray-300 rounded-md bg-white h-full w-full z-10 overflow-hidden ${
        maximized ? "absolute inset-0" : "relative"
      }`}
      id={`roamjs-tldraw-canvas-container`}
      ref={containerRef}
      tabIndex={-1}
    >
      <style>{`.roam-article .rm-block-children {
  display: none;
}${
        maximized
          ? "div.roam-body div.roam-app div.roam-main div.roam-article { position: inherit; }"
          : ""
      }`}</style>
      <TldrawEditor
        baseUrl="https://samepage.network/assets/tldraw/"
        instanceId={initialState.instanceId}
        userId={initialState.userId}
        config={customTldrawConfig}
        store={store}
        onMount={(app) => {
          if (process.env.NODE_ENV !== "production") {
            if (!window.tldrawApps) window.tldrawApps = {};
            const { tldrawApps } = window;
            tldrawApps[title] = app;
          }
          appRef.current = app;
          app.on("event", (e) => {
            if (
              e.shiftKey &&
              e.shape &&
              e.shape.props?.uid &&
              e.name === "pointer_up"
            ) {
              if (
                !getPageTitleByPageUid(e.shape.props.uid) &&
                !isLiveBlock(e.shape.props.uid)
              ) {
                if (!e.shape.props.title) {
                  return;
                }
                createPage({
                  uid: e.shape.props.uid,
                  title: e.shape.props.title,
                });
              }
              openBlockInSidebar(e.shape.props.uid);
            }
          });
        }}
      >
        <TldrawUi
          assetBaseUrl="https://samepage.network/assets/tldraw/"
          overrides={{
            translations: {
              en: {
                ...Object.fromEntries(
                  allNodesWithTextNode.map((node) => [
                    `shape.node.${node.type}`,
                    node.text,
                  ])
                ),
                ...Object.fromEntries(
                  allRelationIds.map((id) => [
                    `shape.relation.${id}`,
                    allRelationsById[id].label,
                  ])
                ),
                "action.toggle-full-screen": "Toggle Full Screen",
              },
            },
            actions(_app, actions) {
              actions["toggle-full-screen"] = {
                id: "toggle-full-screen",
                label: "action.toggle-full-screen" as TLTranslationKey,
                kbd: "!3",
                onSelect: () => {
                  setMaximized(!maximized);
                },
                readonlyOk: true,
              };
              return actions;
            },
            tools(app, tools) {
              allNodesWithTextNode.forEach((node, index) => {
                tools[node.type] = {
                  id: node.type,
                  icon: "color",
                  label: `shape.node.${node.type}` as TLTranslationKey,
                  kbd: node.shortcut,
                  readonlyOk: true,
                  onSelect: () => {
                    app.setSelectedTool(node.type);
                  },
                  style: {
                    color:
                      node.canvasSettings.color ||
                      `var(--palette-${COLOR_ARRAY[index]})`,
                  },
                };
              });
              allRelationIds.forEach((relation, index) => {
                tools[relation] = {
                  id: relation,
                  icon: "tool-arrow",
                  label: `shape.relation.${relation}` as TLTranslationKey,
                  kbd: "",
                  readonlyOk: true,
                  onSelect: () => {
                    app.setSelectedTool(relation);
                  },
                  style: {
                    color: `var(--palette-${COLOR_ARRAY[index]})`,
                  },
                };
              });
              return tools;
            },
            toolbar(_app, toolbar, { tools }) {
              toolbar.push(
                ...allNodesWithTextNode.map((n) => toolbarItem(tools[n.type])),
                ...allRelationIds.map((id) => toolbarItem(tools[id]))
              );
              return toolbar;
            },
            keyboardShortcutsMenu(_app, keyboardShortcutsMenu, { tools }) {
              const toolsGroup = keyboardShortcutsMenu.find(
                (group) => group.id === "shortcuts-dialog.tools"
              ) as MenuGroup;
              toolsGroup.children.push(
                ...allNodesWithTextNode.map((n) => menuItem(tools[n.type]))
              );
              return keyboardShortcutsMenu;
            },
            menu(_app, menu) {
              const mainMenu = menu.find(
                (m): m is MenuGroup => m.type === "group" && m.id === "menu"
              );
              if (mainMenu) {
                const viewSubMenu = mainMenu.children.find(
                  (m): m is SubMenu => m.type === "submenu" && m.id === "view"
                );
                if (viewSubMenu) {
                  const viewActionsGroup = viewSubMenu.children.find(
                    (m): m is MenuGroup =>
                      m.type === "group" && m.id === "view-actions"
                  );
                  if (viewActionsGroup) {
                    viewActionsGroup.children.push({
                      type: "item",
                      readonlyOk: true,
                      id: "toggle-full-screen",
                      disabled: false,
                      checked: maximized,
                      actionItem: {
                        id: "toggle-full-screen",
                        label: "action.toggle-full-screen" as TLTranslationKey,
                        kbd: "!3",
                        onSelect: () => {
                          setMaximized(!maximized);
                        },
                        readonlyOk: true,
                      },
                    });
                  }
                }
              }
              return menu;
            },
          }}
        >
          <ContextMenu>
            <Canvas />
          </ContextMenu>
        </TldrawUi>
      </TldrawEditor>
    </div>
  );
};

export const renderTldrawCanvas = (title: string) => {
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
    renderWithUnmount(
      <TldrawCanvas title={title} previewEnabled={isFlagEnabled("preview")} />,
      parent
    );
  }
};

export default TldrawCanvas;
