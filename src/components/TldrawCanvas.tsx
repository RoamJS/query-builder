import React, { useRef, useState, useMemo, useCallback } from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import isFlagEnabled from "../utils/isFlagEnabled";
import {
  Tldraw,
  App as TldrawApp,
  TldrawUiContextProvider,
  useLocalSyncClient,
  TLInstance,
  TLUser,
} from "@tldraw/tldraw";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import nanoid from "nanoid";
import "@tldraw/tldraw/editor.css";
import "@tldraw/tldraw/ui.css";
import getSubTree from "roamjs-components/util/getSubTree";

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

/**
 * TODO:
    "@tldraw/core": "2.0.0-alpha.1",
    "@tldraw/react": "2.0.0-alpha.1",
    "@tldraw/vec": "2.0.0-alpha.1",
 */
const TldrawCanvas = ({ title }: Props) => {
  const pageUid = useMemo(() => getPageUidByPageTitle(title), [title]);
  const tree = useMemo(() => getBasicTreeByParentUid(pageUid), [pageUid]);
  const appRef = useRef<TldrawApp>();
  const initialState = useMemo(() => {
    const persisted = getSubTree({
      parentUid: pageUid,
      tree,
      key: "State",
    });
    const instanceId = TLInstance.createCustomId(pageUid);
    const userId = TLUser.createCustomId(getCurrentUserUid());
    if (!persisted.uid) {
      const universalPersistanceKey = window.roamAlphaAPI.util.generateUID();
      createBlock({
        node: {
          text: "State",
          children: [{ text: "" }],
          uid: universalPersistanceKey,
        },
        parentUid: pageUid,
      });
      return { instanceId, data: undefined, userId, universalPersistanceKey };
    }
    try {
      return {
        data: JSON.parse(window.atob(persisted.text)),
        instanceId,
        userId,
        universalPersistanceKey: persisted.uid,
      };
    } catch (e) {
      return {
        data: undefined,
        instanceId,
        userId,
        universalPersistanceKey: persisted.uid,
      };
    }
  }, [tree, pageUid]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [maximized, _setMaximized] = useState(false);
  const createNode = useCallback(
    (position: number[]) => {
      // (text: string, position: { x: number; y: number }, color: string) => {
      if (!appRef.current) return;
      appRef.current.createShapes([
        {
          id: appRef.current.createShapeId(nanoid()),
          type: "rectangle",
          // size: [100, 100],
        },
      ]);
      // nodeInitCallback(node);
    },
    [
      //nodeInitCallback,
      appRef,
    ]
  );
  const store = useLocalSyncClient({
    instanceId: initialState.instanceId,
    userId: initialState.userId,
    initialDataRef: {
      current: initialState.data,
    },
    universalPersistenceKey: initialState.universalPersistanceKey,
  });
  return (
    <TldrawUiContextProvider>
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
          store={store}
          instanceId={initialState.instanceId}
          userId={initialState.userId}
          onMount={(app) => {
            if (process.env.NODE_ENV !== "production") {
              if (!window.tldrawApps) window.tldrawApps = {};
              const { tldrawApps } = window;
              tldrawApps[title] = app;
            }
            appRef.current = app;

        //     const oldOnDoubleClickCanvas = app.tools.select.onDoubleClickCanvas;
        //     app.tools.select.onDoubleClickCanvas = (info, e) => {
        //       oldOnDoubleClickCanvas(info, e);
        //       createNode(info.point);
        //       // nodeFormatTextByType[nodeType] || "Click to edit text",
        //       // e.position,
        //       // nodeColorRef.current
        //       /**
        //     const nodeType = nodeTypeByColor[nodeColorRef.current];
        // });
        //      */
        //     };
          }}
          // onPersist={(app) => {
          //   setInputSetting({
          //     blockUid: pageUid,
          //     key: "State",
          //     value: window.btoa(JSON.stringify(app.document)),
          //   });
          // }}
        />
      </div>
    </TldrawUiContextProvider>
  );
};

export const renderTldrawCanvas = (
  title: string,
  globalRefs: Props["globalRefs"]
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
