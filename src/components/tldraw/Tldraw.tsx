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
  createNodeShapeTools,
  createNodeShapeUtils,
} from "./DiscourseNode";
import { useRoamStore } from "./useRoamStore";

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

export const loadImage = (
  url: string
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    setTimeout(() => {
      reject(new Error("Image load timeout"));
    }, 3000);

    img.src = url;
  });
};

type Props = {
  title: string;
  previewEnabled: boolean;
};
const TldrawCanvas = ({ title }: Props) => {
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

  const isCustomArrowShape = (shape: TLShape) => {
    // TODO: find a better way to identify custom arrow shapes
    // shape.type or shape.name probably?
    const allRelationIdSet = new Set(allRelationIds);
    const allAddReferencedNodeActionsSet = new Set(allAddReferencedNodeActions);

    return (
      allRelationIdSet.has(shape.type) ||
      allAddReferencedNodeActionsSet.has(shape.type)
    );
  };
  type AddReferencedNodeType = Record<string, ReferenceFormatType[]>;
  type ReferenceFormatType = {
    format: string;
    sourceName: string;
    sourceType: string;
    destinationType: string;
    destinationName: string;
  };
  const allAddReferencedNodeByAction = useMemo(() => {
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
  const allAddReferencedNodeActions = useMemo(() => {
    return Object.keys(allAddReferencedNodeByAction);
  }, [allAddReferencedNodeByAction]);

  const extensionAPI = useExtensionAPI();

  // const isBindingType = (
  //   binding: TLArrowTerminal
  // ): binding is TLArrowTerminal & {
  //   boundShapeId: TLShapeId;
  // } => {
  //   return binding.type === "binding" && !!binding.boundShapeId;
  // };
  // const hasValidBindings = (bindings: TLArrowTerminal[]) => {
  //   return bindings.every(isBindingType);
  // };
  // const compareBindings = (a: TLArrowTerminal, b: TLArrowTerminal) => {
  //   if (isBindingType(a) && isBindingType(b)) {
  //     return a.boundShapeId === b.boundShapeId;
  //   }
  //   return false;
  // };
  // type CancelAndWarnType = {
  //   content: string;
  //   shape: TLShape;
  //   context: Translating | DraggingHandle;
  // };
  // const cancelAndWarn = ({ content, shape, context }: CancelAndWarnType) => {
  //   renderToast({
  //     id: "tldraw-warning",
  //     intent: "warning",
  //     content,
  //   });
  //   context.app.updateShapes([
  //     {
  //       id: shape.id,
  //       type: shape.type,
  //       props: {
  //         ...context.info.shape.props,
  //       },
  //     },
  //   ]);
  // };

  const customShapeUtils = createNodeShapeUtils(allNodes);
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

  const customTools = useMemo(() => {
    const nodes = allNodes.map(createNodeShapeTools);
    // const relations = allRelationNames.map(
    //   (name) =>
    //     class extends TLArrowTool {
    //       static id = name;
    //       static initial = "idle";
    //       static children: typeof TLArrowTool.children = () => {
    //         const [Idle, Pointing] = TLArrowTool.children();
    //         return [
    //           class extends Idle {
    //             override onPointerDown: TLPointerEvent = (info) => {
    //               const cancelAndWarn = (content: string) => {
    //                 renderToast({
    //                   id: "tldraw-warning",
    //                   intent: "warning",
    //                   content,
    //                 });
    //                 this.onCancel();
    //               };
    //               if (info.target !== "shape") {
    //                 return cancelAndWarn("Must start on a node.");
    //               }
    //               const relation = discourseContext.relations[name].find(
    //                 (r) => r.source === info.shape.type
    //               );
    //               if (!relation) {
    //                 return cancelAndWarn(
    //                   `Starting node must be one of ${discourseContext.relations[
    //                     name
    //                   ]
    //                     .map((r) => discourseContext.nodes[r.source].text)
    //                     .join(", ")}`
    //                 );
    //               } else {
    //                 (this.parent as TLArrowTool).shapeType = relation.id;
    //               }
    //               this.parent.transition("pointing", info);
    //             };
    //           },
    //           Pointing,
    //         ];
    //       };
    //       shapeType = name;
    //       override styles = ["opacity" as const];
    //     }
    // );
    // const referencedNodes = Object.keys(allAddReferencedNodeByAction).map(
    //   (action) =>
    //     class extends TLArrowTool {
    //       static id = `${action}` as string;
    //       static initial = "idle";
    //       static children: typeof TLArrowTool.children = () => {
    //         const [Idle, Pointing] = TLArrowTool.children();
    //         return [
    //           class extends Idle {
    //             override onPointerDown: TLPointerEvent = (info) => {
    //               const cancelAndWarn = (content: string) => {
    //                 renderToast({
    //                   id: "tldraw-warning",
    //                   intent: "warning",
    //                   content,
    //                 });
    //                 this.onCancel();
    //               };
    //               if (info.target !== "shape") {
    //                 return cancelAndWarn("Must start on a node.");
    //               }
    //               const sourceType =
    //                 allAddReferencedNodeByAction[action][0].sourceType;
    //               const sourceName =
    //                 allAddReferencedNodeByAction[action][0].sourceName;
    //               if (info.shape.type !== sourceType) {
    //                 return cancelAndWarn(
    //                   `Starting node must be one of ${sourceName}`
    //                 );
    //               } else {
    //                 (this.parent as TLArrowTool).shapeType = `${action}`;
    //               }
    //               this.parent.transition("pointing", info);
    //             };
    //           },
    //           Pointing,
    //         ];
    //       };
    //       shapeType = `${action}`;
    //       override styles = ["opacity" as const];
    //     }
    // );
    // const selectTool = [
    //   class extends TLSelectTool {
    //     // @ts-ignore
    //     static children: typeof TLSelectTool.children = () => {
    //       return TLSelectTool.children().map((c) => {
    //         if (c.id === "translating") {
    //           const Translate = c as unknown as typeof Translating;
    //           return class extends Translate {
    //             override onPointerUp: TLPointerEvent = () => {
    //               this.onComplete({
    //                 type: "misc",
    //                 name: "complete",
    //               });
    //               const shape = this.app.getShapeById(
    //                 this.info.shape?.id // sometimes undefined?
    //               );
    //               if (!shape) return;
    //               if (!isCustomArrowShape(shape)) return;

    //               // Stop accidental arrow reposition
    //               const { start, end } = shape.props as TLArrowShapeProps;
    //               const { end: thisEnd, start: thisStart } = this.info.shape
    //                 .props as TLArrowShapeProps;
    //               const hasPreviousBinding = hasValidBindings([
    //                 thisEnd,
    //                 thisStart,
    //               ]);
    //               const bindingsMatchPrevBindings =
    //                 compareBindings(thisEnd, end) &&
    //                 compareBindings(thisStart, start);
    //               if (hasPreviousBinding && !bindingsMatchPrevBindings) {
    //                 return cancelAndWarn({
    //                   content: "Cannot move relation.",
    //                   shape,
    //                   context: this,
    //                 });
    //               }
    //             };
    //           };
    //         }

    //         if (c.id === "dragging_handle") {
    //           const Handle = c as unknown as typeof DraggingHandle;
    //           const allRelationIdSet = new Set(allRelationIds);
    //           const allAddReferencedNodeActionsSet = new Set(
    //             allAddReferencedNodeActions
    //           );
    //           return class extends Handle {
    //             override onPointerUp: TLPointerEvent = async () => {
    //               this.onComplete({
    //                 type: "misc",
    //                 name: "complete",
    //               });

    //               const shape = this.app.getShapeById(this.shapeId);
    //               if (!shape) return;
    //               if (!isCustomArrowShape(shape)) return;
    //               const arrow = shape;
    //               const {
    //                 start,
    //                 end,
    //                 text: arrowText,
    //               } = arrow.props as TLArrowShapeProps;

    //               const deleteAndWarn = (content: string) => {
    //                 renderToast({
    //                   id: "tldraw-warning",
    //                   intent: "warning",
    //                   content,
    //                 });
    //                 this.app.deleteShapes([arrow.id]);
    //               };

    //               // Allow arrow bend
    //               if (this.info.handle.id === "middle") return;

    //               // Stop accidental handle removal
    //               const { end: thisEnd, start: thisStart } =
    //                 this.info.shape.props;
    //               const hasPreviousBindings = hasValidBindings([
    //                 thisEnd,
    //                 thisStart,
    //               ]);
    //               const bindingsMatchPrevBindings =
    //                 compareBindings(thisEnd, end) &&
    //                 compareBindings(thisStart, start);
    //               if (hasPreviousBindings && !bindingsMatchPrevBindings) {
    //                 return cancelAndWarn({
    //                   content: "Cannot remove handle.",
    //                   shape,
    //                   context: this,
    //                 });
    //               }

    //               // Allow handles to be repositioned in same shape
    //               if (hasPreviousBindings && bindingsMatchPrevBindings) {
    //                 return;
    //               }

    //               if (start.type !== "binding" || end.type !== "binding") {
    //                 return deleteAndWarn("Relation must connect two nodes.");
    //               }
    //               const source = this.app.getShapeById(
    //                 start.boundShapeId
    //               ) as DiscourseNodeShape;
    //               if (!source) {
    //                 return deleteAndWarn("Failed to find source node.");
    //               }
    //               const target = this.app.getShapeById(
    //                 end.boundShapeId
    //               ) as DiscourseNodeShape;
    //               if (!target) {
    //                 return deleteAndWarn("Failed to find target node.");
    //               }

    //               // Handle "Add Referenced Node" Arrows
    //               if (allAddReferencedNodeActionsSet.has(arrow.type)) {
    //                 const possibleTargets = allAddReferencedNodeByAction[
    //                   arrow.type
    //                 ].map((action) => action.destinationType);
    //                 if (!possibleTargets.includes(target.type)) {
    //                   return deleteAndWarn(
    //                     `Target node must be of type ${possibleTargets
    //                       .map((t) => discourseContext.nodes[t].text)
    //                       .join(", ")}`
    //                   );
    //                 }

    //                 // source and target are expected to be pages
    //                 // TODO: support blocks
    //                 const targetTitle = target.props.title;
    //                 const sourceTitle = source.props.title;
    //                 const isTargetTitleCurrent =
    //                   getPageTitleByPageUid(target.props.uid).trim() ===
    //                   targetTitle.trim();
    //                 const isSourceTitleCurrent =
    //                   getPageTitleByPageUid(source.props.uid).trim() ===
    //                   sourceTitle.trim();
    //                 if (!isTargetTitleCurrent || !isSourceTitleCurrent) {
    //                   return deleteAndWarn(
    //                     "Either the source or target node has been renamed. Please update the nodes and try again."
    //                   );
    //                 }

    //                 // Hack for default shipped EVD format: [[EVD]] - {content} - {Source},
    //                 // replace when migrating from format to specification
    //                 let newTitle: string;
    //                 if (targetTitle.endsWith(" - ")) {
    //                   newTitle = `${targetTitle}[[${sourceTitle}]]`;
    //                 } else if (targetTitle.endsWith(" -")) {
    //                   newTitle = `${targetTitle} [[${sourceTitle}]]`;
    //                 } else {
    //                   newTitle = `${targetTitle} - [[${sourceTitle}]]`;
    //                 }

    //                 if (!extensionAPI) {
    //                   return deleteAndWarn(`Failed to update node title.`);
    //                 }

    //                 await window.roamAlphaAPI.data.page.update({
    //                   page: {
    //                     uid: target.props.uid,
    //                     title: newTitle,
    //                   },
    //                 });
    //                 const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
    //                   nodeText: newTitle,
    //                   uid: target.props.uid,
    //                   nodeType: target.type,
    //                   extensionAPI,
    //                 });
    //                 this.app.updateShapes([
    //                   {
    //                     id: target.id,
    //                     type: target.type,
    //                     props: {
    //                       h,
    //                       w,
    //                       imageUrl,
    //                       title: newTitle,
    //                     },
    //                   },
    //                 ]);

    //                 renderToast({
    //                   id: "tldraw-success",
    //                   intent: "success",
    //                   content: `Updated node title.`,
    //                 });

    //                 return;
    //               }

    //               // Handle "Add Relationship Arrows"
    //               if (allRelationIdSet.has(arrow.type)) {
    //                 const relation = allRelationsById[arrow.type];
    //                 if (!relation) return;
    //                 const sourceLabel =
    //                   discourseContext.nodes[relation.source].text;
    //                 if (source.type !== relation.source) {
    //                   return deleteAndWarn(
    //                     `Source node must be of type ${sourceLabel}`
    //                   );
    //                 }
    //                 const possibleTargets = discourseContext.relations[
    //                   relation.label
    //                 ]
    //                   .filter((r) => r.source === relation.source)
    //                   .map((r) => r.destination);
    //                 if (!possibleTargets.includes(target.type)) {
    //                   return deleteAndWarn(
    //                     `Target node must be of type ${possibleTargets
    //                       .map((t) => discourseContext.nodes[t].text)
    //                       .join(", ")}`
    //                   );
    //                 }
    //                 if (arrow.type !== target.type) {
    //                   this.app.updateShapes([
    //                     {
    //                       id: arrow.id,
    //                       type: target.type,
    //                     },
    //                   ]);
    //                 }
    //                 const {
    //                   triples,
    //                   label: relationLabel,
    //                   // complement,
    //                 } = relation;
    //                 const isOriginal = arrowText === relationLabel;
    //                 const newTriples = triples
    //                   .map((t) => {
    //                     if (/is a/i.test(t[1])) {
    //                       const targetNode =
    //                         (t[2] === "source" && isOriginal) ||
    //                         (t[2] === "destination" && !isOriginal)
    //                           ? source
    //                           : target;
    //                       const { title, uid } =
    //                         targetNode.props as DiscourseNodeShape["props"];
    //                       return [
    //                         t[0],
    //                         isPageUid(uid) ? "has title" : "with uid",
    //                         isPageUid(uid) ? title : uid,
    //                       ];
    //                     }
    //                     return t.slice(0);
    //                   })
    //                   .map(([source, relation, target]) => ({
    //                     source,
    //                     relation,
    //                     target,
    //                   }));
    //                 triplesToBlocks({
    //                   defaultPageTitle: `Auto generated from ${title}`,
    //                   toPage: async (
    //                     title: string,
    //                     blocks: InputTextNode[]
    //                   ) => {
    //                     const parentUid =
    //                       getPageUidByPageTitle(title) ||
    //                       (await createPage({
    //                         title: title,
    //                       }));

    //                     await Promise.all(
    //                       blocks.map((node, order) =>
    //                         createBlock({ node, order, parentUid }).catch(() =>
    //                           console.error(
    //                             `Failed to create block: ${JSON.stringify(
    //                               { node, order, parentUid },
    //                               null,
    //                               4
    //                             )}`
    //                           )
    //                         )
    //                       )
    //                     );
    //                     await openBlockInSidebar(parentUid);
    //                   },
    //                   nodeSpecificationsByLabel: Object.fromEntries(
    //                     Object.values(discourseContext.nodes).map((n) => [
    //                       n.text,
    //                       n.specification,
    //                     ])
    //                   ),
    //                 })(newTriples)();
    //               }
    //             };
    //           };
    //         }
    //         return c;
    //       });
    //     };
    //   },
    // ];
    return [
      ...nodes,
      // , ...relations
      // , ...referencedNodes
      // , ...selectTool
    ];
  }, [allNodes, allRelationNames, allAddReferencedNodeByAction]);

  // const relationShapes = allRelationIds.map((id) =>
  //   defineShape<DiscourseRelationShape>({
  //     type: id,
  //     getShapeUtil: () =>
  //       class extends DiscourseRelationUtil {
  //         constructor(app: TldrawApp) {
  //           super(app, id);
  //         }
  //       },
  //   })
  // );
  // const referencedNodeShapes = allAddReferencedNodeActions.map((action) =>
  //   defineShape<DiscourseReferencedNodeShape>({
  //     type: action,
  //     getShapeUtil: () =>
  //       class extends DiscourseReferencedNodeUtil {
  //         constructor(app: TldrawApp) {
  //           super(app, action);
  //         }
  //       },
  //   })
  // );
  // return [
  // ...nodeShapes,
  // , ...relationShapes
  // , ...referencedNodeShapes
  // ];
  // }, [allNodes, allRelationIds, allAddReferencedNodeActions]);

  const defaultComponents = {
    Scribble: TldrawScribble,
    CollaboratorScribble: TldrawScribble,
    SelectionForeground: TldrawSelectionForeground,
    SelectionBackground: TldrawSelectionBackground,
    Handles: TldrawHandles,
    HoveredShapeIndicator: TldrawHoveredShapeIndicator,
  };
  const uiOverrides = createUiOverrides({
    allNodes,
    allAddReferencedNodeActions,
    allRelationNames,
    extensionAPI,
    maximized,
    setMaximized,
    appRef,
  });

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
      .rs-arrow-label__inner{
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
      .rs-arrow-label .rs-arrow-label__inner p {
        padding: 0;
        white-space: nowrap;
        font-family: var(--rs-font-sans);
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
          if (process.env.NODE_ENV !== "production") {
            if (!window.tldrawApps) window.tldrawApps = {};
            const { tldrawApps } = window;
            tldrawApps[title] = app;
          }
          appRef.current = app;
          // TODO - this should move to one of DiscourseNodeTool's children classes instead
          app.on("event", (event) => {
            const e = event as TLPointerEventInfo;
            discourseContext.lastAppEvent = e.name;

            // const validModifier = e.shiftKey || e.ctrlKey || e.metaKey;
            // if (!(e.name === "pointer_up" && e.shape && validModifier)) return;
            // if (app.selectedIds.length) return; // User is positioning selected shape

            // const shapeUid = e.shape?.props.uid;
            // if (!isLiveBlock(shapeUid)) {
            //   if (!e.shape.props.title) return;
            //   renderToast({
            //     id: "tldraw-warning",
            //     intent: "warning",
            //     content: `Not a valid UID. Cannot Open.`,
            //   });
            // }

            // if (e.shiftKey) {
            //   // TODO - do not openBlockInSidebar if user is using shift to select
            //   openBlockInSidebar(e.shape.props.uid);
            // }
            // if (e.ctrlKey || e.metaKey) {
            //   const isPage = !!getPageTitleByPageUid(shapeUid);
            //   if (isPage) {
            //     window.roamAlphaAPI.ui.mainWindow.openPage({
            //       page: { uid: shapeUid },
            //     });
            //   } else {
            //     window.roamAlphaAPI.ui.mainWindow.openBlock({
            //       block: { uid: shapeUid },
            //     });
            //   }
            // }
          });
          // const oldOnBeforeDelete = app.store.onBeforeDelete;
          // app.store.onBeforeDelete = (record) => {
          //   oldOnBeforeDelete?.(record);
          //   if (record.typeName === "shape") {
          //     const util = app.getShapeUtil(record);
          //     if (util instanceof BaseDiscourseNodeUtil) {
          //       util.onBeforeDelete(record as BaseDiscourseNodeUtil);
          //     }
          //   }
          // };
          // const oldOnAfterCreate = app.store.onAfterCreate;
          // app.store.onAfterCreate = (record) => {
          //   oldOnAfterCreate?.(record);
          //   if (record.typeName === "shape") {
          //     const util = app.getShapeUtil(record);
          //     if (util instanceof BaseDiscourseNodeUtil) {
          //       util.onAfterCreate(record as BaseDiscourseNodeUtil);
          //     }
          //   }
          // };
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
