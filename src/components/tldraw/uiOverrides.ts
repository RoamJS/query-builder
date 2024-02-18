import {
  TLImageShape,
  TLShape,
  TLTextShape,
  TLUiMenuGroup,
  TLUiMenuItem,
  TLUiOverrides,
  TLUiTranslationKey,
  createShapeId,
  toolbarItem,
  Editor,
  menuItem,
  TLUiSubMenu,
} from "@tldraw/tldraw";
import { DiscourseNode } from "../../utils/getDiscourseNodes";
import { getNewDiscourseNodeText } from "../../utils/formatUtils";
import createDiscourseNode from "../../utils/createDiscourseNode";
import calcCanvasNodeSizeAndImg from "../../utils/calcCanvasNodeSizeAndImg";
import type { OnloadArgs } from "roamjs-components/types";

const addFullScreenToggle = (
  mainMenu: TLUiMenuGroup,
  maximized: boolean,
  setMaximized: (maximized: boolean) => void
) => {
  const viewSubMenu = mainMenu.children.find(
    (m): m is TLUiSubMenu => m?.type === "submenu" && m.id === "view"
  );
  const viewActionsGroup = viewSubMenu?.children.find(
    (m): m is TLUiMenuGroup => m?.type === "group" && m.id === "view-actions"
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
const editCopyAsShortcuts = (mainMenu: TLUiMenuGroup) => {
  const editSubMenu = mainMenu.children.find(
    (m): m is TLUiSubMenu => m?.type === "submenu" && m.id === "edit"
  );
  const conversionsGroup = editSubMenu?.children.find(
    (m): m is TLUiMenuGroup => m?.type === "group" && m.id === "conversions"
  );
  const copyAsSubMenu = conversionsGroup?.children.find(
    (m): m is TLUiSubMenu => m?.type === "submenu" && m.id === "copy-as"
  );
  const copyAsGroup = copyAsSubMenu?.children.find(
    (m): m is TLUiMenuGroup => m?.type === "group" && m.id === "copy-as-group"
  );
  const copyAsPngItem = copyAsGroup?.children.find(
    (m): m is TLUiMenuItem => m?.type === "item" && m.id === "copy-as-png"
  );
  const copyAsSvgItem = copyAsGroup?.children.find(
    (m): m is TLUiMenuItem => m?.type === "item" && m.id === "copy-as-svg"
  );
  if (!copyAsPngItem || !copyAsSvgItem) return;
  copyAsPngItem.actionItem.kbd = "$!C";
  copyAsSvgItem.actionItem.kbd = "$!X";
};

const triggerContextMenuConvertTo = (
  appRef: React.MutableRefObject<Editor | undefined>
) => {
  const shape = appRef.current?.getOnlySelectedShape();
  if (!shape) return;
  const shapeEl = document.getElementById(shape.id);
  const rect = shapeEl?.getBoundingClientRect();
  const contextMenu = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: rect?.left,
    clientY: rect?.top,
  });
  shapeEl?.dispatchEvent(contextMenu);
  const menuItem = document.querySelector(
    'button[data-wd="menu-item.convert-to"]'
  ) as HTMLMenuElement;
  if (menuItem) {
    setTimeout(() => {
      menuItem.click();
    }, 100);
  }
};

