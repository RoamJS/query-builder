import React, { useState } from "react";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { OnloadArgs } from "roamjs-components/types";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import {
  TldrawEditor,
  defaultShapeUtils,
  defaultTools,
  defaultShapeTools,
  TldrawUi,
  ContextMenu,
  Canvas,
  BaseBoxShapeTool,
  TLClickEvent,
  createTLStore,
  TldrawHandles,
  TldrawHoveredShapeIndicator,
  TldrawScribble,
  TldrawSelectionBackground,
  TldrawSelectionForeground,
} from "@tldraw/tldraw";
import {
  DiscourseNodeShape,
  DiscourseNodeUtil,
  createShapeUtilsForNodes,
} from "./DiscourseNodeUtil";
import { uiOverrides } from "./uiOverrides";
import { DEFAULT_STORE } from "./defaultStore";
import { createDiscourseNodeTool } from "./DiscourseNodeTool";

export type DiscourseNode = {
  type: string;
  color: string;
};
export const allNodes = [
  { type: "claim", color: "green" },
  { type: "evidence", color: "red" },
];
const defaultComponents = {
  Scribble: TldrawScribble,
  CollaboratorScribble: TldrawScribble,
  SelectionForeground: TldrawSelectionForeground,
  SelectionBackground: TldrawSelectionBackground,
  Handles: TldrawHandles,
  HoveredShapeIndicator: TldrawHoveredShapeIndicator,
};

const TldrawCanvasUpgrade = ({ title }: { title: string }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const customShapeUtils = createShapeUtilsForNodes(allNodes);
  const customTool = createDiscourseNodeTool(allNodes);

  const [store] = useState(() => {
    const store = createTLStore({
      shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
    });
    store.loadSnapshot(DEFAULT_STORE);
    return store;
  });

  return (
    <div
      className={`border border-gray-300 rounded-md bg-white h-full w-full z-10 overflow-hidden`}
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
    }
    #roamjs-tldraw-canvas-container .rs-shape .roamjs-tldraw-node .rm-block-main .rm-block-separator {
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
        initialState="select"
        shapeUtils={[...defaultShapeUtils, ...customShapeUtils]}
        tools={[...defaultTools, ...defaultShapeTools, ...customTool]}
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

export const renderTldrawUpgrade = (title: string, onloadArgs: OnloadArgs) => {
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
        <TldrawCanvasUpgrade title={title} />
      </ExtensionApiContextProvider>,
      parent
    );
  }
};

export default TldrawCanvasUpgrade;
