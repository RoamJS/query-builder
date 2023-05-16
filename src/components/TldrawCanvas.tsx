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
  TLSelectTool,
  DraggingHandle,
  toolbarItem,
  MenuGroup,
  menuItem,
  TLTranslationKey,
  TL_COLOR_TYPES,
  StateNodeConstructor,
  TLArrowUtil,
  TLArrowShapeProps,
  Vec2dModel,
  createShapeId,
  TLStore,
  SubMenu,
  TLPointerEvent,
} from "@tldraw/tldraw";
import {
  Button,
  Classes,
  Dialog,
  // Icon,
  // InputGroup,
  Intent,
  // Position,
  Spinner,
  SpinnerSize,
  TextArea,
  // Tooltip,
} from "@blueprintjs/core";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import "@tldraw/tldraw/editor.css";
import "@tldraw/tldraw/ui.css";
import getSubTree from "roamjs-components/util/getSubTree";
import {
  AddPullWatch,
  InputTextNode,
  RoamBasicNode,
} from "roamjs-components/types";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import createPage from "roamjs-components/writes/createPage";
import fireQuery from "../utils/fireQuery";
import getDiscourseNodes, { DiscourseNode } from "../utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "../utils/getDiscourseRelations";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { useValue } from "signia-react";
import { RoamOverlayProps } from "roamjs-components/util/renderOverlay";
import findDiscourseNode from "../utils/findDiscourseNode";
import getBlockProps, { normalizeProps } from "../utils/getBlockProps";
import { QBClause } from "../utils/types";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import renderToast from "roamjs-components/components/Toast";

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
  onSuccess: (label: string) => Promise<void>;
  nodeType: string;
};

const LabelDialog = ({
  isOpen,
  onClose,
  label: _label,
  onSuccess,
  nodeType,
}: RoamOverlayProps<NodeDialogProps>) => {
  const [error, setError] = useState("");
  const defaultValue = useMemo(() => {
    if (_label) return _label;
    if (nodeType === TEXT_TYPE) return "";
    const { specification, text } = discourseContext.nodes[nodeType];
    if (!specification.length) return "";
    // CURRENT ASSUMPTIONS:
    // - conditions are properly ordered
    // - there is a has title condition somewhere
    const titleCondition = specification.find(
      (s): s is QBClause =>
        s.type === "clause" && s.relation === "has title" && s.source === text
    );
    if (!titleCondition) return "";
    return titleCondition.target
      .replace(/^\/(\^)?/, "")
      .replace(/(\$)?\/$/, "")
      .replace(/\\\[/g, "[")
      .replace(/\\\]/g, "]")
      .replace(/\(\.[\*\+](\?)?\)/g, "");
  }, [_label, nodeType]);
  const [label, setLabel] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const onSubmit = () => {
    setLoading(true);
    onSuccess(label)
      .then(onClose)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
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
          <TextArea
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSubmit();
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            autoFocus
          />
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={`${Classes.DIALOG_FOOTER_ACTIONS} items-center`}>
            {error && <span className={"text-red-800"}>{error}</span>}
            {loading && <Spinner size={SpinnerSize.SMALL} />}
            <Button
              text={"Cancel"}
              onClick={onClose}
              disabled={loading}
              className="flex-shrink-0"
            />
            <Button
              text={"Set"}
              intent={Intent.PRIMARY}
              onClick={onSubmit}
              disabled={loading}
              className="flex-shrink-0"
            />
          </div>
        </div>
      </Dialog>
    </>
  );
};

type DiscourseNodeShape = TLBaseShape<
  string,
  {
    w: number;
    h: number;
    opacity: TLOpacityType;
    uid: string;
    title: string;
  }
>;

type DiscourseRelationShape = TLBaseShape<string, TLArrowShapeProps>;

const COLOR_ARRAY = Array.from(TL_COLOR_TYPES);
const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 64;

class DiscourseNodeUtil extends TLBoxUtil<DiscourseNodeShape> {
  constructor(app: TldrawApp, type = TEXT_TYPE) {
    super(app, type);
  }

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;
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
  // TODO: onDelete - remove connected edges

