import React, {
  useRef,
  useState,
  useMemo,
  useCallback,
  useContext,
  useEffect,
} from "react";
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
  toolbarItem,
  MenuGroup,
  menuItem,
  OnDoubleClickHandler,
  TLTranslationKey,
  OnTranslateEndHandler,
  TL_COLOR_TYPES,
  TLColorType,
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
import setInputSetting from "roamjs-components/util/setInputSetting";
import getSubTree from "roamjs-components/util/getSubTree";
import { AddPullWatch } from "roamjs-components/types";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import createPage from "roamjs-components/writes/createPage";
import fireQuery from "../utils/fireQuery";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import PageInput from "roamjs-components/components/PageInput";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import getDiscourseNodes, { DiscourseNode } from "../utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "../utils/getDiscourseRelations";

declare global {
  interface Window {
    tldrawApps: Record<string, TldrawApp>;
  }
}

type Props = {
  title: string;
  previewEnabled: boolean;
  globalRefs: { [key: string]: (args: Record<string, string>) => void };
};

const THROTTLE = 350;
const TEXT_TYPE = "&TEX-node";

const discourseContext: {
  nodes: DiscourseNode[];
  relations: DiscourseRelation[];
} = { nodes: [], relations: [] };

type NodeDialogProps = {
  label: string;
  onSuccess: (label: string) => void;
  nodeType: string;
};

