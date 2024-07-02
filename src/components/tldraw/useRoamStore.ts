import { TLRecord, TLStore } from "@tldraw/tlschema";
import nanoid from "nanoid";
import { title } from "process";
import { useRef, useMemo, useEffect } from "react";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getSubTree from "roamjs-components/util/getSubTree";
import setInputSetting from "roamjs-components/util/setInputSetting";
import createBlock from "roamjs-components/writes/createBlock";
import getBlockProps, { json, normalizeProps } from "../../utils/getBlockProps";
import { createTLStore } from "@tldraw/editor";
import { SerializedStore, StoreSnapshot } from "@tldraw/store";
import { defaultShapeUtils } from "tldraw";
import { BaseDiscourseNodeUtil } from "./DiscourseNode";
import { AddPullWatch } from "roamjs-components/types";
import { createAllRelationShapeUtils } from "./DiscourseRelations";

const THROTTLE = 350;

export const useRoamStore = ({
  customShapeUtils,
  pageUid,
}: {
  customShapeUtils: any[];
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

  const personalRecordTypes = new Set([
    "camera",
    "instance",
    "instance_page_state",
  ]);

  const pruneState = (state: SerializedStore<TLRecord>) =>
    Object.fromEntries(
      Object.entries(state).filter(
        ([_, record]) => !personalRecordTypes.has(record.typeName)
      )
    );

  const diffObjects = (
    oldRecord: Record<string, any>,
    newRecord: Record<string, any>
  ): Record<string, any> => {
    const allKeys = Array.from(
      new Set(Object.keys(oldRecord).concat(Object.keys(newRecord)))
    );
    return Object.fromEntries(
      allKeys
        .map((key) => {
          const oldValue = oldRecord[key];
          const newValue = newRecord[key];
          if (typeof oldValue !== typeof newValue) {
            return [key, newValue];
          }
          if (
            typeof oldValue === "object" &&
            oldValue !== null &&
            newValue !== null
          ) {
            const diffed = diffObjects(oldValue, newValue);
            if (Object.keys(diffed).length) {
              return [key, diffed];
            }
            return null;
          }
          if (oldValue !== newValue) {
            return [key, newValue];
          }
          return null;
        })
        .filter((e): e is [string, any] => !!e)
    );
  };
  const calculateDiff = (
    _newState: StoreSnapshot<TLRecord>,
    _oldState: StoreSnapshot<TLRecord>
  ) => {
    const newState = pruneState(_newState);
    const oldState = pruneState(_oldState);
    return {
      added: Object.fromEntries(
        Object.keys(newState)
          .filter((id) => !oldState[id])
          .map((id) => [id, newState[id]])
      ),
      removed: Object.fromEntries(
        Object.keys(oldState)
          .filter((id) => !newState[id])
          .map((key) => [key, oldState[key]])
      ),
      updated: Object.fromEntries(
        Object.keys(newState)
          .map((id) => {
            const oldRecord = oldState[id];
            const newRecord = newState[id];
            if (!oldRecord || !newRecord) {
              return null;
            }

            const diffed = diffObjects(oldRecord, newRecord);
            if (Object.keys(diffed).length) {
              return [id, [oldRecord, newRecord]];
            }
            return null;
          })
          .filter((e): e is [string, any] => !!e)
      ),
    };
  };

  useEffect(() => {
    const pullWatchProps: Parameters<AddPullWatch> = [
      "[:edit/user :block/props :block/string {:block/children ...}]",
      `[:block/uid "${pageUid}"]`,
      (_, after) => {
        const props = normalizeProps(
          (after?.[":block/props"] || {}) as json
        ) as Record<string, json>;
        const rjsqb = props["roamjs-query-builder"] as Record<string, unknown>;
        const propsStateId = rjsqb?.stateId as string;
        if (localStateIds.current.some((s) => s === propsStateId)) return;
        const newState = rjsqb?.tldraw as StoreSnapshot<TLRecord>;
        if (!newState) return;
        clearTimeout(deserializeRef.current);
        deserializeRef.current = window.setTimeout(() => {
          store.mergeRemoteChanges(() => {
            const currentState = store.getSnapshot();
            const diff = calculateDiff(newState, currentState);
            store.applyDiff(diff);
          });
        }, THROTTLE);
      },
    ];
    window.roamAlphaAPI.data.addPullWatch(...pullWatchProps);
    return () => {
      window.roamAlphaAPI.data.removePullWatch(...pullWatchProps);
    };
  }, [pageUid, store]);

  return store;
};
