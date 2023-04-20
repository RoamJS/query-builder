import React, {
  useRef,
  useState,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import isFlagEnabled from "../utils/isFlagEnabled";
import {
  App as TldrawApp,
  TLInstance,
  TLUser,
  TldrawEditorConfig,
  Canvas,
  TldrawEditor,
  ContextMenu,
  TldrawUi,
} from "@tldraw/tldraw";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import nanoid from "nanoid";
import "@tldraw/tldraw/editor.css";
import "@tldraw/tldraw/ui.css";
import setInputSetting from "roamjs-components/util/setInputSetting";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import { AddPullWatch } from "roamjs-components/types";

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

const THROTTLE = 350;

const TldrawCanvas = ({ title }: Props) => {
  const serializeRef = useRef(0);
  const deserializeRef = useRef(0);
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
      const uid = window.roamAlphaAPI.util.generateUID();
      createBlock({
        node: {
          text: "State",
          children: [{ text: "", uid }],
        },
        parentUid: pageUid,
      });
      return { instanceId, data: undefined, userId, uid };
    }
    if (!persisted.children.length) {
      const uid = window.roamAlphaAPI.util.generateUID();
      createBlock({
        node: {
          text: "",
          uid,
        },
        parentUid: persisted.uid,
      });
      return { instanceId, data: undefined, userId, uid };
    }
    try {
      return {
        data: JSON.parse(window.atob(persisted.children[0].text || "")),
        instanceId,
        userId,
        uid: persisted.children[0].uid,
      };
    } catch (e) {
      return {
        data: undefined,
        instanceId,
        userId,
        uid: persisted.children[0].uid,
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
  const store = useMemo(() => {
    const _store = TldrawEditorConfig.default.createStore({
      initialData: initialState.data,
      instanceId: initialState.instanceId,
      userId: initialState.userId,
    });
    _store.listen((rec) => {
      if (rec.source === "user") {
        clearTimeout(serializeRef.current);
        serializeRef.current = window.setTimeout(() => {
          const state = _store.serialize();
          setInputSetting({
            blockUid: pageUid,
            key: "State",
            value: window.btoa(JSON.stringify(state)),
          });
        }, THROTTLE);
      }
    });
    return _store;
  }, [initialState, serializeRef]);

  useEffect(() => {
    const props: Parameters<AddPullWatch> = [
      "[:edit/user :block/string]",
      `[:block/uid "${initialState.uid}"]`,
      (_, after) => {
        const state = after?.[":block/string"];
        const editingUser = after?.[":edit/user"]?.[":db/id"];
        if (!state || !editingUser) return;
        const editingUserUid = window.roamAlphaAPI.pull(
          "[:user/uid]",
          editingUser
        )?.[":user/uid"];
        if (
          !editingUserUid ||
          TLUser.createCustomId(editingUserUid) === initialState.userId
        )
          return;
        clearTimeout(deserializeRef.current);
        deserializeRef.current = window.setTimeout(() => {
          store.deserialize(JSON.parse(window.atob(state)));
        }, THROTTLE);
      },
    ];
    window.roamAlphaAPI.data.addPullWatch(...props);
    return () => {
      window.roamAlphaAPI.data.removePullWatch(...props);
    };
  }, [initialState, store]);

  // const store = useLocalSyncClient({
  //   ...initialState,
  //   universalPersistenceKey,
  // });
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
      <TldrawEditor
        baseUrl="https://samepage.network/assets/tldraw/"
        instanceId={initialState.instanceId}
        userId={initialState.userId}
        store={store}
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
      >
        <TldrawUi assetBaseUrl="https://samepage.network/assets/tldraw/">
          <ContextMenu>
            <Canvas />
          </ContextMenu>
        </TldrawUi>
      </TldrawEditor>
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
