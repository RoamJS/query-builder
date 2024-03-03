import React, { useRef, useState, useMemo, useEffect } from "react";

// tldraw
import {
  Editor as TldrawApp,
  // defineShape, no longer available
  createTLStore,
  Canvas,
  TldrawEditor,
  ContextMenu,
  TldrawUi,
  TLBaseShape,
  TLOpacityType,
  HTMLContainer,
  toolbarItem,
  menuItem,
  TLArrowShapeProps,
  createShapeId,
  TLStore,
  TLPointerEvent,
  TLRecord,
  TLImageShape,
  TLTextShape,
  //
  // borked
  //
  // Vec2dModel,
  // menu overrides
  // SubMenu,
  // MenuGroup,
  // TLTranslationKey,
  // store
  // default styles
  DefaultSizeStyle,
  DefaultFontFamilies,
  // MenuItem,
  TLShape,
  isShape,
  TLShapeId,
  // config > tools
  // TLBoxTool,
  // TLArrowTool,
  // TLSelectTool,
  // DraggingHandle,
  // StateNodeConstructor,
  // TLArrowTerminal,
  // Translating,
  DefaultColorStyle,
  // custom shape/arrow
  // TLBoxUtil,
  // TLArrowUtil,
  BaseBoxShapeTool,
  TLStateNodeConstructor,
  ShapeUtil,
  Geometry2d,
  Rectangle2d,
  defaultShapeUtils,
  TldrawScribble,
  TldrawHandles,
  TldrawHoveredShapeIndicator,
  TldrawSelectionBackground,
  TldrawSelectionForeground,
  defaultTools,
  defaultShapeTools,
  TLUiOverrides,
  useEditor,
  TLEventInfo,
  TLClickEventInfo,
  TLPointerEventInfo,
  VecModel,
  Editor,
} from "@tldraw/tldraw";
import { SerializedStore, StoreSnapshot } from "@tldraw/store";
import { useValue } from "signia-react";
import "@tldraw/tldraw/tldraw.css";

// roamjs-components
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import getSubTree from "roamjs-components/util/getSubTree";
import {
  AddPullWatch,
  InputTextNode,
  OnloadArgs,
} from "roamjs-components/types";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import createPage from "roamjs-components/writes/createPage";
import updateBlock from "roamjs-components/writes/updateBlock";
import renderToast from "roamjs-components/components/Toast";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import ExtensionApiContextProvider, {
  useExtensionAPI,
} from "roamjs-components/components/ExtensionApiContext";
import setInputSetting from "roamjs-components/util/setInputSetting";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";

// utils
import getDiscourseNodes, {
  DiscourseNode,
} from "../../utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "../../utils/getDiscourseRelations";
import findDiscourseNode from "../../utils/findDiscourseNode";
import getBlockProps, { json, normalizeProps } from "../../utils/getBlockProps";
import triplesToBlocks from "../../utils/triplesToBlocks";
import getDiscourseContextResults from "../../utils/getDiscourseContextResults";
import createDiscourseNode from "../../utils/createDiscourseNode";
import { measureCanvasNodeText } from "../../utils/measureCanvasNodeText";
import calcCanvasNodeSizeAndImg from "../../utils/calcCanvasNodeSizeAndImg";
import { getNewDiscourseNodeText } from "../../utils/formatUtils";
import isFlagEnabled from "../../utils/isFlagEnabled";

// other
import ContrastColor from "contrast-color";
import nanoid from "nanoid";
import LabelDialog from "./TldrawLabelDialog";
import { formatHexColor } from "../DiscourseNodeCanvasSettings";
import { createUiOverrides } from "./uiOverrides";
import {
  BaseDiscourseNodeUtil,
  DiscourseNodeShape,
  createNodeShapeTools,
  createNodeShapeUtils,
} from "./DiscourseNode";
import { useRoamStore } from "./useRoamStore";
import {
  createSelectTool,
  createRelationShapeTools,
  createAllRelationShapeUtils,
  createReferenceShapeTools,
} from "./DiscourseRelations";

