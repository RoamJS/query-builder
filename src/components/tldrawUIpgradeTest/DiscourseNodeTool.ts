import { BaseBoxShapeTool, TLClickEvent } from "@tldraw/tldraw";
import { DiscourseNode } from "./TldrawUpgrade";

export const createDiscourseNodeTool = (nodes: DiscourseNode[]) => {
  return nodes.map((node) => {
    class DynamicDiscourseNodeTool extends BaseBoxShapeTool {
      static override id = node.type;
      static override initial = "idle";
      override shapeType = node.type;

      override onDoubleClick: TLClickEvent = (_info) => {
        // Handle double-click events here, potentially using nodeType
        // For example, you could create a new shape of this type
      };
    }
    return DynamicDiscourseNodeTool;
  });
};
