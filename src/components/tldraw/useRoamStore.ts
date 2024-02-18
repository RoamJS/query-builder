import { TLRecord, TLStore } from "@tldraw/tlschema";
import nanoid from "nanoid";
import { title } from "process";
import { useRef, useMemo } from "react";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getSubTree from "roamjs-components/util/getSubTree";
import setInputSetting from "roamjs-components/util/setInputSetting";
import createBlock from "roamjs-components/writes/createBlock";
import getBlockProps from "../../utils/getBlockProps";
import { createTLStore } from "@tldraw/editor";
import { SerializedStore } from "@tldraw/store";
import { defaultShapeUtils } from "@tldraw/tldraw";
import { BaseDiscourseNodeUtil } from "./DiscourseNodeUtil";

const THROTTLE = 350;

export const useRoamStore = ({
  customShapeUtils,
  pageUid,
}: {
  customShapeUtils: (typeof BaseDiscourseNodeUtil)[];
  pageUid: string;
}) => {
  const localStateIds = useRef<string[]>([]);
  const serializeRef = useRef(0);
  const deserializeRef = useRef(0);
  const tree = useMemo(() => getBasicTreeByParentUid(pageUid), [pageUid]);
  const initialData = useMemo(() => {
    const persisted = getSubTree({
      parentUid: pageUid,
      tree,
      key: "State",
    });
    if (!persisted.uid) {
      // we create a block so that the page is not garbage collected
      createBlock({
        node: {
          text: "State",
        },
        parentUid: pageUid,
      });
    }
    const props = getBlockProps(pageUid) as Record<string, unknown>;
    const rjsqb = props["roamjs-query-builder"] as Record<string, unknown>;
    const data = rjsqb?.tldraw as SerializedStore<TLRecord>;
    return data;
  }, [tree, pageUid]);

  const store = useMemo(() => {
    const _store = createTLStore({
      initialData,
      shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
    });
    _store.listen((rec) => {
      if (rec.source !== "user") return;
      const validChanges = Object.keys(rec.changes.added)
        .concat(Object.keys(rec.changes.removed))
        .concat(Object.keys(rec.changes.updated))
        .filter(
          (k) =>
            !/^(user_presence|camera|instance|instance_page_state):/.test(k)
        );
      if (!validChanges.length) return;
      clearTimeout(serializeRef.current);
      serializeRef.current = window.setTimeout(async () => {
        const state = _store.serialize();
        const props = getBlockProps(pageUid) as Record<string, unknown>;
        const rjsqb =
          typeof props["roamjs-query-builder"] === "object"
            ? props["roamjs-query-builder"]
            : {};
        await setInputSetting({
          blockUid: pageUid,
          key: "timestamp",
          value: new Date().valueOf().toString(),
        });
        const newstateId = nanoid();
        localStateIds.current.push(newstateId);
        localStateIds.current.splice(0, localStateIds.current.length - 25);
        window.roamAlphaAPI.updateBlock({
          block: {
            uid: pageUid,
            props: {
              ...props,
              ["roamjs-query-builder"]: {
                ...rjsqb,
                stateId: newstateId,
                tldraw: state,
              },
            },
          },
        });
      }, THROTTLE);
    });
    return _store;
  }, [initialData, serializeRef]);

  return { store, localStateIds, deserializeRef };
};
