import {
  TldrawEditor,
  defaultShapeUtils,
  defaultTools,
  defaultShapeTools,
  TldrawUi,
  ContextMenu,
  Canvas,
  DefaultSelectionBackground,
  DefaultHandles,
  DefaultHoveredShapeIndicator,
  DefaultScribble,
  TLUiOverrides,
  TLUiTranslationKey,
  TLUiMenuGroup,
  TLUiSubMenu,
} from "@tldraw/tldraw";
import React, { useRef, useState } from "react";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { OnloadArgs } from "roamjs-components/types";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import { useYjsStore } from "./useYjsStore";
import "@tldraw/tldraw/tldraw.css";

const PARTYKIT_HOST = "https://partykit-whiteboard.mdroidian.partykit.dev";
// const PARTYKIT_HOST = "http://127.0.0.1:1999 ";

export const WEBSOCKET_PROTOCOL =
  PARTYKIT_HOST?.startsWith("localhost") ||
  PARTYKIT_HOST?.startsWith("127.0.0.1")
    ? "ws"
    : "wss";

const TldrawLiveCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maximized, setMaximized] = useState(false);
  const store = useYjsStore({
    roomId: "example-room",
    hostUrl: PARTYKIT_HOST,
  });

  const defaultComponents = {
    Scribble: DefaultScribble,
    CollaboratorScribble: DefaultScribble,
    SelectionForeground: DefaultSelectionBackground,
    SelectionBackground: DefaultSelectionBackground,
    Handles: DefaultHandles,
    HoveredShapeIndicator: DefaultHoveredShapeIndicator,
  };

  const uiOverrides: TLUiOverrides = {
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
      <style>
        {`.roam-article .rm-block-children {
            display: none;
          }
          .tl-arrow-label__inner{
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
          .tl-arrow-label .tl-arrow-label__inner p {
            padding: 0;
            white-space: nowrap;
            font-family: 'tldraw_draw', sans-serif;
          }`}
      </style>
      <TldrawEditor
        shapeUtils={[...defaultShapeUtils]}
        tools={[...defaultTools, ...defaultShapeTools]}
        initialState="select"
        components={defaultComponents}
        store={store}
      >
        <TldrawUi overrides={uiOverrides}>
          <ContextMenu>
            <Canvas />
          </ContextMenu>
        </TldrawUi>
      </TldrawEditor>
    </div>
  );
};

export const renderTldrawLiveCanvas = (
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
        <TldrawLiveCanvas />
      </ExtensionApiContextProvider>,
      parent
    );
  }
};

export default TldrawLiveCanvas;
