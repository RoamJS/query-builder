import {
  TLUiMenuGroup,
  TLUiOverrides,
  TLUiTranslationKey,
  toolbarItem,
  TLUiSubMenu,
} from "@tldraw/tldraw";
import { DiscourseNode } from "../../utils/getDiscourseNodes";
import { formatHexColor } from "../DiscourseNodeCanvasSettings";
import { COLOR_ARRAY } from "./DiscourseNode";

export const createUiOverrides = ({
  allNodes,
  maximized,
  setMaximized,
}: {
  allNodes: DiscourseNode[];
  maximized: boolean;
  setMaximized: (maximized: boolean) => void;
}): TLUiOverrides => ({
  tools(editor, tools) {
    allNodes.forEach((node, index) => {
      const nodeId = node.type;
      tools[nodeId] = {
        id: nodeId,
        icon: "color",
        label: `shape.node.${node.type}` as TLUiTranslationKey,
        kbd: node.shortcut,
        onSelect: () => {
          editor.setCurrentTool(nodeId);
        },
        readonlyOk: true,
        style: {
          color:
            formatHexColor(node.canvasSettings.color) ||
            `${COLOR_ARRAY[index]}`,
        },
      };
    });

    return tools;
  },
  toolbar(_app, toolbar, { tools }) {
    toolbar.push(...allNodes.map((n) => toolbarItem(tools[n.type])));
    return toolbar;
  },

  actions(_app, actions) {
    actions["toggle-full-screen"] = {
      id: "toggle-full-screen",
      label: "action.toggle-full-screen" as TLUiTranslationKey,
      kbd: "!3",
      onSelect: () => setMaximized(!maximized),
      readonlyOk: true,
    };

    return actions;
  },

  menu(_app, menu) {
    const addFullScreenToggle = (
      mainMenu: TLUiMenuGroup,
      maximized: boolean,
      setMaximized: (maximized: boolean) => void
    ) => {
      const viewSubMenu = mainMenu.children.find(
        (m): m is TLUiSubMenu => m?.type === "submenu" && m.id === "view"
      );
      const viewActionsGroup = viewSubMenu?.children.find(
        (m): m is TLUiMenuGroup =>
          m?.type === "group" && m.id === "view-actions"
      );
      if (!viewActionsGroup) return;
      viewActionsGroup.children.push({
        type: "item",
        readonlyOk: true,
        id: "toggle-full-screen",
        disabled: false,
        checked: maximized,
        actionItem: {
          id: "toggle-full-screen",
          label: "action.toggle-full-screen" as TLUiTranslationKey,
          kbd: "!3",
          onSelect: () => {
            setMaximized(!maximized);
          },
          readonlyOk: true,
        },
      });
    };

    const mainMenu = menu.find(
      (m): m is TLUiMenuGroup => m.type === "group" && m.id === "menu"
    );
    if (mainMenu) {
      addFullScreenToggle(mainMenu, maximized, setMaximized);
    }
    return menu;
  },
  translations: {
    en: {
      ...Object.fromEntries(
        allNodes.map((node) => [`shape.node.${node.type}`, node.text])
      ),

      "action.toggle-full-screen": "Toggle Full Screen",
    },
  },
});
