import {
  Button,
  H6,
  InputGroup,
  Menu,
  MenuItem,
  Popover,
  PopoverPosition,
  Switch,
} from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import createBlock from "roamjs-components/writes/createBlock";
import setInputSetting from "roamjs-components/util/setInputSetting";
import parseQuery from "../utils/parseQuery";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import {
  getConditionLabels,
  sourceToTargetOptions,
} from "../utils/conditionToDatalog";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { render as renderSimpleAlert } from "roamjs-components/components/SimpleAlert";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import useSubTree from "roamjs-components/hooks/useSubTree";
import {
  Condition,
  QBClauseData,
  Selection,
} from "roamjs-components/types/query-builder";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";

type QClauseData = {
  relation: string;
  source: string;
  target: string;
  uid: string;
};

type QClause = QClauseData & { type: "clause" };
type QNot = QClauseData & { type: "not" };

type QNested = { conditions: QCondition[] };

type QOr = QNested & {
  type: "or";
};

type QNor = QNested & {
  type: "not";
};

// dropdown Edit button => (number of clauses)
type QCondition = QClause | QNot | QOr | QNor;

const QueryCondition = ({
  con,
  index,
  setConditions,
  conditions,
  returnNode,
}: {
  con: QBClauseData;
  index: number;
  setConditions: (cons: QBClauseData[]) => void;
  conditions: QBClauseData[];
  returnNode: string;
}) => {
  const debounceRef = useRef(0);
  const conditionLabels = useMemo(getConditionLabels, []);
  const targetOptions = useMemo(
    () => sourceToTargetOptions({ source: con.source, relation: con.relation }),
    [con.source, con.relation]
  );
  return (
    <div style={{ display: "flex", margin: "8px 0", alignItems: "baseline" }}>
      <MenuItemSelect
        popoverProps={{
          className: "roamjs-query-condition-source",
        }}
        activeItem={con.source}
        items={Array.from(
          new Set(conditions.slice(0, index).map((c) => c.target))
        ).concat(returnNode)}
        onItemSelect={(value) => {
          setInputSetting({
            blockUid: con.uid,
            key: "source",
            value,
          });
          setConditions(
            conditions.map((c) =>
              c.uid === con.uid ? { ...con, source: value } : c
            )
          );
        }}
      />
      {/* I want options to appear on focus before using
      <div className="roamjs-query-condition-relation">
        <AutocompleteInput
          value={con.relation}
          setValue={(e) => {
            window.clearTimeout(debounceRef.current);
            setConditions(
              conditions.map((c) =>
                c.uid === con.uid ? { ...con, relation: e } : c
              )
            );
            debounceRef.current = window.setTimeout(() => {
              setInputSetting({
                blockUid: con.uid,
                key: "Relation",
                value: e,
                index: 1,
              });
            }, 1000);
          }}
          options={conditionLabels}
          placeholder={"Choose relationship"}
        />
      </div> */}
      <MenuItemSelect
        popoverProps={{
          className: "roamjs-query-condition-relation",
        }}
        activeItem={con.relation}
        onItemSelect={(relation) => {
          setInputSetting({
            blockUid: con.uid,
            key: "Relation",
            value: relation,
            index: 1,
          });
          setConditions(
            conditions.map((c) =>
              c.uid === con.uid ? { ...con, relation } : c
            )
          );
        }}
        items={conditionLabels}
        emptyValueText={"Choose relationship"}
        ButtonProps={{
          style: {
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
          },
        }}
      />
      <Switch
        label="NOT"
        style={{
          marginBottom: 0,
          color: con.not ? "#000000" : "#ffffff",
          minWidth: 72,
        }}
        checked={con.not}
        onChange={(e) => {
          const not = (e.target as HTMLInputElement).checked;
          setConditions(
            conditions.map((c) => (c.uid === con.uid ? { ...con, not } : c))
          );
          if (not)
            createBlock({
              parentUid: con.uid,
              node: { text: "not" },
              order: 4,
            });
          else deleteBlock(getSubTree({ key: "not", parentUid: con.uid }).uid);
        }}
      />
      <div className="roamjs-query-condition-target">
        <AutocompleteInput
          value={con.target}
          setValue={(e) => {
            window.clearTimeout(debounceRef.current);
            setConditions(
              conditions.map((c) =>
                c.uid === con.uid ? { ...con, target: e } : c
              )
            );
            debounceRef.current = window.setTimeout(() => {
              setInputSetting({
                blockUid: con.uid,
                value: e,
                key: "target",
                index: 2,
              });
            }, 1000);
          }}
          options={targetOptions}
        />
      </div>
      <Button
        icon={"trash"}
        onClick={() => {
          deleteBlock(con.uid);
          setConditions(conditions.filter((c) => c.uid !== con.uid));
        }}
        minimal
        style={{ alignSelf: "end", minWidth: 30 }}
      />
    </div>
  );
};