declare global {
  interface Window {
    tldrawApps: Record<string, TldrawApp>;
  }
}

export type DiscourseContextType = {
  // { [Node.id] => DiscourseNode }
  nodes: Record<string, DiscourseNode & { index: number }>;
  // { [Relation.Label] => DiscourseRelation[] }
  relations: Record<string, DiscourseRelation[]>;
  lastAppEvent: string;
};

export const discourseContext: DiscourseContextType = {
  nodes: {},
  relations: {},
  lastAppEvent: "",
};

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 64;
export const MAX_WIDTH = "400px";

export const isPageUid = (uid: string) =>
  !!window.roamAlphaAPI.pull("[:node/title]", [":block/uid", uid])?.[
    ":node/title"
  ];

export type AddReferencedNodeType = Record<string, ReferenceFormatType[]>;
type ReferenceFormatType = {
  format: string;
  sourceName: string;
  sourceType: string;
  destinationType: string;
  destinationName: string;
};

type TldrawProps = {
  title: string;
  previewEnabled: boolean;
};
const TldrawCanvas = ({ title }: TldrawProps) => {
  const appRef = useRef<TldrawApp>();
  const containerRef = useRef<HTMLDivElement>(null);
  const lastInsertRef = useRef<VecModel>();

  const [maximized, setMaximized] = useState(false);

  const allRelations = useMemo(() => {
    const relations = getDiscourseRelations();
    discourseContext.relations = relations.reduce((acc, r) => {
      if (acc[r.label]) {
        acc[r.label].push(r);
      } else {
        acc[r.label] = [r];
      }
      return acc;
    }, {} as Record<string, DiscourseRelation[]>);
    return relations;
  }, []);
  const allRelationsById = useMemo(() => {
    return Object.fromEntries(allRelations.map((r) => [r.id, r])) as Record<
      string,
      DiscourseRelation
    >;
  }, [allRelations]);
  const allRelationIds = useMemo(() => {
    return Object.keys(allRelationsById);
  }, [allRelationsById]);
  const allRelationNames = useMemo(() => {
    return Object.keys(discourseContext.relations);
  }, [allRelations]);
  const allNodes = useMemo(() => {
    const allNodes = getDiscourseNodes(allRelations);
    discourseContext.nodes = Object.fromEntries(
      allNodes.map((n, index) => [n.type, { ...n, index }])
    );
    return allNodes;
  }, [allRelations]);
  const allAddRefNodeByAction = useMemo(() => {
    const obj: AddReferencedNodeType = {};

    // TODO: support multiple referenced node
    // with migration from format to specification
    allNodes.forEach((n) => {
      const referencedNodes = [...n.format.matchAll(/{([\w\d-]+)}/g)].filter(
        (match) => match[1] !== "content"
      );

      if (referencedNodes.length > 0) {
        const sourceName = referencedNodes[0][1];
        const sourceType = allNodes.find((node) => node.text === sourceName)
          ?.type as string;

        if (!obj[`Add ${sourceName}`]) obj[`Add ${sourceName}`] = [];

        obj[`Add ${sourceName}`].push({
          format: n.format,
          sourceName,
          sourceType,
          destinationType: n.type,
          destinationName: n.text,
        });
      }
    });

    return obj;
  }, [allNodes]);
  const allAddRefNodeActions = useMemo(() => {
    return Object.keys(allAddRefNodeByAction);
  }, [allAddRefNodeByAction]);

  const extensionAPI = useExtensionAPI();
  if (!extensionAPI) return null;

  const getShapeAtPoint = (app: Editor) => {
    return app.getShapeAtPoint(app.inputs.currentPagePoint, {
      filter: (targetShape) => {
        return (
          !targetShape.isLocked &&
          app.getShapeUtil(targetShape).canBind(targetShape)
        );
      },
      margin: 0,
      hitInside: true,
      renderingOnly: true,
    });
  };
  const isCustomArrowShape = (shape: TLShape) => {
    // TODO: find a better way to identify custom arrow shapes
    // shape.type or shape.name probably?
    const allRelationIdSet = new Set(allRelationIds);
    const allAddReferencedNodeActionsSet = new Set(allAddRefNodeActions);

    return (
      allRelationIdSet.has(shape.type) ||
      allAddReferencedNodeActionsSet.has(shape.type)
    );
  };

  const discourseNodeUtils = createNodeShapeUtils(allNodes);
  const discourseRelationUtils = createAllRelationShapeUtils(allRelationIds);
  const referencedNodeUtils = createAllRelationShapeUtils(allAddRefNodeActions);
  const customShapeUtils = [
    ...discourseNodeUtils,
    ...discourseRelationUtils,
    ...referencedNodeUtils,
  ];

  const discourseNodeTools = createNodeShapeTools(allNodes);
  const discourseRelationTools = createRelationShapeTools(allRelationNames);
  const referencedNodeTools = createReferenceShapeTools(allAddRefNodeByAction);
  const selectTool = createSelectTool({
    isCustomArrowShape,
    allRelationIds,
    allAddRefNodeActions,
    allAddRefNodeByAction,
    extensionAPI,
    allRelationsById,
  });

  const customTools = [
    ...discourseNodeTools,
    ...discourseRelationTools,
    ...referencedNodeTools,
    selectTool,
  ];

  const uiOverrides = createUiOverrides({
    allNodes,
    allRelationNames,
    allAddRefNodeActions,
    allAddRefNodeByAction,
    extensionAPI,
    maximized,
    setMaximized,
    appRef,
    discourseContext,
  });

  const pageUid = useMemo(() => getPageUidByPageTitle(title), [title]);
  const store = useRoamStore({
    customShapeUtils,
    pageUid,
  });

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
      const { x, y } = app.getViewportPageCenter();
      const { w, h } = app.getViewportPageBounds();
      const lastTime = lastInsertRef.current;
      const position = lastTime
        ? {
            x: lastTime.x + w * 0.025,
            y: lastTime.y + h * 0.05,
          }
        : { x: x - DEFAULT_WIDTH / 2, y: y - DEFAULT_HEIGHT / 2 };
      const nodeType = findDiscourseNode(e.detail.uid, allNodes);
      if (nodeType) {
        app.createShapes([
          {
            type: nodeType.type,
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
      }
    }) as EventListener;
    document.addEventListener("roamjs:query-builder:action", actionListener);
    return () => {
      document.removeEventListener(
        "roamjs:query-builder:action",
        actionListener
      );
    };
  }, [appRef, allNodes]);

  const defaultComponents = {
    Scribble: TldrawScribble,
    CollaboratorScribble: TldrawScribble,
    SelectionForeground: TldrawSelectionForeground,
    SelectionBackground: TldrawSelectionBackground,
    Handles: TldrawHandles,
    HoveredShapeIndicator: TldrawHoveredShapeIndicator,
  };

  return (
    <div
      className={`border border-gray-300 rounded-md bg-white h-full w-full z-10 overflow-hidden ${
        maximized ? "absolute inset-0" : "relative"
      }`}
      id={`roamjs-tldraw-canvas-container`}
      ref={containerRef}
      tabIndex={-1}
    >
      <style>
        {`.roam-article .rm-block-children {
        display: none;
      }
      .tl-arrow-label__inner{
        min-width: initial;
      }
      kbd.tlui-kbd {
        background-color: initial;
        box-shadow: initial;
        border-radius: initial;
        padding: initial;
      }${
        maximized
          ? "div.roam-body div.roam-app div.roam-main div.roam-article { position: inherit; }"
          : ""
      }
      #roamjs-tldraw-canvas-container .tl-shape .roamjs-tldraw-node .rm-block-main .rm-block-separator {
        display: none;
      }
      /* arrow label line fix */
      /* seems like width is being miscalculted cause letters to linebreak */
      /* TODO: this is a temporary fix */
      /* also Roam is hijacking the font choice */
      .tl-arrow-label .tl-arrow-label__inner p {
        padding: 0;
        white-space: nowrap;
        font-family: 'tldraw_draw', sans-serif;
      }`}
      </style>
      <TldrawEditor
        // baseUrl="https://samepage.network/assets/tldraw/"
        // instanceId={initialState.instanceId}
        shapeUtils={[...defaultShapeUtils, ...customShapeUtils]}
        tools={[...defaultTools, ...defaultShapeTools, ...customTools]}
        initialState="select"
        components={defaultComponents}
        store={store}
        onMount={(app) => {
          // Handle file uploads
          // app.registerExternalContentHandler("files", (info) => {
          //   console.log(info);

          //   app.putExternalContent({
          //     type: "files",
          //     files: info.files,
          //     ignoreParent: true,
          //   });
          // });

          if (process.env.NODE_ENV !== "production") {
            if (!window.tldrawApps) window.tldrawApps = {};
            const { tldrawApps } = window;
            tldrawApps[title] = app;
          }
          appRef.current = app;
          // TODO - this should move to one of DiscourseNodeTool's children classes instead
          app.on("event", (event) => {
            const e = event as TLPointerEventInfo;
            // tldraw swallowing `onClick`
            if (e.type === "pointer" && e.name === "pointer_down") {
              const element = document.elementFromPoint(e.point.x, e.point.y);
              if (
                element != null &&
                "click" in element &&
                typeof element.click === "function"
              ) {
                element.click();
              }
            }
            discourseContext.lastAppEvent = e.name;
            const validModifier = e.shiftKey || e.ctrlKey; // || e.metaKey;
            if (!(e.name === "pointer_up" && validModifier)) return;
            if (app.getSelectedShapes().length) return; // User is positioning selected shape
            const shape = getShapeAtPoint(app) as DiscourseNodeShape;
            if (!shape) return;
            const shapeUid = shape.props.uid;

            if (!isLiveBlock(shapeUid)) {
              if (!shape.props.title) return;
              renderToast({
                id: "tldraw-warning",
                intent: "warning",
                content: `Not a valid UID. Cannot Open.`,
              });
            }

            if (e.shiftKey) openBlockInSidebar(shapeUid);

            if (
              e.ctrlKey
              // || e.metaKey
            ) {
              const isPage = !!getPageTitleByPageUid(shapeUid);
              if (isPage) {
                window.roamAlphaAPI.ui.mainWindow.openPage({
                  page: { uid: shapeUid },
                });
              } else {
                window.roamAlphaAPI.ui.mainWindow.openBlock({
                  block: { uid: shapeUid },
                });
              }
            }
          });
          const oldOnBeforeDelete = app.store.onBeforeDelete;
          app.store.onBeforeDelete = (record) => {
            oldOnBeforeDelete?.(record, "user");
            if (record.typeName === "shape") {
              const util = app.getShapeUtil(record);
              if (util instanceof BaseDiscourseNodeUtil) {
                util.onBeforeDelete(record as DiscourseNodeShape);
                console.log("oldOnBeforeDelete ran util.onBeforeDelete");
              }
            }
          };
          const oldOnAfterCreate = app.store.onAfterCreate;
          app.store.onAfterCreate = (record) => {
            oldOnAfterCreate?.(record, "user");
            if (record.typeName === "shape") {
              const util = app.getShapeUtil(record);
              if (util instanceof BaseDiscourseNodeUtil) {
                util.onAfterCreate(record as DiscourseNodeShape);
                console.log("oldOnBeforeDelete ran util.oldOnAfterCreate");
              }
            }
          };
        }}
      >
        <TldrawUi
          overrides={uiOverrides}
          // assetBaseUrl="https://samepage.network/assets/tldraw/"
        >
          <ContextMenu>
            <Canvas />
          </ContextMenu>
        </TldrawUi>
      </TldrawEditor>
    </div>
  );
};

export const renderTldrawCanvas = (title: string, onloadArgs: OnloadArgs) => {
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
      <ExtensionApiContextProvider {...onloadArgs}>
        <TldrawCanvas title={title} previewEnabled={isFlagEnabled("preview")} />
      </ExtensionApiContextProvider>,
      parent
    );
  }
};

export default TldrawCanvas;
