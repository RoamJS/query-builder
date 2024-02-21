import {
  TLArrowShape,
  ArrowShapeUtil,
  ArrowShapeTool,
  TLPointerEvent,
  TLBaseShape,
  TLArrowShapeProps,
  SelectTool,
  useEditor,
  Editor,
  Translating,
  TLShape,
  DraggingHandle,
  TLShapeId,
  VecModel,
} from "@tldraw/tldraw";
import { AddReferencedNodeType, discourseContext, isPageUid } from "./Tldraw";
import React from "react";
import { COLOR_ARRAY, DiscourseNodeShape } from "./DiscourseNode";
import { render as renderToast } from "roamjs-components/components/Toast";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { InputTextNode, OnloadArgs } from "roamjs-components/types";
import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import calcCanvasNodeSizeAndImg from "../../utils/calcCanvasNodeSizeAndImg";
import getDiscourseRelations, {
  DiscourseRelation,
} from "../../utils/getDiscourseRelations";
import triplesToBlocks from "../../utils/triplesToBlocks";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";

export const createRelationShapeTools = (allRelationNames: string[]) => {
  return allRelationNames.map(
    (name) =>
      class extends ArrowShapeTool {
        static id = name;
        static initial = "idle";
        static children: typeof ArrowShapeTool.children = () => {
          const [Idle, Pointing] = ArrowShapeTool.children();
          return [
            class extends Idle {
              override onPointerDown: TLPointerEvent = (info) => {
                const target = this.editor.getShapeAtPoint(
                  this.editor.inputs.currentPagePoint,
                  {
                    filter: (targetShape) => {
                      return (
                        !targetShape.isLocked &&
                        this.editor
                          .getShapeUtil(targetShape)
                          .canBind(targetShape)
                      );
                    },
                    margin: 0,
                    hitInside: true,
                    renderingOnly: true,
                  }
                );
                if (!target) return;
                const cancelAndWarn = (content: string) => {
                  renderToast({
                    id: "tldraw-warning",
                    intent: "warning",
                    content,
                  });
                  this.onCancel();
                };
                if (target.typeName !== "shape") {
                  return cancelAndWarn("Must start on a node.");
                }
                const relation = discourseContext.relations[name].find(
                  (r) => r.source === target.type
                );
                if (!relation) {
                  return cancelAndWarn(
                    `Starting node must be one of ${discourseContext.relations[
                      name
                    ]
                      .map((r) => discourseContext.nodes[r.source].text)
                      .join(", ")}`
                  );
                } else {
                  (this.parent as ArrowShapeTool).shapeType = relation.id;
                }
                this.parent.transition("pointing", info);
              };
            },
            Pointing,
          ];
        };
        // shapeType = name; // error on tool select
        // override styles = ["opacity" as const];
      }
  );
};
export const createReferenceShapeTools = (
  allAddRefNodeByAction: AddReferencedNodeType
) => {
  return Object.keys(allAddRefNodeByAction).map(
    (action) =>
      class extends ArrowShapeTool {
        static id = `${action}` as string;
        static initial = "idle";
        static children: typeof ArrowShapeTool.children = () => {
          const [Idle, Pointing] = ArrowShapeTool.children();
          return [
            class extends Idle {
              override onPointerDown: TLPointerEvent = (info) => {
                const target = this.editor.getShapeAtPoint(
                  this.editor.inputs.currentPagePoint,
                  {
                    filter: (targetShape) => {
                      return (
                        !targetShape.isLocked &&
                        this.editor
                          .getShapeUtil(targetShape)
                          .canBind(targetShape)
                      );
                    },
                    margin: 0,
                    hitInside: true,
                    renderingOnly: true,
                  }
                );
                if (!target) return;
                const cancelAndWarn = (content: string) => {
                  renderToast({
                    id: "tldraw-warning",
                    intent: "warning",
                    content,
                  });
                  this.onCancel();
                };
                if (target.typeName !== "shape") {
                  return cancelAndWarn("Must start on a node.");
                }
                const possibleTargets = allAddRefNodeByAction[action].map(
                  (action) => action.destinationType
                );
                if (!possibleTargets.includes(target.type)) {
                  return cancelAndWarn(
                    `Target node must be of type ${possibleTargets
                      .map((t) => discourseContext.nodes[t].text)
                      .join(", ")}`
                  );
                }
                this.parent.transition("pointing", info);
              };
            },
            Pointing,
          ];
        };
        shapeType = `${action}`;
        // override styles = ["opacity" as const];
      }
  );
};
type BindingType =
  | {
      type: "binding";
      boundShapeId: TLShapeId;
      normalizedAnchor: VecModel;
      isExact: boolean;
      isPrecise: boolean;
    }
  | {
      type: "point";
      x: number;
      y: number;
    };
