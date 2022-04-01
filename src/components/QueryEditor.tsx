import { Button, H6, InputGroup, Switch, Tabs, Tab } from "@blueprintjs/core";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  isTargetVariable,
  sourceToTargetOptions,
  sourceToTargetPlaceholder,
} from "../utils/conditionToDatalog";
import { render as renderSimpleAlert } from "roamjs-components/components/SimpleAlert";
import getSubTree from "roamjs-components/util/getSubTree";
import useSubTree from "roamjs-components/hooks/useSubTree";
import {
  Condition,
  Selection,
  QBClauseData,
  QBNestedData,
} from "roamjs-components/types/query-builder";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getNthChildUidByBlockUid from "roamjs-components/queries/getNthChildUidByBlockUid";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";

const getSourceCandidates = (cs: Condition[]): string[] =>
  cs.flatMap((c) =>
    c.type === "clause" || c.type === "not"
      ? isTargetVariable({relation: c.relation}) ? [c.target] : []
      : getSourceCandidates(c.conditions.flat())
  );

const QueryClauseData = ({
  con,
  index,
  setConditions,
  conditions,
  availableSources,
}: {
  con: QBClauseData;
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
          new Set(
            getSourceCandidates(conditions
              .slice(0, index))
          )
        ).concat(availableSources)}
        onItemSelect={(value) => {
          setInputSetting({
            blockUid: con.uid,
            key: "source",
            value,
          });
          setConditions(
            conditions.map((c) =>
              c.uid === con.uid ? ({ ...con, source: value } as Condition) : c
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
                c.uid === con.uid ? { ...con, relation: e, type: "clause" } : c
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
            conditions.map((c) => (c.uid === con.uid ? { ...con, not, type: "not" } : c))
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
                c.uid === con.uid ? ({ ...con, target: e } as Condition) : c
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
      <MenuItemSelect
        popoverProps={{
          className: "roamjs-query-condition-type",
        }}
        activeItem={con.type}
        items={["or", "not or", "clause", "not"]}
        onItemSelect={(value) => {
          (((con.type === "or" || con.type === "not or") &&
            (value === "clause" || value === "not")) ||
          ((value === "or" || value === "not or") &&
            (con.type === "clause" || con.type === "not"))
            ? Promise.all(
                getShallowTreeByParentUid(con.uid).map((c) =>
                  deleteBlock(c.uid)
                )
              ).then(() => updateBlock({ uid: con.uid, text: value }))
            : updateBlock({
                uid: con.uid,
                text: value,
              })
          ).then(() => {
            setConditions(
              conditions.map((c) =>
                c.uid === con.uid
                  ? value === "clause" || value === "not"
                    ? {
                        uid: c.uid,
                        type: value,
                        source: (c as QBClauseData).source || "",
                        target: (c as QBClauseData).target || "",
                        relation: (c as QBClauseData).relation || "",
                      }
                    : {
                        uid: c.uid,
                        type: value,
                        conditions: (c as QBNestedData).conditions || [],
                      }
                  : c
              )
            );
          });
        }}
      />
      {(con.type === "clause" || con.type === "not") && (
        <QueryClauseData
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
          minWidth: 144,
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
  defaultReturnNode,
}) => {
  const conditionLabels = useMemo(() => new Set(getConditionLabels()), []);
  const debounceRef = useRef(0);
  const scratchNode = useSubTree({
    parentUid,
    key: "scratch",
  });
  const returnNodeOnChange = (value: string) => {
    window.clearTimeout(debounceRef.current);
    setReturnNode(value);
    debounceRef.current = window.setTimeout(() => {
      setInputSetting({
        blockUid: scratchNode.uid,
        value,
        key: "return",
      });
    }, 1000);
  };
  const parsedQuery = useMemo(() => parseQuery(scratchNode), [scratchNode]);
  const [returnNode, setReturnNode] = useState(
    () => defaultReturnNode || parsedQuery.returnNode
  );
  const [conditions, setConditions] = useState(parsedQuery.conditions);
  const [selections, setSelections] = useState(parsedQuery.selections);
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
  useEffect(() => {
    if (!window.roamAlphaAPI.data.fast?.q)
      renderSimpleAlert({
        content:
          'This feature depends on using the latest version of Roam.\n\nPlease click "Check for Updates" from the top right menu to update Roam!',
        onConfirm: () => {},
      });
  }, []);
  useEffect(() => {
    if (defaultReturnNode)
      setInputSetting({
        blockUid: scratchNode.uid,
        value: defaultReturnNode,
        key: "return",
      });
  }, [defaultReturnNode, scratchNode]);
  return view.uid === parentUid ? (
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
                parentUid: parsedQuery.conditionsNodesUid,
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
                parentUid: parsedQuery.selectionsNodesUid,
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
              const resultNode = getSubTree({ parentUid, key: "results" });
              const queryNode = getSubTree({
                parentUid: resultNode.uid,
                key: "query",
              });
              Promise.all([
                queryNode.children.map((q) => deleteBlock(q.uid)),
                window.roamAlphaAPI.moveBlock({
                  location: { "parent-uid": queryNode.uid, order: 0 },
                  block: { uid: parsedQuery.returnNodeUid },
                }),
                window.roamAlphaAPI.moveBlock({
                  location: { "parent-uid": queryNode.uid, order: 1 },
                  block: { uid: parsedQuery.conditionsNodesUid },
                }),
                window.roamAlphaAPI.moveBlock({
                  location: { "parent-uid": queryNode.uid, order: 2 },
                  block: { uid: parsedQuery.selectionsNodesUid },
                }),
              ]).then(() => {
                setReturnNode("");
                setConditions([]);
                setSelections([]);
                onQuery?.();
              });
            }}
            style={{ maxHeight: 32 }}
            intent={"primary"}
            disabled={
              !conditions.every((c) =>
                c.type === "not" || c.type == "clause"
                  ? conditionLabels.has(c.relation) && !!c.target
                  : c.conditions.length
              ) ||
              !returnNode ||
              selections.some((s) => !s.text)
            }
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
