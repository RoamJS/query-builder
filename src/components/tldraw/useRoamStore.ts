import { TLRecord, TLStore } from "@tldraw/tlschema";
import nanoid from "nanoid";
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
import {
  defaultBindingUtils,
  defaultShapeUtils,
  loadSnapshot,
  TLStoreSnapshot,
} from "tldraw";
import { AddPullWatch } from "roamjs-components/types";
import { LEGACY_SCHEMA, LEGACYSTORETEST } from "../../data/legacyTldrawSchema";
// import { createAllRelationShapeUtils } from "./DiscourseRelationsUtil";

const THROTTLE = 350;

const isTLStoreSnapshot = (value: unknown): value is TLStoreSnapshot => {
  return (
    typeof value === "object" &&
    value !== null &&
    "store" in value &&
    "schema" in value
  );
};

const filterUserRecords = (data: SerializedStore<TLRecord>) => {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => {
      return !/^(user_presence|camera|instance|instance_page_state|user|user_document):/.test(
        key
      );
    })
  );
};

export const useRoamStore = ({
  customShapeUtils,
  customBindingUtils,
  pageUid,
}: {
  customShapeUtils: any[];
  customBindingUtils: any[];
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
    const rjsqb =
      typeof props["roamjs-query-builder"] === "object"
        ? (props["roamjs-query-builder"] as Record<string, unknown>)
        : {};
    if (isTLStoreSnapshot(rjsqb.tldraw)) {
      return rjsqb.tldraw as TLStoreSnapshot;
    }

    // Upgrade old format to new format
    if (rjsqb?.tldraw) {
      const oldStore = rjsqb.tldraw as SerializedStore<TLRecord>;
      // const oldStore = LEGACYSTORETEST;

      try {
        const newStore = createTLStore({
          shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
          bindingUtils: [...defaultBindingUtils, ...customBindingUtils],
        });
        // getMigrationsSince either
        // - errors if cannot migrate
        // - returns empty array if no migrations are needed
        // - returns array of migrations if migrations are needed
        try {
          const migrations = newStore.schema.getMigrationsSince(LEGACY_SCHEMA);
          console.log("migrations", migrations);
        } catch (error) {
          console.error("Failed to get migrations since:", error);
          return null;
        }

        // save old store and update to new format
        const filteredData = filterUserRecords(oldStore);
        loadSnapshot(newStore, { store: filteredData, schema: LEGACY_SCHEMA });
        const snapshot = newStore.getStoreSnapshot();

        window.roamAlphaAPI.updateBlock({
          block: {
            uid: pageUid,
            props: {
              ...props,
              ["roamjs-query-builder"]: {
                ...rjsqb,
                stateId: nanoid(),
                tldraw: snapshot,
                legacyTldraw: {
                  date: new Date().valueOf().toString(),
                  store: oldStore,
                },
              },
            },
          },
        });
        return snapshot;
      } catch (error) {
        console.error("Failed to get migrations since:", error);
        return null;
      }
    }
  }, [tree, pageUid]);

  const store = useMemo(() => {
    let _store;
    try {
      _store = createTLStore({
        initialData: initialData?.store,
        shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
        bindingUtils: [...defaultBindingUtils, ...customBindingUtils],
      });
    } catch (error) {
      console.error("Failed to create store:", error);
      return null;
    }

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
            ? (props["roamjs-query-builder"] as Record<string, unknown>)
            : {};
        const propSchema = isTLStoreSnapshot(rjsqb.tldraw)
          ? rjsqb.tldraw.schema
          : {};
        const schema =
          Object.keys(propSchema).length === 0
            ? _store.schema.serialize()
            : propSchema;
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
                tldraw: { store: state, schema },
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

  const pruneState = (state: StoreSnapshot<TLRecord>) =>
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
          if (!store) return;
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
