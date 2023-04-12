import React, { useRef, useState } from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import isFlagEnabled from "../utils/isFlagEnabled";
import { Tldraw } from "@tldraw/tldraw";

type Props = {
  title: string;
  previewEnabled: boolean;
  globalRefs: { [key: string]: (args: Record<string, string>) => void };
};

const TldrawCanvas = (props: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maximized, _setMaximized] = useState(false);
  return (
    <div
      className={`border border-gray-300 rounded-md bg-white h-full w-full z-10 overflow-hidden ${
        maximized ? "absolute inset-0" : "relative"
      }`}
      id={`roamjs-tldraw-canvas-container`}
      ref={containerRef}
      tabIndex={-1}
    >
      <style>{`.roam-article .rm-block-children {
  display: none;
}`}</style>
      <Tldraw id={props.title} autofocus />
    </div>
  );
};

export const renderTldrawCanvas = (
  title: string,
  globalRefs: Props["globalRefs"]
) => {
  const children = document.querySelector<HTMLDivElement>(
    ".roam-article .rm-block-children"
  );
  if (!children.hasAttribute("data-roamjs-discourse-playground")) {
    children.setAttribute("data-roamjs-discourse-playground", "true");
    const parent = document.createElement("div");
    children.parentElement.appendChild(parent);
    parent.style.height = "500px";
    renderWithUnmount(
      <TldrawCanvas
        title={title}
        globalRefs={globalRefs}
        previewEnabled={isFlagEnabled("preview")}
      />,
      parent
    );
  }
};

export default TldrawCanvas;