const isBindingType = (
  binding: BindingType
): binding is BindingType & { boundShapeId: TLShapeId } => {
  return binding.type === "binding" && !!binding.boundShapeId;
};
const hasValidBindings = (bindings: BindingType[]): boolean => {
  return bindings.every(isBindingType);
};

const compareBindings = (a: BindingType, b: BindingType): boolean => {
  if (isBindingType(a) && isBindingType(b)) {
    return a.boundShapeId === b.boundShapeId;
  }
  return false;
};
type CancelAndWarnType = {
  content: string;
  shape: TLShape;
  context: Translating | DraggingHandle;
};
const cancelWarnAndUpdate = ({
  content,
  shape,
  context,
}: CancelAndWarnType) => {
  renderToast({
    id: "tldraw-warning",
    intent: "warning",
    content,
  });
  context.editor.updateShapes([
    {
      id: shape.id,
      type: shape.type,
      props: {
        ...context.info.shape.props,
      },
    },
  ]);
};

export const createSelectTool = ({
  isCustomArrowShape,
  allRelationIds,
  allAddRefNodeActions,
  allAddRefNodeByAction,
  extensionAPI,
  allRelationsById,
}: {
  isCustomArrowShape: (shape: TLShape) => boolean;
  allRelationIds: string[];
  allAddRefNodeActions: string[];
  allAddRefNodeByAction: AddReferencedNodeType;
  extensionAPI: OnloadArgs["extensionAPI"];
  allRelationsById: Record<string, DiscourseRelation>;
}) =>
  class extends SelectTool {
    static id = "new-select-tool";
    static children: typeof SelectTool.children = () => {
      return SelectTool.children().map((c) => {
        if (c.id === "translating") {
          const Translate = c as unknown as typeof Translating;
          return class extends Translate {
            override onPointerUp: TLPointerEvent = () => {
              this.onComplete({
                type: "misc",
                name: "complete",
              });
              const shape = this.editor.getShape(
                this.info.shape?.id // sometimes undefined?
              );
              if (!shape) return;
              if (!isCustomArrowShape(shape)) return;

              // Stop accidental arrow reposition
              const { start, end } = shape.props as TLArrowShapeProps;
              const { end: thisEnd, start: thisStart } = this.info.shape
                .props as TLArrowShapeProps;
              const hasPreviousBinding = hasValidBindings([thisEnd, thisStart]);
              const bindingsMatchPrevBindings =
                compareBindings(thisEnd, end) &&
                compareBindings(thisStart, start);
              if (hasPreviousBinding && !bindingsMatchPrevBindings) {
                return cancelWarnAndUpdate({
                  content: "Cannot move relation.",
                  shape,
                  context: this,
                });
              }
            };
          };
        }

        if (c.id === "dragging_handle") {
          const Handle = c as unknown as typeof DraggingHandle;
          const allRelationIdSet = new Set(allRelationIds);
          const allAddReferencedNodeActionsSet = new Set(allAddRefNodeActions);
          return class extends Handle {
            override onPointerUp: TLPointerEvent = async () => {
              this.onComplete({
                type: "misc",
                name: "complete",
              });

              const shape = this.editor.getShape(this.shapeId);
              if (!shape) return;
              if (!isCustomArrowShape(shape)) return;
              const arrow = shape;
              const {
                start,
                end,
                text: arrowText,
              } = arrow.props as TLArrowShapeProps;

              const deleteAndWarn = (content: string) => {
                renderToast({
                  id: "tldraw-warning",
                  intent: "warning",
                  content,
                });
                this.editor.deleteShapes([arrow.id]);
              };

              // Allow arrow bend
              if (this.info.handle.id === "middle") return;

              // Stop accidental handle removal
              const { end: thisEnd, start: thisStart } = this.info.shape.props;
              const hasPreviousBindings = hasValidBindings([
                thisEnd,
                thisStart,
              ]);
              const bindingsMatchPrevBindings =
                compareBindings(thisEnd, end) &&
                compareBindings(thisStart, start);
              if (hasPreviousBindings && !bindingsMatchPrevBindings) {
                return cancelWarnAndUpdate({
                  content: "Cannot remove handle.",
                  shape,
                  context: this,
                });
              }

              // Allow handles to be repositioned in same shape
              if (hasPreviousBindings && bindingsMatchPrevBindings) {
                return;
              }

              if (start.type !== "binding" || end.type !== "binding") {
                return deleteAndWarn("Relation must connect two nodes.");
              }
              const source = this.editor.getShape(
                start.boundShapeId
              ) as DiscourseNodeShape;
              if (!source) {
                return deleteAndWarn("Failed to find source node.");
              }
              const target = this.editor.getShape(
                end.boundShapeId
              ) as DiscourseNodeShape;
              if (!target) {
                return deleteAndWarn("Failed to find target node.");
              }

              // Handle "Add Referenced Node" Arrows
              if (allAddReferencedNodeActionsSet.has(arrow.type)) {
                const possibleTargets = allAddRefNodeByAction[arrow.type].map(
                  (action) => action.destinationType
                );
                if (!possibleTargets.includes(target.type)) {
                  return deleteAndWarn(
                    `Target node must be of type ${possibleTargets
                      .map((t) => discourseContext.nodes[t].text)
                      .join(", ")}`
                  );
                }

                // source and target are expected to be pages
                // TODO: support blocks
                const targetTitle = target.props.title;
                const sourceTitle = source.props.title;
                const isTargetTitleCurrent =
                  getPageTitleByPageUid(target.props.uid).trim() ===
                  targetTitle.trim();
                const isSourceTitleCurrent =
                  getPageTitleByPageUid(source.props.uid).trim() ===
                  sourceTitle.trim();
                if (!isTargetTitleCurrent || !isSourceTitleCurrent) {
                  return deleteAndWarn(
                    "Either the source or target node has been renamed. Please update the nodes and try again."
                  );
                }

                // Hack for default shipped EVD format: [[EVD]] - {content} - {Source},
                // replace when migrating from format to specification
                let newTitle: string;
                if (targetTitle.endsWith(" - ")) {
                  newTitle = `${targetTitle}[[${sourceTitle}]]`;
                } else if (targetTitle.endsWith(" -")) {
                  newTitle = `${targetTitle} [[${sourceTitle}]]`;
                } else {
                  newTitle = `${targetTitle} - [[${sourceTitle}]]`;
                }

                if (!extensionAPI) {
                  return deleteAndWarn(`Failed to update node title.`);
                }

                await window.roamAlphaAPI.data.page.update({
                  page: {
                    uid: target.props.uid,
                    title: newTitle,
                  },
                });
                const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
                  nodeText: newTitle,
                  uid: target.props.uid,
                  nodeType: target.type,
                  extensionAPI,
                });
                this.editor.updateShapes([
                  {
                    id: target.id,
                    type: target.type,
                    props: {
                      h,
                      w,
                      imageUrl,
                      title: newTitle,
                    },
                  },
                ]);

                renderToast({
                  id: "tldraw-success",
                  intent: "success",
                  content: `Updated node title.`,
                });

                return;
              }

              // Handle "Add Relationship Arrows"
              if (allRelationIdSet.has(arrow.type)) {
                const relation = allRelationsById[arrow.type];
                if (!relation) return;
                const sourceLabel =
                  discourseContext.nodes[relation.source].text;
                if (source.type !== relation.source) {
                  return deleteAndWarn(
                    `Source node must be of type ${sourceLabel}`
                  );
                }
                const possibleTargets = discourseContext.relations[
                  relation.label
                ]
                  .filter((r) => r.source === relation.source)
                  .map((r) => r.destination);
                if (!possibleTargets.includes(target.type)) {
                  return deleteAndWarn(
                    `Target node must be of type ${possibleTargets
                      .map((t) => discourseContext.nodes[t].text)
                      .join(", ")}`
                  );
                }
                if (arrow.type !== target.type) {
                  this.editor.updateShapes([
                    {
                      id: arrow.id,
                      type: target.type,
                    },
                  ]);
                }
                const {
                  triples,
                  label: relationLabel,
                  // complement,
                } = relation;
                const isOriginal = arrowText === relationLabel;
                const newTriples = triples
                  .map((t) => {
                    if (/is a/i.test(t[1])) {
                      const targetNode =
                        (t[2] === "source" && isOriginal) ||
                        (t[2] === "destination" && !isOriginal)
                          ? source
                          : target;
                      const { title, uid } =
                        targetNode.props as DiscourseNodeShape["props"];
                      return [
                        t[0],
                        isPageUid(uid) ? "has title" : "with uid",
                        isPageUid(uid) ? title : uid,
                      ];
                    }
                    return t.slice(0);
                  })
                  .map(([source, relation, target]) => ({
                    source,
                    relation,
                    target,
                  }));
                const uid = getCurrentPageUid();
                const title = getPageTitleByPageUid(uid);
                triplesToBlocks({
                  defaultPageTitle: `Auto generated from ${title}`,
                  toPage: async (title: string, blocks: InputTextNode[]) => {
                    const parentUid =
                      getPageUidByPageTitle(title) ||
                      (await createPage({
                        title: title,
                      }));

                    await Promise.all(
                      blocks.map((node, order) =>
                        createBlock({ node, order, parentUid }).catch(() =>
                          console.error(
                            `Failed to create block: ${JSON.stringify(
                              { node, order, parentUid },
                              null,
                              4
                            )}`
                          )
                        )
                      )
                    );
                    await openBlockInSidebar(parentUid);
                  },
                  nodeSpecificationsByLabel: Object.fromEntries(
                    Object.values(discourseContext.nodes).map((n) => [
                      n.text,
                      n.specification,
                    ])
                  ),
                })(newTriples)();
              }
            };
          };
        }
        return c;
      });
    };
  };

