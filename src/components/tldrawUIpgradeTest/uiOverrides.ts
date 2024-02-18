import { TLUiOverrides, toolbarItem } from "@tldraw/tldraw";
import { allNodes } from "./TldrawUpgrade";

export const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    allNodes.forEach((node) => {
      const nodeId = node.type;
      tools[nodeId] = {
        id: nodeId,
        icon: "color",
        label: node.type.charAt(0).toUpperCase() + node.type.slice(1),
        kbd: undefined,
        onSelect: () => {
          editor.setCurrentTool(nodeId);
        },
        readonlyOk: true,
        meta: {
          color: "red",
        },
      };
    });
    return tools;
  },
  toolbar(_app, toolbar, { tools }) {
    allNodes.forEach((node, index) => {
      const nodeId = node.type;
      toolbar.splice(4 + index, 0, toolbarItem(tools[nodeId]));
    });
    return toolbar;
  },
};
