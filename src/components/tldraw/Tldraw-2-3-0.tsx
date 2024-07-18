import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import ExtensionApiContextProvider, {
  useExtensionAPI,
} from "roamjs-components/components/ExtensionApiContext";
import { OnloadArgs } from "roamjs-components/types";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import isFlagEnabled from "../../utils/isFlagEnabled";

import {
  Editor as TldrawApp,
  ContextMenu,
  DefaultContextMenuContent,
  DefaultToolbar,
  DefaultToolbarContent,
  TLComponents,
  TLEditorComponents,
  TLUiComponents,
  Tldraw,
  TldrawEditor,
  TldrawHandles,
  TldrawScribble,
  TldrawSelectionBackground,
  TldrawSelectionForeground,
  TldrawUi,
  TldrawUiMenuItem,
  defaultBindingUtils,
  defaultShapeTools,
  defaultShapeUtils,
  defaultTools,
  useEditor,
  useIsToolSelected,
  useTools,
  VecModel,
  createShapeId,
  TLPointerEventInfo,
  Editor,
  TLExternalContent,
  MediaHelpers,
  AssetRecordType,
  TLAsset,
  TLAssetId,
  getHashForString,
  TLUiContextMenuProps,
  TLShapeId,
} from "tldraw";
import "tldraw/tldraw.css";
import tldrawStyles from "./tldrawStyles";
import getDiscourseNodes, {
  DiscourseNode,
} from "../../utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "../../utils/getDiscourseRelations";
import {
  CustomContextMenu,
  createUiComponents,
  createUiOverrides,
} from "./uiOverrides";
import {
  DiscourseNodeShape,
  createNodeShapeTools,
  createNodeShapeUtils,
} from "./DiscourseNodeUtil";
import { useRoamStore } from "./useRoamStore";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import findDiscourseNode from "../../utils/findDiscourseNode";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import renderToast from "roamjs-components/components/Toast";

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

