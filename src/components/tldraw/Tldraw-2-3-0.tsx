import React, { useState, useRef, useMemo, useEffect } from "react";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
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
} from "tldraw";
import "tldraw/tldraw.css";
import tldrawStyles from "./tldrawStyles";
import getDiscourseNodes, {
  DiscourseNode,
} from "../../utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "../../utils/getDiscourseRelations";
import { createUiComponents, createUiOverrides } from "./uiOverrides";
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
  const [maximized, setMaximized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const uiOverrides = createUiOverrides({
    allNodes,
    // allRelationNames,
    // allAddRefNodeActions,
    // allAddRefNodeByAction,
    // extensionAPI,
    // maximized,
    // setMaximized,
    // appRef,
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

  function renderToast(arg0: { id: string; intent: string; content: string }) {
    throw new Error("Function not implemented.");
  }

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
      {/* <Tldraw components={components} /> */}
      <TldrawEditor
        // baseUrl="https://samepage.network/assets/tldraw/"
        // instanceId={initialState.instanceId}
        initialState="select"
        shapeUtils={[...defaultShapeUtils, ...customShapeUtils]}
        bindingUtils={defaultBindingUtils}
        tools={[...defaultTools, ...defaultShapeTools, ...customTools]}
        components={defaultEditorComponents}
        store={store}
        onMount={(app) => {
          app.on("event", (event) => {
            const e = event as TLPointerEventInfo;
            appRef.current = app;

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
        <TldrawUi
          overrides={uiOverrides}
          components={customUiComponents}
          // assetBaseUrl="https://samepage.network/assets/tldraw/"
        >
          <ContextMenu>
            <DefaultContextMenuContent />
          </ContextMenu>
        </TldrawUi>
      </TldrawEditor>
    </div>
  );
};

export const renderTldrawCanvas = (title: string, onloadArgs: OnloadArgs) => {
  console.log("renderTldrawCanvas");
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
        {
          <TldrawCanvas
            title={title}
            previewEnabled={isFlagEnabled("preview")}
          />
        }
      </ExtensionApiContextProvider>,
      parent
    );
  }
};
