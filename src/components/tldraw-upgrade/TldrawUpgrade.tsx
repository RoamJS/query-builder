import { TldrawEditor, TLPointerEventInfo, Canvas } from "@tldraw/editor";
import {
  TldrawScribble,
  TldrawSelectionForeground,
  TldrawSelectionBackground,
  TldrawHandles,
  TldrawHoveredShapeIndicator,
  defaultShapeUtils,
  defaultTools,
  defaultShapeTools,
  TldrawUi,
  Editor as TldrawApp,
  ContextMenu,
} from "@tldraw/tldraw";
import { VecModel, TLShape, createShapeId } from "@tldraw/tlschema";
import React, { useRef, useState, useMemo, useEffect } from "react";
import ExtensionApiContextProvider, {
  useExtensionAPI,
} from "roamjs-components/components/ExtensionApiContext";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { OnloadArgs } from "roamjs-components/types";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import findDiscourseNode from "../../utils/findDiscourseNode";
import getDiscourseNodes from "../../utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "../../utils/getDiscourseRelations";
import isFlagEnabled from "../../utils/isFlagEnabled";
import {
  createNodeShapeUtils,
  createNodeShapeTools,
} from "../tldraw/DiscourseNode";
import {
  createAllRelationShapeUtils,
  createRelationShapeTools,
  createReferenceShapeTools,
  createSelectTool,
} from "../tldraw/DiscourseReferencedNode";
import { discourseContext, AddReferencedNodeType } from "../tldraw/Tldraw";
import { createUiOverrides } from "../tldraw/uiOverrides";
import { useRoamStore } from "../tldraw/useRoamStore";
import "@tldraw/tldraw/tldraw.css";

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 64;

type TldrawProps = {
  title: string;
  previewEnabled: boolean;
};

const TldrawUpgrade = ({ title }: TldrawProps) => {
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
      <TldrawEditor
        initialState="select"
        shapeUtils={defaultShapeUtils}
        tools={[...defaultTools, ...defaultShapeTools]}
        components={defaultComponents}
        persistenceKey="exploded-example"
      >
        <TldrawUi>
          <ContextMenu>
            <Canvas />
          </ContextMenu>
        </TldrawUi>
      </TldrawEditor>
    </div>
  );
};

export const renderTldrawUpgradeCanvas = (
  title: string,
  onloadArgs: OnloadArgs
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
      <ExtensionApiContextProvider {...onloadArgs}>
        <TldrawUpgrade
          title={title}
          previewEnabled={isFlagEnabled("preview")}
        />
      </ExtensionApiContextProvider>,
      parent
    );
  }
};

export default TldrawUpgrade;