const TldrawCanvas = ({
  title,
  previewEnabled,
}: {
  title: string;
  previewEnabled: boolean;
}) => {
  const appRef = useRef<TldrawApp>();
  const lastInsertRef = useRef<VecModel>();
  const containerRef = useRef<HTMLDivElement>(null);

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
  const allNodes = useMemo(() => {
    const allNodes = getDiscourseNodes(allRelations);
    discourseContext.nodes = Object.fromEntries(
      allNodes.map((n, index) => [n.type, { ...n, index }])
    );
    return allNodes;
  }, [allRelations]);

  const defaultEditorComponents: TLEditorComponents = {
    Scribble: TldrawScribble,
    CollaboratorScribble: TldrawScribble,
    SelectionForeground: TldrawSelectionForeground,
    SelectionBackground: TldrawSelectionBackground,
    Handles: TldrawHandles,
  };
  const discourseNodeUtils = createNodeShapeUtils(allNodes);

  const customShapeUtils = [
    ...discourseNodeUtils,
    // ...discourseRelationUtils,
    // ...referencedNodeUtils,
  ];

  const discourseNodeTools = createNodeShapeTools(allNodes);

  const customTools = [
    ...discourseNodeTools,
    // ...discourseRelationTools,
    // ...referencedNodeTools,
    // selectTool,
  ];

  const extensionAPI = useExtensionAPI();
  if (!extensionAPI) return null;

  const uiOverrides = createUiOverrides({
    allNodes,
    // allRelationNames,
    // allAddRefNodeActions,
    // allAddRefNodeByAction,
    // extensionAPI,
    maximized,
    setMaximized,
    // discourseContext,
  });

  const customUiComponents: TLUiComponents = createUiComponents({
    allNodes,
  });

  const pageUid = useMemo(() => getPageUidByPageTitle(title), [title]);
  const store = useRoamStore({
    customShapeUtils,
    pageUid,
  });

  // Handle actions (roamjs:query-builder:action)
  useEffect(() => {
    const handleMoveCameraToShapeAction = ({
      shapeId,
    }: {
      shapeId: TLShapeId;
    }) => {
      const app = appRef.current;
      if (!app) return;
      const shape = app.getShape(shapeId);
      if (!shape) {
        return renderToast({
          id: "tldraw-warning",
          intent: "warning",
          content: `Shape not found.`,
        });
      }
      const x = shape?.x || 0;
      const y = shape?.y || 0;
      app.centerOnPoint({ x, y }, { animation: { duration: 200 } });
      app.select(shapeId);
    };
    const actionListener = ((
      e: CustomEvent<{
        action: string;
        uid?: string;
        val?: string;
        shapeId?: TLShapeId;
        onRefresh: () => void;
      }>
    ) => {
      if (e.detail.action === "move-camera-to-shape") {
        if (!e.detail.shapeId) return;
        handleMoveCameraToShapeAction({ shapeId: e.detail.shapeId });
      }
      if (!/canvas/i.test(e.detail.action)) return;
      const app = appRef.current;
      if (!app) return;
      const { x, y } = app.getViewportScreenCenter();
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

  // https://tldraw.dev/examples/data/assets/hosted-images
  const ACCEPTED_IMG_TYPE = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/svg+xml",
  ];
  const isImage = (ext: string) => ACCEPTED_IMG_TYPE.includes(ext);
  const handlePastedImages = useCallback((editor: Editor) => {
    editor.registerExternalContentHandler(
      "files",
      async (content: TLExternalContent) => {
        if (content.type !== "files") {
          console.error("Expected files, received:", content.type);
          return;
        }
        const file = content.files[0];

        //@ts-ignore
        const url = await window.roamAlphaAPI.file.upload({
          file,
          toast: {
            hide: true,
          },
        });
        const dataUrl = url.replace(/^!\[\]\(/, "").replace(/\)$/, "");
        // TODO add video support
        const isImageType = isImage(file.type);
        if (!isImageType) {
          console.error("Unsupported file type:", file.type);
          return;
        }
        const size = await MediaHelpers.getImageSize(file);
        const isAnimated = await MediaHelpers.isAnimated(file);
        const assetId: TLAssetId = AssetRecordType.createId(
          getHashForString(dataUrl)
        );
        const shapeType = isImageType ? "image" : "video";
        const asset: TLAsset = AssetRecordType.create({
          id: assetId,
          type: shapeType,
          typeName: "asset",
          props: {
            name: file.name,
            src: dataUrl,
            w: size.w,
            h: size.h,
            fileSize: file.size,
            mimeType: file.type,
            isAnimated,
          },
        });
        editor.createAssets([asset]);
        editor.createShape({
          type: "image",
          // Center the image in the editor
          x: (window.innerWidth - size.w) / 2,
          y: (window.innerHeight - size.h) / 2,
          props: {
            assetId,
            w: size.w,
            h: size.h,
          },
        });

        return asset;
      }
    );
  }, []);

  return (
    <div
      className={`border border-gray-300 rounded-md bg-white h-full w-full z-10 overflow-hidden 
        ${maximized ? "absolute inset-0" : "relative"}`}
      id={`roamjs-tldraw-canvas-container`}
      ref={containerRef}
      tabIndex={-1}
    >
      <style>{tldrawStyles}</style>
      <style>
        {maximized
          ? "div.roam-body div.roam-app div.roam-main div.roam-article { position: inherit; }"
          : ""}
      </style>
      <TldrawEditor
        // baseUrl="https://samepage.network/assets/tldraw/"
        // instanceId={initialState.instanceId}
        shapeUtils={[...defaultShapeUtils, ...customShapeUtils]}
        tools={[...defaultTools, ...defaultShapeTools, ...customTools]}
        initialState="select"
        components={defaultEditorComponents}
        store={store}
        onMount={(app) => {
          appRef.current = app;

          handlePastedImages(app);

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

            // handle node clicked with modifiers
            // navigate / open in sidebar
            const validModifier = e.shiftKey || e.ctrlKey; // || e.metaKey;
            if (!(e.name === "pointer_up" && validModifier)) return;
            if (app.getSelectedShapes().length) return; // User is positioning selected shape
            const shape = app.getShapeAtPoint(
              app.inputs.currentPagePoint
            ) as DiscourseNodeShape;
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
        }}
      >
        <TldrawUi overrides={uiOverrides} components={customUiComponents}>
          <CustomContextMenu extensionAPI={extensionAPI} allNodes={allNodes} />
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