  render(shape: DiscourseNodeShape) {
    const {
      canvasSettings: { alias = "", color = "" } = {},
      index: discourseNodeIndex = -1,
    } = discourseContext.nodes[this.type] || {};
    const isEditing = useValue(
      "isEditing",
      () => this.app.editingId === shape.id,
      [this.app, shape.id]
    );
    useEffect(() => {
      if (!shape.props.title) {
        this.app.setEditingId(shape.id);
      }
    }, [shape.props.title, shape.id]);
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
            onSuccess={async (label) => {
              const oldTitle = getPageTitleByPageUid(shape.props.uid);
              if (oldTitle && oldTitle !== label) {
                await window.roamAlphaAPI.updatePage({
                  page: {
                    uid: shape.props.uid,
                    title: label,
                  },
                });
              } else if (isLiveBlock(shape.props.uid)) {
                await updateBlock({
                  uid: shape.props.uid,
                  text: label,
                });
              } else if (!oldTitle) {
                // TODO: consolidate with DiscourseNodeMenu and replace with Smartblocks
                const nodeTree = getFullTreeByParentUid(shape.type).children;
                const template = getSubTree({
                  tree: nodeTree,
                  key: "template",
                }).children;
                const stripUid = (n: RoamBasicNode[]): InputTextNode[] =>
                  n.map(({ uid, children, ...c }) => ({
                    ...c,
                    children: stripUid(children),
                  }));
                const tree = stripUid(template);
                await createPage({
                  title: label,
                  uid: shape.props.uid,
                  tree,
                });
              }
              this.updateProps(shape.id, {
                title: label,
              });
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
  override canBind = () => true;
  override canEdit = () => false;
  defaultProps() {
    // TODO - add canvas settings to relations config and turn
    // discourseContext.relations into a map
    const relationIndex = discourseContext.relations.findIndex(
      (r) => r.id === this.type
    );
    const isValid =
      relationIndex >= 0 && relationIndex < discourseContext.relations.length;
    const color = isValid ? COLOR_ARRAY[relationIndex + 1] : COLOR_ARRAY[0];
    return {
      opacity: "1" as const,
      dash: "draw" as const,
      size: "s" as const,
      fill: "none" as const,
      color,
      labelColor: color,
      bend: 0,
      start: { type: "point" as const, x: 0, y: 0 },
      end: { type: "point" as const, x: 0, y: 0 },
      arrowheadStart: "none" as const,
      arrowheadEnd: "arrow" as const,
      text: isValid ? discourseContext.relations[relationIndex].label : "",
      font: "mono" as const,
    };
  }
  override onBeforeCreate = (shape: DiscourseRelationShape) => {
    // TODO - propsForNextShape is clobbering our choice of color
    const relationIndex = discourseContext.relations.findIndex(
      (r) => r.id === this.type
    );
    const isValid =
      relationIndex >= 0 && relationIndex < discourseContext.relations.length;
    const color = isValid ? COLOR_ARRAY[relationIndex + 1] : COLOR_ARRAY[0];
    return {
      ...shape,
      props: {
        ...shape.props,
        color,
        labelColor: color,
      },
    };
  };
  render(shape: DiscourseRelationShape) {
    return (
      <>
        <style>{`#${shape.id.replace(":", "_")}_clip_0 {
  display: none;
}
[data-shape-type="${this.type}"] .rs-arrow-label {
  left: 0;
  top: 0;
  width: unset;
  height: unset;
}
`}</style>
        {super.render(shape)}
      </>
    );
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
                  static children: typeof TLArrowTool.children = () => {
                    const [Idle, Pointing] = TLArrowTool.children();
                    return [
                      class extends Idle {
                        override onPointerDown: TLPointerEvent = (info) => {
                          const cancelAndWarn = (content: string) => {
                            renderToast({
                              id: "tldraw-warning",
                              intent: "warning",
                              content,
                            });
                            this.onCancel();
                          };
                          if (info.target !== "shape") {
                            return cancelAndWarn("Must start on a node.");
                          }
                          const { source } = allRelationsById[id];
                          if (source !== info.shape.type) {
                            const sourceLabel =
                              discourseContext.nodes[source].text;
                            return cancelAndWarn(
                              `Starting node must be of type ${sourceLabel}`
                            );
                          }
                          this.parent.transition("pointing", info);
                        };
                      },
                      Pointing,
                    ];
                  };
                  shapeType = id;
                  override styles = ["opacity" as const];
                }
            )
          )
          .concat([
            class extends TLSelectTool {
              // @ts-ignore
              static children: typeof TLSelectTool.children = () => {
                return TLSelectTool.children().map((c) => {
                  if (c.id === "dragging_handle") {
                    const Handle = c as unknown as typeof DraggingHandle;
                    return class extends Handle {
                      override onPointerUp: TLPointerEvent = (info) => {
                        this.onComplete({
                          type: "misc",
                          name: "complete",
                        });
                        const arrow = this.app.getShapeById(this.shapeId);
                        if (!arrow) return;
                        const relation = discourseContext.relations.find(
                          (r) => r.id === arrow.type
                        );
                        if (!relation) return;
                        const { start, end } = arrow.props as TLArrowShapeProps;
                        const deleteAndWarn = (content: string) => {
                          renderToast({
                            id: "tldraw-warning",
                            intent: "warning",
                            content,
                          });
                          this.app.deleteShapes([arrow.id]);
                        };
                        if (
                          start.type !== "binding" ||
                          end.type !== "binding"
                        ) {
                          return deleteAndWarn(
                            "Relation must connect two nodes."
                          );
                        }
                        const source = this.app.getShapeById(
                          start.boundShapeId
                        );
                        if (!source) {
                          return deleteAndWarn("Failed to find source node.");
                        }
                        const target = this.app.getShapeById(end.boundShapeId);
                        if (!target) {
                          return deleteAndWarn("Failed to find target node.");
                        }
                        const sourceLabel =
                          discourseContext.nodes[relation.source].text;
                        if (source.type !== relation.source) {
                          return deleteAndWarn(
                            `Source node must be of type ${sourceLabel}`
                          );
                        }
                        const targetLabel =
                          discourseContext.nodes[relation.destination].text;
                        if (target.type !== relation.destination) {
                          return deleteAndWarn(
                            `Target node must be of type ${targetLabel}`
                          );
                        }
                        // TODO - Generate Roam Representation of new relation!
                      };
                    };
                  }
                  return c;
                });
              };
            },
          ]),
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
    [allNodesWithTextNode, allRelationIds, allRelationsById]
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
      if (rec.source !== "user") return;
      const validChanges = Object.keys(rec.changes.added)
        .concat(Object.keys(rec.changes.removed))
        .concat(Object.keys(rec.changes.updated))
        .filter(
          (k) =>
            !/^(user_presence|camera|instance|instance_page_state):/.test(k)
        );
      if (!validChanges.length) return;
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
          store.mergeRemoteChanges(() => {
            store.deserialize(state);
          });
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
                    color: `var(--palette-${COLOR_ARRAY[index + 1]})`,
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
