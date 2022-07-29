import { Button, H6, InputGroup, Switch, Tabs, Tab } from "@blueprintjs/core";
import React, { useMemo, useRef, useState } from "react";
import createBlock from "roamjs-components/writes/createBlock";
import setInputSetting from "roamjs-components/util/setInputSetting";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import {
  getConditionLabels,
  isTargetVariable,
  sourceToTargetOptions,
  sourceToTargetPlaceholder,
} from "../utils/conditionToDatalog";
import getSubTree from "roamjs-components/util/getSubTree";
import {
  Condition,
  QBClause,
  QBClauseData,
  QBNestedData,
  QBNot,
  Selection,
} from "roamjs-components/types/query-builder";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getNthChildUidByBlockUid from "roamjs-components/queries/getNthChildUidByBlockUid";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import parseQuery from "../utils/parseQuery";

const getSourceCandidates = (cs: Condition[]): string[] =>
  cs.flatMap((c) =>
    c.type === "clause" || c.type === "not"
      ? isTargetVariable({ relation: c.relation })
        ? [c.target]
        : []
      : getSourceCandidates(c.conditions.flat())
  );

const QueryClause = ({
  con,
  index,
  setConditions,
  conditions,
  availableSources,
}: {
  con: QBClause | QBNot;
  index: number;
  setConditions: (cons: Condition[]) => void;
  conditions: Condition[];
  availableSources: string[];
}) => {
  const debounceRef = useRef(0);
  const conditionLabels = useMemo(getConditionLabels, []);
  const targetOptions = useMemo(
    () => sourceToTargetOptions({ source: con.source, relation: con.relation }),
    [con.source, con.relation]
  );
  const targetPlaceholder = useMemo(
    () => sourceToTargetPlaceholder({ relation: con.relation }),
    [con.source, con.relation]
  );
  return (
    <>
      <MenuItemSelect
        popoverProps={{
          className: "roamjs-query-condition-source",
        }}
        activeItem={con.source}
        items={Array.from(
          new Set(getSourceCandidates(conditions.slice(0, index)))
        ).concat(availableSources)}
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
      </div>
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
            conditions.map((c) =>
              c.uid === con.uid
                ? { ...con, not, type: not ? "not" : "clause" }
                : c
            )
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
          placeholder={targetPlaceholder}
        />
      </div>
    </>
  );
};

const QueryNestedData = ({
  con,
  setView,
}: {
  con: QBNestedData;
  setView: (s: { uid: string; branch: number }) => void;
}) => {
  return (
    <>
      <Button
        rightIcon={"arrow-right"}
        text={"Edit"}
        onClick={() => setView({ uid: con.uid, branch: 0 })}
        style={{
          minWidth: 144,
          maxWidth: 144,
          paddingRight: 8,
        }}
      />
      <span
        style={{
          minWidth: 144,
          display: "inline-block",
          fontWeight: 600,
        }}
      >
        ({con.conditions.length}) Branches
      </span>
      <span
        style={{
          flexGrow: 1,
          minWidth: 300,
          width: "100%",
          display: "inline-block",
        }}
      ></span>
    </>
  );
};