export class MySelectTool extends SelectTool {
  static id = "my-select-tool";
  static initial = "my-initial-state";
  static children: typeof SelectTool.children = () => {
    return SelectTool.children().map((c) => {
      console.log(c.id);
      return c;
    });
  };
  // Your new children here
}

export const createAllRelationShapeUtils = (relationIds: string[]) => {
  return relationIds.map((id) => {
    class DiscourseRelationUtil extends ArrowShapeUtil {
      static type = id;
      override canBind = () => true;
      override canEdit = () => false;
      defaultProps() {
        const relations = Object.values(discourseContext.relations);
        // TODO - add canvas settings to relations config
        const relationIndex = relations.findIndex((rs) =>
          rs.some((r) => r.id === this.type)
        );
        const isValid = relationIndex >= 0 && relationIndex < relations.length;
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
          text: isValid
            ? Object.keys(discourseContext.relations)[relationIndex]
            : "",
          font: "mono" as const,
        };
      }
      override onBeforeCreate = (shape: TLArrowShape) => {
        // TODO - propsForNextShape is clobbering our choice of color
        const relations = Object.values(discourseContext.relations);
        const relationIndex = relations.findIndex((rs) =>
          rs.some((r) => r.id === this.type)
        );
        const isValid = relationIndex >= 0 && relationIndex < relations.length;
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
      component(shape: TLArrowShape) {
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
            {super.component(shape)}
          </>
        );
      }
    }
    return DiscourseRelationUtil;
  });
};
