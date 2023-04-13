import React, { useRef, useState, useMemo } from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import isFlagEnabled from "../utils/isFlagEnabled";
import { Tldraw, TDDocument, TldrawApp } from "@tldraw/tldraw";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import createBlock from "roamjs-components/writes/createBlock";
import setInputSetting from "roamjs-components/util/setInputSetting";

declare global {
  interface Window {
    tldrawApps: Record<string, TldrawApp>;
  }
}

type Props = {
  title: string;
  previewEnabled: boolean;
  globalRefs: { [key: string]: (args: Record<string, string>) => void };
};

const TldrawCanvas = ({ title }: Props) => {
  const pageUid = useMemo(() => getPageUidByPageTitle(title), [title]);
  const tree = useMemo(() => getBasicTreeByParentUid(pageUid), [pageUid]);
  const initialDocument = useMemo<TDDocument | undefined>(() => {
    const persisted = getSettingValueFromTree({
      parentUid: pageUid,
      tree,
      key: "State",
      defaultValue: "",
    });
    if (!persisted) {
      createBlock({
        node: { text: "State", children: [{ text: "" }] },
        parentUid: pageUid,
      });
      return undefined;
    }
    try {
      return JSON.parse(window.atob(persisted));
    } catch (e) {
      return undefined;
    }
  }, [tree, pageUid]);
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
      <Tldraw
        id={title}
        autofocus
        document={initialDocument}
        onMount={(app) => {
          if (process.env.NODE_ENV !== "production") {
            if (!window.tldrawApps)
              window.tldrawApps = {};
            const { tldrawApps } = window;
            tldrawApps[title] = app;
          }
        }}
        onPersist={(app) => {
          setInputSetting({
            blockUid: pageUid,
            key: "State",
            value: window.btoa(JSON.stringify(app.document)),
          });
        }}
      />
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