export const generateUiOverrides = ({
  allNodes,
  allRelationNames,
  allAddReferencedNodeActions,
  extensionAPI,
  maximized,
  setMaximized,
  appRef,
}: {
  allNodes: DiscourseNode[];
  allRelationNames: string[];
  allAddReferencedNodeActions: string[];
  extensionAPI?: OnloadArgs["extensionAPI"];
  maximized: boolean;
  setMaximized: (maximized: boolean) => void;
  appRef: React.MutableRefObject<Editor | undefined>;
}): TLUiOverrides => ({
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
      };
    });
    // allRelationNames.forEach((relation, index) => {
    //   tools[relation] = {
    //     id: relation,
    //     icon: "tool-arrow",
    //     label: `shape.relation.${relation}` as TLUiTranslationKey,
    //     kbd: "",
    //     readonlyOk: true,
    //     onSelect: () => {
    //       app.setSelectedTool(relation);
    //     },
    //     style: {
    //       color: `var(--palette-${COLOR_ARRAY[index + 1]})`,
    //     },
    //   };
    // });
    // Object.keys(allAddReferencedNodeByAction).forEach((name) => {
    //   const action = allAddReferencedNodeByAction[name];
    //   const nodeColorArray = Object.keys(discourseContext.nodes).map((key) => ({
    //     text: discourseContext.nodes[key].text,
    //     color: discourseContext.nodes[key].canvasSettings.color,
    //   }));
    //   const color =
    //     nodeColorArray.find((n) => n.text === action[0].sourceName)?.color ||
    //     "";
    //   tools[name] = {
    //     id: name,
    //     icon: "tool-arrow",
    //     label: `shape.referenced.${name}` as TLUiTranslationKey,
    //     kbd: "",
    //     readonlyOk: true,
    //     onSelect: () => {
    //       app.setSelectedTool(`${name}`);
    //     },
    //     style: {
    //       color: formatHexColor(color) ?? `var(--palette-${COLOR_ARRAY[0]})`,
    //     },
    //   };
    // });
    return tools;
  },
  toolbar(_app, toolbar, { tools }) {
    toolbar.push(
      ...allNodes.map((n) => toolbarItem(tools[n.type]))
      // ...allRelationNames.map((name) => toolbarItem(tools[name])),
      // ...allAddReferencedNodeActions.map((action) =>
      //   toolbarItem(tools[action])
      // )
    );
    return toolbar;
  },
  contextMenu(app, schema, helpers) {
    const shape = app.getOnlySelectedShape();
    if (!shape) return schema;
    const convertToDiscourseNode = async (
      text: string,
      type: string,
      imageShapeUrl?: string
    ) => {
      if (!extensionAPI) {
        // renderToast({
        //   id: "tldraw-warning",
        //   intent: "danger",
        //   content: `Failed to convert to ${type}.  Please contact support`,
        // });
        return;
      }
      const nodeText =
        type === "blck-node"
          ? text
          : await getNewDiscourseNodeText({
              text,
              nodeType: type,
            });
      const uid = await createDiscourseNode({
        configPageUid: type,
        text: nodeText,
        imageUrl: imageShapeUrl,
        extensionAPI,
      });
      app.deleteShapes([shape.id]);
      const { x, y } = shape;
      const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
        nodeText: nodeText,
        extensionAPI,
        nodeType: type,
        uid,
      });
      app.createShapes([
        {
          type,
          id: createShapeId(),
          props: {
            uid,
            title: nodeText,
            h,
            w,
            imageUrl,
          },
          x,
          y,
        },
      ]);
    };
    const getOnSelectForShape = (shape: TLShape, nodeType: string) => {
      if (!shape.type) return null;
      if (shape.type === "image") {
        return async () => {
          const { assetId } = (shape as TLImageShape).props;
          if (!assetId) return;
          const asset = app.getAsset(assetId);
          if (!asset || !asset.props.src) return;
          const file = await fetch(asset.props.src)
            .then((r) => r.arrayBuffer())
            .then((buf) => new File([buf], shape.id));
          const src = await window.roamAlphaAPI.util.uploadFile({
            file,
          });
          const text = nodeType === "blck-node" ? `![](${src})` : "";
          convertToDiscourseNode(text, nodeType, src);
        };
      } else if (shape.type === "text") {
        return () => {
          const { text } = (shape as TLTextShape).props;
          convertToDiscourseNode(text, nodeType);
        };
      }
    };

    if (shape.type === "image" || shape.type === "text") {
      const nodeMenuItems = allNodes.map((node) => {
        return {
          checked: false,
          id: `convert-to-${node.type}`,
          type: "item",
          readonlyOk: true,
          disabled: false,
          actionItem: {
            label: `action.convert-to-${node.type}` as TLUiTranslationKey,
            id: `convert-to-${node.type}`,
            onSelect: getOnSelectForShape(shape, node.type),
            readonlyOk: true,
            menuLabel: `Convert to ${node.text}` as TLUiTranslationKey,
            title: `Convert to ${node.text}`,
          },
        } as TLUiMenuItem;
      });

      // Page not yet supported
      // requires page-node to have image flag option
      const filteredItems =
        shape.type === "image"
          ? nodeMenuItems.filter((item) => item.id !== "convert-to-page-node")
          : nodeMenuItems;

      const subTLUiMenuGroup: TLUiMenuGroup = {
        id: "convert-to-group",
        type: "group",
        checkbox: false,
        disabled: false,
        readonlyOk: true,
        children: [
          {
            id: "convert-to",
            type: "submenu",
            label: "action.convert-to" as TLUiTranslationKey,
            disabled: false,
            readonlyOk: true,
            children: [...filteredItems],
          },
        ],
      };

      schema.push(subTLUiMenuGroup);
    }
    return schema;
  },
  actions(_app, actions) {
    (actions["toggle-full-screen"] = {
      id: "toggle-full-screen",
      label: "action.toggle-full-screen" as TLUiTranslationKey,
      kbd: "!3",
      onSelect: () => setMaximized(!maximized),
      readonlyOk: true,
    }),
      (actions["convert-to"] = {
        id: "convert-to",
        label: "action.convert-to" as TLUiTranslationKey,
        kbd: "?C",
        onSelect: () => triggerContextMenuConvertTo(appRef),
        readonlyOk: true,
      });
    return actions;
  },
  keyboardShortcutsMenu(_app, keyboardShortcutsMenu, { tools, actions }) {
    const toolsGroup = keyboardShortcutsMenu.find(
      (group) => group.id === "shortcuts-dialog.tools"
    ) as TLUiMenuGroup;
    const viewGroup = keyboardShortcutsMenu.find(
      (group) => group.id === "shortcuts-dialog.view"
    ) as TLUiMenuGroup;
    const transformGroup = keyboardShortcutsMenu.find(
      (group) => group.id === "shortcuts-dialog.transform"
    ) as TLUiMenuGroup;

    toolsGroup.children.push(...allNodes.map((n) => menuItem(tools[n.type])));
    viewGroup.children.push(menuItem(actions["toggle-full-screen"]));
    transformGroup.children.push(menuItem(actions["convert-to"]));

    return keyboardShortcutsMenu;
  },
  menu(_app, menu) {
    const mainMenu = menu.find(
      (m): m is TLUiMenuGroup => m.type === "group" && m.id === "menu"
    );
    if (mainMenu) {
      addFullScreenToggle(mainMenu, maximized, setMaximized);
      editCopyAsShortcuts(mainMenu);
    }
    return menu;
  },
  translations: {
    en: {
      ...Object.fromEntries(
        allNodes.map((node) => [`shape.node.${node.type}`, node.text])
      ),
      ...Object.fromEntries(
        allRelationNames.map((name) => [`shape.relation.${name}`, name])
      ),
      ...Object.fromEntries(
        allAddReferencedNodeActions.map((name) => [
          `shape.referenced.${name}`,
          name,
        ])
      ),
      "action.toggle-full-screen": "Toggle Full Screen",
      "action.convert-to": "Convert to",
      ...Object.fromEntries(
        allNodes.map((node) => [
          `action.convert-to-${node.type}`,
          `${node.text}`,
        ])
      ),
    },
  },
});