const QueryCondition = ({
  con,
  index,
  setConditions,
  conditions,
  availableSources,
  setView,
}: {
  con: Condition;
  index: number;
  setConditions: (cons: Condition[]) => void;
  conditions: Condition[];
  availableSources: string[];
  setView: (s: { uid: string; branch: number }) => void;
}) => {
  return (
    <div style={{ display: "flex", margin: "8px 0", alignItems: "baseline" }}>
      {(con.type === "clause" || con.type === "not") && (
        <QueryClause
          con={con}
          index={index}
          setConditions={setConditions}
          conditions={conditions}
          availableSources={availableSources}
        />
      )}
      {(con.type === "not or" || con.type === "or") && (
        <QueryNestedData con={con} setView={setView} />
      )}
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
            const label = e.target.value;
            setSelections(
              selections.map((c) => (c.uid === sel.uid ? { ...sel, label } : c))
            );
            debounceRef.current = window.setTimeout(() => {
              const firstChild = getFirstChildUidByBlockUid(sel.uid);
              if (firstChild) updateBlock({ uid: firstChild, text: label });
              else createBlock({ parentUid: sel.uid, node: { text: label } });
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
              updateBlock({ uid: sel.uid, text: e.target.value });
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

const getConditionByUid = (uid: string, conditions: Condition[]): Condition => {
  for (const con of conditions) {
    if (con.uid === uid) return con;
    if (con.type === "or" || con.type === "not or") {
      const c = getConditionByUid(uid, con.conditions.flat());
      if (c) return c;
    }
  }
  return undefined;
};

const QueryEditor: typeof window.roamjs.extension.queryBuilder.QueryEditor = ({
  parentUid,
  onQuery,
  defaultReturnNode, // returnNodeDisabled
}) => {
  const conditionLabels = useMemo(() => new Set(getConditionLabels()), []);
  const {
    returnNodeUid,
    conditionsNodesUid,
    selectionsNodesUid,
    returnNode: initialReturnNode,
    conditions: initialConditions,
    selections: initialSelections,
  } = useMemo(() => parseQuery(parentUid), [parentUid]);
  const [returnNode, setReturnNode] = useState(() => initialReturnNode);
  const debounceRef = useRef(0);
  const returnNodeOnChange = (value: string) => {
    window.clearTimeout(debounceRef.current);
    setReturnNode(value);
    debounceRef.current = window.setTimeout(() => {
      const childUid = getFirstChildUidByBlockUid(returnNodeUid);
      if (childUid)
        updateBlock({
          uid: childUid,
          text: value,
        });
      else createBlock({ parentUid: returnNodeUid, node: { text: value } });
    }, 1000);
  };
  const [conditions, setConditions] = useState(initialConditions);
  const [selections, setSelections] = useState(initialSelections);
  const [views, setViews] = useState([{ uid: parentUid, branch: 0 }]);
  const view = useMemo(() => views.slice(-1)[0], [views]);
  const viewCondition = useMemo(
    () =>
      view.uid === parentUid
        ? undefined
        : (getConditionByUid(view.uid, conditions) as QBNestedData),
    [view, conditions]
  );
  const viewConditions = useMemo(
    () =>
      view.uid === parentUid
        ? conditions
        : viewCondition?.conditions?.[view.branch] || [],
    [view, viewCondition, conditions]
  );
  const disabledMessage = useMemo(() => {
    for (let index = 0; index < conditions.length; index++) {
      const condition = conditions[index];
      if (condition.type === "clause" || condition.type === "not") {
        if (!condition.relation) {
          return `Condition ${index + 1} must not have an empty relation.`;
        }
        if (!conditionLabels.has(condition.relation)) {
          return `Condition ${index + 1} has an unsupported relation ${
            condition.relation
          }.`;
        }
        if (!condition.target) {
          return `Condition ${index + 1} must not have an empty target.`;
        }
      } else if (!condition.conditions.length) {
        return `Condition ${index + 1} must have at least one sub-condition.`;
      }
    }
    if (!returnNode) {
      return `Query must have a value specified in the "Find ... Where" input`;
    }
    for (let index = 0; index < selections.length; index++) {
      const selection = selections[index];
      if (!selection.text) {
        return `Selection ${index + 1} must not have an empty select value.`;
      }
      if (!selection.label) {
        return `Selection ${index + 1} must not have an empty select alias.`;
      }
    }
    return "";
  }, [returnNode, selections, conditionLabels, conditions]);
  const [showDisabledMessage, setShowDisabledMessage] = useState(false);
  return view.uid === parentUid ? (
    <div className={"p-4 overflow-auto"}>
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
          con={con}
          index={index}
          conditions={conditions}
          availableSources={[returnNode]}
          setConditions={setConditions}
          setView={(v) => setViews([...views, v])}
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
                parentUid: conditionsNodesUid,
                order: conditions.length,
                node: {
                  text: "clause",
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
                parentUid: selectionsNodesUid,
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
        <span className="flex-grow flex gap-4 justify-end items-center">
          {showDisabledMessage && (
            <span className="text-red-700 inline-block">{disabledMessage}</span>
          )}
          <Button
            onMouseEnter={() =>
              !!disabledMessage && setShowDisabledMessage(true)
            }
            onMouseLeave={() => setShowDisabledMessage(false)}
            text={"Query"}
            onClick={disabledMessage ? undefined : onQuery}
            className={disabledMessage ? "bp3-disabled" : ""}
            style={{
              maxHeight: 32,
              outline: disabledMessage ? "none" : "inherit",
            }}
            intent={"primary"}
          />
        </span>
      </div>
    </div>
  ) : (
    <div
      style={{
        padding: 16,
      }}
    >
      <div>
        <h4>OR Branches</h4>
        <Tabs
          selectedTabId={view.branch}
          onChange={(e) =>
            setViews(
              views.slice(0, -1).concat([{ uid: view.uid, branch: Number(e) }])
            )
          }
        >
          {Array(viewCondition.conditions.length)
            .fill(null)
            .map((_, j) => (
              <Tab
                key={j}
                id={j}
                title={`${j + 1}`}
                panel={
                  <>
                    {viewConditions.map((con, index) => (
                      <QueryCondition
                        key={con.uid}
                        con={con}
                        index={index}
                        conditions={viewConditions}
                        availableSources={[
                          returnNode,
                          ...conditions
                            .filter(
                              (c) => c.type === "clause" || c.type === "not"
                            )
                            .map((c) => (c as QBClauseData).target),
                        ]}
                        setConditions={(cons) => {
                          viewCondition.conditions[view.branch] = cons;
                          setConditions([...conditions]);
                        }}
                        setView={(v) => setViews([...views, v])}
                      />
                    ))}
                  </>
                }
              />
            ))}
        </Tabs>
        <div style={{ display: "flex" }}>
          <span style={{ minWidth: 144, display: "inline-block" }}>
            <Button
              icon={"arrow-left"}
              text={"Back"}
              style={{ maxHeight: 32 }}
              onClick={() => {
                setViews(views.slice(0, -1));
              }}
            />
          </span>
          <span style={{ minWidth: 144, display: "inline-block" }}>
            <Button
              rightIcon={"plus"}
              text={"Add Branch"}
              style={{ maxHeight: 32 }}
              onClick={() => {
                createBlock({
                  parentUid: view.uid,
                  order: viewConditions.length,
                  node: {
                    text: `AND`,
                  },
                }).then(() => {
                  viewCondition.conditions.push([]);
                  setConditions([...conditions]);
                });
              }}
            />
          </span>
          <span style={{ minWidth: 144, display: "inline-block" }}>
            <Button
              rightIcon={"plus"}
              text={"Add Condition"}
              style={{ maxHeight: 32 }}
              onClick={() => {
                const branchUid = getNthChildUidByBlockUid({
                  blockUid: view.uid,
                  order: view.branch,
                });
                (branchUid
                  ? Promise.resolve(branchUid)
                  : createBlock({
                      parentUid: view.uid,
                      order: view.branch,
                      node: { text: "AND" },
                    })
                )
                  .then((branchUid) =>
                    createBlock({
                      parentUid: branchUid,
                      order: getChildrenLengthByPageUid(branchUid),
                      node: {
                        text: `clause`,
                      },
                    })
                  )
                  .then((uid) => {
                    viewCondition.conditions[view.branch] = [
                      ...viewConditions,
                      {
                        uid,
                        source: "",
                        relation: "",
                        target: "",
                        type: "clause",
                      },
                    ];
                    setConditions([...conditions]);
                  });
              }}
            />
          </span>
        </div>
      </div>
    </div>
  );
};

export default QueryEditor;
