// Helper to add referenced nodes to node titles
// EG: [[EVD]] - {content} - {Source}
// {Source} is a referenced node

import {
  TLArrowShape,
  ArrowShapeUtil,
  ArrowShapeTool,
  TLPointerEvent,
  TLBaseShape,
  TLArrowShapeProps,
} from "@tldraw/tldraw";
import { discourseContext } from "./Tldraw";
import React from "react";
import { COLOR_ARRAY } from "./DiscourseNode";

export const createRelationShapeTools = (allRelationNames: string[]) => {
  return allRelationNames.map(
    (name) =>
      class extends ArrowShapeTool {
        static id = name;
        static initial = "idle";
        // static children: typeof ArrowShapeTool.children = () => {
        //   const [Idle, Pointing] = ArrowShapeTool.children();
        //   return [
        //     class extends Idle {
        //       onPointerDown: TLPointerEvent = (info) => {};
        //     },
        //     Pointing,
        //   ];
        // };
      }
  );
};

export const createRelationShapeUtils = (relationIds: string[]) => {
  return relationIds.map((id) => {
    class DiscourseRelationUtil extends DiscourseBaseRelationUtil {
      static type = id;
    }
    return DiscourseRelationUtil;
  });
};

class DiscourseReferencedNodeUtil extends ArrowShapeUtil {
  type = "placeholder";
  override canBind = () => true;
  override canEdit = () => false;
  defaultProps() {
    return {
      opacity: "1" as const,
      dash: "draw" as const,
      size: "s" as const,
      fill: "none" as const,
      color: COLOR_ARRAY[0],
      labelColor: COLOR_ARRAY[1],
      bend: 0,
      start: { type: "point" as const, x: 0, y: 0 },
      end: { type: "point" as const, x: 0, y: 0 },
      arrowheadStart: "none" as const,
      arrowheadEnd: "arrow" as const,
      text: "for",
      font: "mono" as const,
    };
  }
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
export class DiscourseBaseRelationUtil extends ArrowShapeUtil {
  static type = "placeholder";

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