const LabelDialog = ({
  onClose,
  label: _label,
  onSuccess,
  nodeType,
}: {
  onClose: () => void;
} & NodeDialogProps) => {
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
        isOpen={true}
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

type DiscourseNodeShape = TLBaseShape<
  "node",
  {
    w: number;
    h: number;
    opacity: TLOpacityType;
    uid: string;
    title: string;
    alias: string;
    // TODO: color will be a proxy to node type, until we could insert our own picker
    color: TLColorType;
    nodeType: string;
  }
>;

const COLOR_ARRAY = Array.from(TL_COLOR_TYPES);

class DiscourseNodeUtil extends TLBoxUtil<DiscourseNodeShape> {
  static type = "node";
  constructor(app: TldrawApp) {
    super(app, "node");
    this.onDoubleClick = this.onDoubleClick.bind(this);
    this.onDoubleClickEdge = this.onDoubleClickEdge.bind(this);
  }

  override isAspectRatioLocked = (_shape: DiscourseNodeShape) => false;
  override canResize = (_shape: DiscourseNodeShape) => true;
  override canBind = (_shape: DiscourseNodeShape) => true;
  override canEdit = () => true;

  // TODO: Figure out a way to add these options to the side menu where opacity is:
  // - Edit alias (AliasDialog)

  override defaultProps(): DiscourseNodeShape["props"] {
    return {
      opacity: "1",
      w: 150,
      h: 150,
      uid: window.roamAlphaAPI.util.generateUID(),
      title: "",
      alias: "",
      color: COLOR_ARRAY[0],
      nodeType: TEXT_TYPE,
    };
  }
  override onDoubleClick: OnDoubleClickHandler<DiscourseNodeShape> = (e) => {
    console.log("onDoubleClick", e);
  };
  override onDoubleClickEdge: OnDoubleClickHandler<DiscourseNodeShape> = (
    shape
  ) => {
    createOverlayRender<NodeDialogProps>(
      "playground-alias",
      LabelDialog
    )({
      label: shape.props.title,
      nodeType: shape.props.nodeType,
      onSuccess: (label) => {
        this.updateProps(shape.id, { title: label });
      },
    });
  };
  override onBeforeCreate = (shape: DiscourseNodeShape) => {
    if (shape.props.color !== COLOR_ARRAY[0]) {
      const index = COLOR_ARRAY.indexOf(shape.props.color);
      if (index <= discourseContext.nodes.length) {
        return {
          ...shape,
          props: {
            ...shape.props,
            nodeType: discourseContext.nodes[index - 1].type,
          },
        };
      }
    }
  };

  // TODO: onDelete - remove connected edges

  render(shape: DiscourseNodeShape) {
    return (
      <HTMLContainer
        id={shape.id}
        className="flex border-4 border-solid items-center justify-center pointer-events-auto rounded-xl"
        onClick={async (e) => {
          if (e.shiftKey) {
            if (!isLiveBlock(shape.props.uid)) {
              if (!shape.props.title) {
                return;
              }
              await createPage({
                uid: shape.props.uid,
                title: shape.props.title,
              });
            }
            openBlockInSidebar(shape.props.uid);
          }
        }}
        style={{
          borderColor: shape.props.color,
        }}
      >
        {shape.props.alias || shape.props.title}
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

const discourseNodeShape = defineShape<DiscourseNodeShape>({
  type: "node",
  getShapeUtil: () => DiscourseNodeUtil,
  // validator: createShapeValidator({ ... })
});

class DiscourseNodeTool extends TLBoxTool {
  static id = "node";
  static initial = "idle";
  shapeType = "node";
  override styles = ["opacity" as const, "color" as const];
}

const customTldrawConfig = new TldrawEditorConfig({
  tools: [DiscourseNodeTool],
  shapes: [discourseNodeShape],
  allowUnknownShapes: true,
});

const TldrawCanvas = ({ title }: Props) => {
  const serializeRef = useRef(0);
  const deserializeRef = useRef(0);
  const allRelations = useMemo(
    () => (discourseContext.relations = getDiscourseRelations()),
    []
  );
  const allNodes = useMemo(
    () => (discourseContext.nodes = getDiscourseNodes(allRelations)),
    [allRelations]
  );
  const pageUid = useMemo(() => getPageUidByPageTitle(title), [title]);
  const tree = useMemo(() => getBasicTreeByParentUid(pageUid), [pageUid]);
  const appRef = useRef<TldrawApp>();
  const initialState = useMemo(() => {
    const persisted = getSubTree({
      parentUid: pageUid,
      tree,
      key: "State",
    });
    const instanceId = TLInstance.createCustomId(pageUid);
    const userId = TLUser.createCustomId(getCurrentUserUid());
    if (!persisted.uid) {
      const uid = window.roamAlphaAPI.util.generateUID();
      createBlock({
        node: {
          text: "State",
          children: [{ text: "", uid }],
        },
        parentUid: pageUid,
      });
      return { instanceId, data: undefined, userId, uid };
    }
    if (!persisted.children.length) {
      const uid = window.roamAlphaAPI.util.generateUID();
      createBlock({
        node: {
          text: "",
          uid,
        },
        parentUid: persisted.uid,
      });
      return { instanceId, data: undefined, userId, uid };
    }
    try {
      return {
        data: JSON.parse(window.atob(persisted.children[0].text || "")),
        instanceId,
        userId,
        uid: persisted.children[0].uid,
      };
    } catch (e) {
      return {
        data: undefined,
        instanceId,
        userId,
        uid: persisted.children[0].uid,
      };
    }
  }, [tree, pageUid]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [maximized, _setMaximized] = useState(false);
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
          setInputSetting({
            blockUid: pageUid,
            key: "State",
            value: window.btoa(JSON.stringify(state)),
          });
        }, THROTTLE);
      }
    });
    return _store;
  }, [initialState, serializeRef]);

  useEffect(() => {
    const props: Parameters<AddPullWatch> = [
      "[:edit/user :block/string]",
      `[:block/uid "${initialState.uid}"]`,
      (_, after) => {
        const state = after?.[":block/string"];
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
          store.deserialize(JSON.parse(window.atob(state)));
        }, THROTTLE);
      },
    ];
    window.roamAlphaAPI.data.addPullWatch(...props);
    return () => {
      window.roamAlphaAPI.data.removePullWatch(...props);
    };
  }, [initialState, store]);
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
        }}
      >
        <TldrawUi
          assetBaseUrl="https://samepage.network/assets/tldraw/"
          overrides={{
            translations: {
              en: {
                "shape.node": "Discourse Node",
              },
            },
            tools(app, tools) {
              tools.node = {
                id: "node",
                icon: "color",
                label: "shape.node" as TLTranslationKey,
                kbd: "n",
                readonlyOk: false,
                onSelect: () => {
                  app.setSelectedTool("node");
                },
              };
              return tools;
            },
            toolbar(_app, toolbar, { tools }) {
              toolbar.splice(4, 0, toolbarItem(tools.node));
              return toolbar;
            },
            keyboardShortcutsMenu(_app, keyboardShortcutsMenu, { tools }) {
              const toolsGroup = keyboardShortcutsMenu.find(
                (group) => group.id === "shortcuts-dialog.tools"
              ) as MenuGroup;
              toolsGroup.children.push(menuItem(tools.node));
              return keyboardShortcutsMenu;
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

export const renderTldrawCanvas = (
  title: string,
  globalRefs: Props["globalRefs"]
) => {
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
      <TldrawCanvas
        title={title}
        globalRefs={globalRefs}
        previewEnabled={isFlagEnabled("preview")}
      />,
      parent
    );
  }
};

export default TldrawCanvas;