const QuerySelection = ({
  sel,
  setSelections,
  selections,
}: {
  sel: Selection;
  setSelections: (cons: Selection[]) => void;
  selections: Selection[];
}) => {
  const debounceRef = useRef(0);
  return (
    <div style={{ display: "flex", margin: "8px 0", alignItems: "center" }}>
      <span
        style={{
          minWidth: 144,
          display: "inline-block",
          fontWeight: 600,
        }}
      >
        AS
      </span>
      <div style={{ minWidth: 144, paddingRight: 8, maxWidth: 144 }}>
        <InputGroup
          value={sel.label}
          onChange={(e) => {
            window.clearTimeout(debounceRef.current);
            setSelections(
              selections.map((c) =>
                c.uid === sel.uid ? { ...sel, label: e.target.value } : c
              )
            );
            debounceRef.current = window.setTimeout(() => {
              const firstChild = getFirstChildUidByBlockUid(sel.uid);
              if (firstChild) updateBlock({ uid: firstChild, text: sel.label });
              else
                createBlock({ parentUid: sel.uid, node: { text: sel.label } });
            }, 1000);
          }}
        />
      </div>
      <span
        style={{
          minWidth: 72,
          display: "inline-block",
          fontWeight: 600,
        }}
      >
        Select
      </span>
      <div
        style={{
          flexGrow: 1,
          minWidth: 300,
        }}
      >
        <InputGroup
          value={sel.text}
          style={{ width: "100%" }}
          onChange={(e) => {
            window.clearTimeout(debounceRef.current);
            setSelections(
              selections.map((c) =>
                c.uid === sel.uid ? { ...sel, text: e.target.value } : c
              )
            );
            debounceRef.current = window.setTimeout(() => {
              updateBlock({ uid: sel.uid, text: sel.text });
            }, 1000);
          }}
        />
      </div>
      <Button
        icon={"trash"}
        onClick={() => {
          deleteBlock(sel.uid).then(() =>
            setSelections(selections.filter((c) => c.uid !== sel.uid))
          );
        }}
        minimal
        style={{ alignSelf: "end", minWidth: 30 }}
      />
    </div>
  );
};

