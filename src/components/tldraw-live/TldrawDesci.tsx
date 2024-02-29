import {
  Editor as TldrawApp,
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
  // TldrawSelectionBackground,
  // TldrawHandles,
  // TldrawHoveredShapeIndicator,
  // TldrawScribble,
  TLUiOverrides,
  TLUiTranslationKey,
  TLUiMenuGroup,
  TLUiSubMenu,
  Tldraw,
  Editor,
  DefaultBackground,
} from "@tldraw/tldraw";
import React, { useRef, useState } from "react";
import ExtensionApiContextProvider, {
  useExtensionAPI,
} from "roamjs-components/components/ExtensionApiContext";
import { OnloadArgs } from "roamjs-components/types";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import { useYjsStore } from "./useYjsStore";
// import { TldrawProvider, useTldraw } from "./tldraw-context";
import "@tldraw/tldraw/tldraw.css";
import { createNodeShapeUtils, createNodeShapeTools } from "./DiscourseNode";
import { DiscourseNode } from "../../utils/getDiscourseNodes";
import { createUiOverrides } from "./uiOverrides";

//   const PARTYKIT_HOST = "https://desci-demo.mdroidian.partykit.dev";
const PARTYKIT_HOST = "http://127.0.0.1:1999 ";

export const WEBSOCKET_PROTOCOL =
  PARTYKIT_HOST?.startsWith("localhost") ||
  PARTYKIT_HOST?.startsWith("127.0.0.1")
    ? "ws"
    : "wss";

const TldrawDesciCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maximized, setMaximized] = useState(false);
  // const { setEditor } = useTldraw();
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

  // const handleMount = (editor: Editor) => {
  //   setEditor(editor);
  // };

  const allNodes: DiscourseNode[] = [
    {
      format: "[[CLM]] - {content}",
      text: "Claim",
      shortcut: "C",
      type: "_CLM-node",
      specification: [],
      backedBy: "user",
      canvasSettings: {},
      graphOverview: false,
    },
    {
      format: "[[QUE]] - {content}",
      text: "Question",
      shortcut: "Q",
      type: "_QUE-node",
      specification: [],
      backedBy: "user",
      canvasSettings: {},
      graphOverview: false,
    },
    {
      format: "[[EVD]] - {content} - {Source}",
      text: "Evidence",
      shortcut: "E",
      type: "_EVD-node",
      specification: [],
      backedBy: "user",
      canvasSettings: {},
      graphOverview: false,
    },
    {
      format: "@{content}",
      text: "Source",
      shortcut: "S",
      type: "_SRC-node",
      specification: [],
      backedBy: "user",
      canvasSettings: {},
      graphOverview: false,
    },
    {
      text: "Page",
      type: "page-node",
      shortcut: "p",
      format: "{content}",
      specification: [
        {
          type: "clause",
          source: "Page",
          relation: "has title",
          target: "/^(.*)$/",
          uid: "ZcYSQPpSb",
        },
      ],
      canvasSettings: {
        color: "#000000",
      },
      backedBy: "default",
    },
    {
      text: "Block",
      type: "blck-node",
      shortcut: "b",
      format: "{content}",
      specification: [
        {
          type: "clause",
          source: "Block",
          relation: "is in page",
          target: "_",
          uid: "c7wC6fu_W",
        },
      ],
      canvasSettings: {
        color: "#505050",
      },
      backedBy: "default",
    },
  ];
  const discourseNodeUtils = createNodeShapeUtils(allNodes);
  const discourseNodeTools = createNodeShapeTools(allNodes);

  const uiOverrides = createUiOverrides({
    allNodes,
    maximized,
    setMaximized,
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
        // baseUrl="https://samepage.network/assets/tldraw/"
        // instanceId={initialState.instanceId}
        shapeUtils={[...defaultShapeUtils, ...discourseNodeUtils]}
        tools={[...defaultTools, ...defaultShapeTools, ...discourseNodeTools]}
        initialState="select"
        components={defaultComponents}
        store={store}
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

export const renderTldrawDesciCanvas = (
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
        {/* <TldrawProvider> */}
        <TldrawDesciCanvas />
        {/* </TldrawProvider> */}
      </ExtensionApiContextProvider>,
      parent
    );
  }
};

export default TldrawDesciCanvas;