const QueryEditor = ({
  parentUid,
  defaultQuery,
  onQuery,
  defaultReturnNode,
}: {
  parentUid: string;
  defaultQuery: string[];
  onQuery: (query: {
    returnNode: string;
    conditions: Condition[];
    selections: Selection[];
  }) => Promise<void>;
  defaultReturnNode?: string;
}) => {
  const tree = useMemo(() => getBasicTreeByParentUid(parentUid), [parentUid]);
  const conditionLabels = useMemo(() => new Set(getConditionLabels()), []);
  const scratchNode = useMemo(
    () => tree.find((t) => toFlexRegex("scratch").test(t.text)),
    [tree]
  );
  const scratchNodeUid = useMemo(() => {
    if (scratchNode?.uid) return scratchNode?.uid;
    const newUid = window.roamAlphaAPI.util.generateUID();
    createBlock({
      node: { text: "scratch", uid: newUid },
      parentUid,
    });
    return newUid;
  }, [scratchNode, parentUid]);
  const scratchNodeChildren = useMemo(
    () => scratchNode?.children || [],
    [scratchNode]
  );
  const [returnNode, setReturnNode] = useState(
    () =>
      defaultReturnNode ||
      getSettingValueFromTree({ tree: scratchNodeChildren, key: "return" })
  );
  const debounceRef = useRef(0);
  const returnNodeOnChange = (value: string) => {
    window.clearTimeout(debounceRef.current);
    setReturnNode(value);
    debounceRef.current = window.setTimeout(() => {
      setInputSetting({
        blockUid: scratchNodeUid,
        value,
        key: "return",
      });
    }, 1000);
  };
  const conditionsNode = useSubTree({
    tree: scratchNodeChildren,
    key: "conditions",
  });
  const conditionsNodeUid = useMemo(() => {
    if (conditionsNode?.uid) return conditionsNode?.uid;
    const newUid = window.roamAlphaAPI.util.generateUID();
    createBlock({
      node: { text: "conditions", uid: newUid },
      parentUid: scratchNodeUid,
    });
    return newUid;
  }, [conditionsNode, scratchNodeUid]);
  const conditionsNodeChildren = useMemo(
    () => conditionsNode?.children || [],
    [conditionsNode]
  );
  const [conditions, setConditions] = useState<Condition[]>(() => {
    return conditionsNodeChildren.map(({ uid, children }) => ({
      uid,
      source: getSettingValueFromTree({ tree: children, key: "source" }),
      target: getSettingValueFromTree({ tree: children, key: "target" }),
      relation: getSettingValueFromTree({ tree: children, key: "relation" }),
      not: !!getSubTree({ tree: children, key: "not" }).uid,
      type: "clause",
    }));
  });

  const selectionsNode = useMemo(
    () =>
      scratchNodeChildren.find((t) => toFlexRegex("selections").test(t.text)),
    [scratchNodeChildren]
  );
  const selectionsNodeUid = useMemo(() => {
    if (selectionsNode?.uid) return selectionsNode?.uid;
    const newUid = window.roamAlphaAPI.util.generateUID();
    createBlock({
      node: { text: "selections", uid: newUid },
      parentUid: scratchNodeUid,
    });
    return newUid;
  }, [selectionsNode, scratchNodeUid]);
  const selectionsNodeChildren = useMemo(
    () => selectionsNode?.children || [],
    [selectionsNode]
  );
  const [selections, setSelections] = useState<Selection[]>(() => {
    return selectionsNodeChildren.map(({ uid, text, children }) => ({
      uid,
      text,
      label: children?.[0]?.text || "",
    }));
  });
  useEffect(() => {
    const {
      returnNode: value,
      conditions,
      selections,
    } = parseQuery({
      uid: "",
      text: "",
      children: defaultQuery.map((text) => ({ text, uid: "", children: [] })),
    });
    Promise.all([
      setInputSetting({
        blockUid: scratchNodeUid,
        value,
        key: "return",
      }),
      Promise.all(
        conditions.map((condition, order) =>
          condition.type === "clause" || condition.type === "not"
            ? createBlock({
                parentUid: conditionsNodeUid,
                order,
                node: {
                  text: `${order}`,
                  children: [
                    { text: "source", children: [{ text: condition.source }] },
                    {
                      text: "relation",
                      children: [{ text: condition.relation }],
                    },
                    { text: "target", children: [{ text: condition.target }] },
                    ...(condition.type === "not" ? [{ text: "not" }] : []),
                  ],
                },
              }).then((uid) => ({
                source: condition.source,
                relation: condition.relation,
                target: condition.target,
                uid,
                not: condition.not,
                type: "clause" as const,
              }))
            : Promise.resolve(condition)
        )
      ),
      Promise.all(
        selections.map((sel, order) =>
          createBlock({
            parentUid: selectionsNodeUid,
            order,
            node: {
              text: sel.text,
              uid: sel.uid,
              children: [{ text: sel.label }],
            },
          }).then(() => sel)
        )
      ),
    ]).then(([, conditionNodesWithUids, selections]) => {
      if (!defaultReturnNode) setReturnNode(value);
      setConditions(conditionNodesWithUids);
      setSelections(selections);
    });
  }, [
    defaultReturnNode,
    defaultQuery,
    setReturnNode,
    setConditions,
    conditionsNodeUid,
    selectionsNodeUid,
    setSelections,
    scratchNodeUid,
  ]);
  useEffect(() => {
    if (!window.roamAlphaAPI.data.fast?.q)
      renderSimpleAlert({
        content:
          'This feature depends on using the latest version of Roam.\n\nPlease click "Check for Updates" from the top right menu to update Roam!',
        onConfirm: () => {},
      });
  }, []);
  return (
    <div
      style={{
        padding: 16,
      }}
    >
      <H6
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            minWidth: 144,
            display: "inline-block",
          }}
        >
          Find
        </span>
        <InputGroup
          autoFocus
          value={returnNode}
          disabled={!!defaultReturnNode}
          onChange={(e) => {
            returnNodeOnChange(e.target.value);
          }}
          placeholder={"Enter Label..."}
          className="roamjs-query-return-node"
        />
        <span
          style={{
            flexGrow: 1,
            display: "inline-block",
            minWidth: 300,
          }}
        >
          Where
        </span>
      </H6>
      {conditions.map((con, index) => (
        <QueryCondition
          key={con.uid}
          con={con as QBClauseData}
          index={index}
          conditions={conditions as QBClauseData[]}
          returnNode={returnNode}
          setConditions={setConditions as (cs: QBClauseData[]) => void}
        />
      ))}
      {selections.map((sel) => (
        <QuerySelection
          key={sel.uid}
          sel={sel}
          selections={selections}
          setSelections={setSelections}
        />
      ))}
      <div style={{ display: "flex" }}>
        <span style={{ minWidth: 144, display: "inline-block" }}>
          <Button
            rightIcon={"plus"}
            text={"Add Condition"}
            style={{ maxHeight: 32 }}
            onClick={() => {
              createBlock({
                parentUid: conditionsNodeUid,
                order: conditions.length,
                node: {
                  text: `${conditions.length}`,
                },
              }).then((uid) =>
                setConditions([
                  ...conditions,
                  {
                    uid,
                    source: "",
                    relation: "",
                    target: "",
                    not: false,
                    type: "clause",
                  },
                ])
              );
            }}
          />
        </span>
        <span style={{ display: "inline-block", minWidth: 144 }}>
          <Button
            rightIcon={"plus"}
            text={"Add Selection"}
            style={{ maxHeight: 32 }}
            onClick={() => {
              createBlock({
                parentUid: selectionsNodeUid,
                order: selections.length,
                node: {
                  text: ``,
                },
              }).then((uid) =>
                setSelections([...selections, { uid, text: "", label: "" }])
              );
            }}
          />
        </span>
        <span
          style={{ display: "inline-block", textAlign: "end", flexGrow: 1 }}
        >
          <Button
            text={"Query"}
            onClick={() => {
              onQuery({
                conditions,
                returnNode,
                selections,
              })
                .then(() =>
                  setInputSetting({
                    blockUid: scratchNodeUid,
                    value: "",
                    key: "return",
                  })
                )
                .then(() => {
                  setReturnNode("");
                  setConditions([]);
                  setSelections([]);
                });
            }}
            style={{ maxHeight: 32 }}
            intent={"primary"}
            disabled={
              !conditions.every(
                (c) =>
                  c.type !== "or" &&
                  c.type !== "not or" &&
                  conditionLabels.has(c.relation) &&
                  !!c.target
              ) ||
              !returnNode ||
              selections.some((s) => !s.text)
            }
          />
        </span>
      </div>
    </div>
  );
};

export default QueryEditor;
