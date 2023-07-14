import {
  Button,
  Checkbox,
  H6,
  InputGroup,
  Switch,
  Tabs,
  Tab,
  TextArea,
  Tooltip,
} from "@blueprintjs/core";
import React, {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import createBlock from "roamjs-components/writes/createBlock";
import setInputSetting from "roamjs-components/util/setInputSetting";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import {
  getConditionLabels,
  isTargetVariable,
  registerDatalogTranslator,
  sourceToTargetOptions,
  sourceToTargetPlaceholder,
} from "../utils/conditionToDatalog";
import getSubTree from "roamjs-components/util/getSubTree";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getNthChildUidByBlockUid from "roamjs-components/queries/getNthChildUidByBlockUid";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import parseQuery, { DEFAULT_RETURN_NODE } from "../utils/parseQuery";
import { getDatalogQuery } from "../utils/fireQuery";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import {
  Condition,
  QBClause,
  QBNot,
  QBNestedData,
  QBClauseData,
  Selection,
} from "../utils/types";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import getSamePageAPI from "@samepage/external/getSamePageAPI";
import {
  ALL_SELECTION_SUGGESTIONS,
  SelectionSuggestion,
} from "../utils/predefinedSelections";

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
  getAvailableVariables,
}: {
  con: QBClause | QBNot;
  index: number;
  setConditions: React.Dispatch<React.SetStateAction<Condition[]>>;
  getAvailableVariables: (index: number) => string[];
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
  const setConditionRelation = useCallback(
    (e: string, timeout: boolean = true) => {
      window.clearTimeout(debounceRef.current);
      setConditions((_conditions) =>
        _conditions.map((c) => (c.uid === con.uid ? { ...c, relation: e } : c))
      );
      debounceRef.current = window.setTimeout(
        () => {
          setInputSetting({
            blockUid: con.uid,
            key: "Relation",
            value: e,
            index: 1,
          });
        },
        timeout ? 1000 : 0
      );
    },
    [setConditions, con.uid]
  );
  const setConditionTarget = useCallback(
    (e, timeout: boolean = true) => {
      window.clearTimeout(debounceRef.current);
      setConditions((_conditions) =>
        _conditions.map((c) => (c.uid === con.uid ? { ...c, target: e } : c))
      );
      debounceRef.current = window.setTimeout(
        () => {
          setInputSetting({
            blockUid: con.uid,
            value: e,
            key: "target",
            index: 2,
          });
        },
        timeout ? 1000 : 0
      );
    },
    [setConditions, con.uid]
  );
  const availableSources = useMemo(
    () => getAvailableVariables(index),
    [getAvailableVariables, index]
  );
  return (
    <>
      <MenuItemSelect
        popoverProps={{
          className: "roamjs-query-condition-source",
        }}
        ButtonProps={{
          id: `${con.uid}-source`,
        }}
        activeItem={con.source}
        items={availableSources}
        onItemSelect={(value) => {
          setInputSetting({
            blockUid: con.uid,
            key: "source",
            value,
          });
          setConditions((_conditions) =>
            _conditions.map((c) =>
              c.uid === con.uid ? { ...con, source: value } : c
            )
          );
        }}
      />
      <div className="roamjs-query-condition-relation">
        <AutocompleteInput
          value={con.relation}
          setValue={setConditionRelation}
          onBlur={(e) => setConditionRelation(e, false)}
          options={conditionLabels}
          placeholder={"Choose relationship"}
          id={`${con.uid}-relation`}
        />
      </div>
      <div className="roamjs-query-condition-target">
        <AutocompleteInput
          value={con.target}
          setValue={setConditionTarget}
          onBlur={(e) => setConditionTarget(e, false)}
          options={targetOptions}
          placeholder={targetPlaceholder}
          id={`${con.uid}-target`}
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
        ({con.conditions.length}) BRANCHES
      </span>
      <span
        style={{
          flexGrow: 1,
          minWidth: 260,
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
  getAvailableVariables,
  setView,
}: {
  con: Condition;
  index: number;
  setConditions: React.Dispatch<React.SetStateAction<Condition[]>>;
  getAvailableVariables: (n: number) => string[];

  setView: (s: { uid: string; branch: number }) => void;
}) => {
  return (
    <div style={{ display: "flex", margin: "8px 0", alignItems: "baseline" }}>
      <MenuItemSelect
        popoverProps={{
          className: "roamjs-query-condition-type",
        }}
        activeItem={con.type}
        items={["clause", "not", "or", "not or"]}
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
            setConditions((_conditions) =>
              _conditions.map((c) =>
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
        <QueryClause
          con={con}
          index={index}
          setConditions={setConditions}
          getAvailableVariables={getAvailableVariables}
        />
      )}
      {(con.type === "not or" || con.type === "or") && (
        <QueryNestedData con={con} setView={setView} />
      )}
      <Button
        icon={"trash"}
        onClick={() => {
          deleteBlock(con.uid);
          setConditions((_conditions) =>
            _conditions.filter((c) => c.uid !== con.uid)
          );
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
  getAvailableVariables,
}: {
  sel: Selection;
  setSelections: React.Dispatch<React.SetStateAction<Selection[]>>;
  getAvailableVariables: (n: number) => string[];
}) => {
  const debounceRef = useRef(0);
  const setSelectionLabel = useCallback(
    (e, timeout: boolean = true) => {
      window.clearTimeout(debounceRef.current);
      const label = e.target.value;
      setSelections((selections) =>
        selections.map((s) => (s.uid === sel.uid ? { ...s, label } : s))
      );
      debounceRef.current = window.setTimeout(
        () => {
          const firstChild = getFirstChildUidByBlockUid(sel.uid);
          if (firstChild) updateBlock({ uid: firstChild, text: label });
          else createBlock({ parentUid: sel.uid, node: { text: label } });
        },
        timeout ? 1000 : 0
      );
    },
    [setSelections, sel.uid]
  );
  const setSelectionData = useCallback(
    (text: string, timeout: boolean = true) => {
      window.clearTimeout(debounceRef.current);
      setSelections((selections) =>
        selections.map((s) => (s.uid === sel.uid ? { ...s, text } : s))
      );
      debounceRef.current = window.setTimeout(
        () => {
          updateBlock({ uid: sel.uid, text });
        },
        timeout ? 1000 : 0
      );
    },
    [setSelections, sel.uid]
  );
  const setSelectionDataOnBlur = useCallback(
    (e: string) => {
      setSelectionData(e, false);
    },
    [setSelectionData]
  );
  const selectionOptions = useMemo(() => {
    const variables = getAvailableVariables(Number.MAX_VALUE);
    return ALL_SELECTION_SUGGESTIONS.flatMap((s) => {
      if (s.includes("{{node}}")) {
        return variables.map((v) => s.replace("{{node}}", v));
      }
      return [s];
    });
  }, [getAvailableVariables]);

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
          id={`${sel.uid}-as`}
          onChange={setSelectionLabel}
          onBlur={(e) => {
            setSelectionLabel(e, false);
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
        SELECT
      </span>
      <div
        style={{
          flexGrow: 1,
          minWidth: 240,
        }}
      >
        <AutocompleteInput
          value={sel.text}
          // style={{ width: "100%" }}
          id={`${sel.uid}-select`}
          setValue={setSelectionData}
          onBlur={setSelectionDataOnBlur}
          options={selectionOptions}
        />
      </div>
      <Button
        icon={"trash"}
        onClick={() => {
          deleteBlock(sel.uid).then(() =>
            setSelections((selections) =>
              selections.filter((c) => c.uid !== sel.uid)
            )
          );
        }}
        minimal
        style={{ alignSelf: "end", minWidth: 30 }}
      />
    </div>
  );
};

const getConditionByUid = (
  uid: string,
  conditions: Condition[]
): Condition | undefined => {
  for (const con of conditions) {
    if (con.uid === uid) return con;
    if (con.type === "or" || con.type === "not or") {
      const c = getConditionByUid(uid, con.conditions.flat());
      if (c) return c;
    }
  }
  return undefined;
};

type QueryEditorComponent = (props: {
  parentUid: string;
  onQuery?: () => void;
  hideCustomSwitch?: boolean;
  showAlias?: boolean;
}) => JSX.Element;

const QueryEditor: QueryEditorComponent = ({
  parentUid,
  onQuery,
  hideCustomSwitch,
  showAlias,
}) => {
  const [conditionLabels, setConditionLabels] = useState(
    () => new Set(getConditionLabels())
  );
  const {
    conditionsNodesUid,
    selectionsNodesUid,
    conditions: initialConditions,
    selections: initialSelections,
    customNodeUid,
    customNode: initialCustom,
    isCustomEnabled: initialIsCustomEnabled,
    isSamePageEnabled: initialIsSamePageEnabled,
  } = useMemo(() => parseQuery(parentUid), [parentUid]);
  const debounceRef = useRef(0);
  const [conditions, _setConditions] = useState(initialConditions);
  const [selections, setSelections] = useState(initialSelections);
  const [custom, setCustom] = useState(initialCustom);
  const customNodeOnChange = (value: string) => {
    window.clearTimeout(debounceRef.current);
    setCustom(value);
    debounceRef.current = window.setTimeout(async () => {
      const childUid = getFirstChildUidByBlockUid(customNodeUid);
      if (childUid)
        updateBlock({
          uid: childUid,
          text: value,
        });
      else createBlock({ parentUid: customNodeUid, node: { text: value } });
    }, 1000);
  };
  const [viewStack, setViewStack] = useState([{ uid: parentUid, branch: 0 }]);
  const view = useMemo(() => viewStack.slice(-1)[0], [viewStack]);
  const viewCondition = useMemo(
    () =>
      view.uid === parentUid
        ? undefined
        : (getConditionByUid(view.uid, conditions) as QBNestedData),
    [view, conditions]
  );
  const setConditions = useMemo<
    React.Dispatch<React.SetStateAction<Condition[]>>
  >(() => {
    if (view.uid === parentUid) return _setConditions;
    return (nestedConditions) => {
      if (!viewCondition) return;
      if (typeof nestedConditions === "function") {
        viewCondition.conditions[view.branch] = nestedConditions(
          viewCondition.conditions[view.branch]
        );
      } else {
        viewCondition.conditions[view.branch] = nestedConditions;
      }
      _setConditions((cons) => [...cons]);
    };
  }, [_setConditions, view.uid, parentUid, viewCondition, view.branch]);
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
          return `Condition ${index + 1} has an unsupported relation \`${
            condition.relation
          }\`.`;
        }
        if (!condition.target) {
          return `Condition ${index + 1} must not have an empty target.`;
        }
      } else if (!condition.conditions.length) {
        return `Condition ${index + 1} must have at least one sub-condition.`;
      }
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
  }, [selections, conditionLabels, conditions]);
  const [isCustomEnabled, setIsCustomEnabled] = useState(
    initialIsCustomEnabled
  );
  const [isSamePageEnabled, setIsSamePageEnabled] = useState(
    initialIsSamePageEnabled
  );
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [label, setLabel] = useState(() => {
    const aliasMatch = getTextByBlockUid(parentUid).match(
      /{{query block:(.*?)}}/
    );
    return !!aliasMatch && aliasMatch[1] !== "" ? aliasMatch[1] : "";
  });
  const [showDisabledMessage, setShowDisabledMessage] = useState(false);
  useEffect(() => {
    if (
      !conditionLabels.has("is in notebook") &&
      typeof window.samepage !== "undefined"
    ) {
      getSamePageAPI()
        .then(async (api) => {
          const { notebooks } = await api.listNotebooks();
          registerDatalogTranslator({
            key: "is in notebook",
            callback: () => [],
            isVariable: true,
            placeholder: `Roam ${window.roamAlphaAPI.graph.name}`,
            targetOptions: notebooks.map((n) => `${n.appName} ${n.workspace}`),
          });
          setConditionLabels(new Set(getConditionLabels()));
        })
        .catch(console.error);
    }
  }, [conditionLabels, setConditionLabels]);
  const getAvailableVariables = useCallback(
    (index: number) =>
      Array.from(
        new Set(getSourceCandidates(viewConditions.slice(0, index)))
      ).concat(DEFAULT_RETURN_NODE),
    [viewConditions]
  );
  return view.uid === parentUid ? (
    <div className={"p-4 overflow-auto"}>
      <H6
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCustomEnabled ? "flex-end" : "space-between",
        }}
      >
        {!isCustomEnabled && (
          <>
            <span
              style={{
                minWidth: 144,
                display: "inline-block",
              }}
            >
              FIND
            </span>
            <InputGroup
              autoFocus
              defaultValue={DEFAULT_RETURN_NODE}
              disabled
              className="roamjs-query-return-node"
            />
            <span
              style={{
                flexGrow: 1,
                display: "inline-block",
                minWidth: 144,
              }}
            >
              WHERE
            </span>
          </>
        )}
        <style>{`.roamjs-query-custom-enabled.bp3-control.bp3-switch .bp3-control-indicator-child:first-child {
    height: 0;
}`}</style>
        {isCustomEnabled && (
          <div className="pr-4">
            <Tooltip
              content={"Copy Datalog Query"}
              position={"left"}
              openOnTargetFocus={false}
              lazy={true}
              hoverOpenDelay={250}
              autoFocus={false}
            >
              <Button
                minimal
                icon={"clipboard"}
                onClick={() => {
                  navigator.clipboard.writeText(custom);
                }}
              />
            </Tooltip>
          </div>
        )}
        <div
          style={{
            minWidth: 240,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {!showAlias ? (
            <div />
          ) : isEditingLabel ? (
            <InputGroup
              placeholder={"Enter Alias"}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateBlock({
                    uid: parentUid,
                    text: `{{query block:${label}}}`,
                  });
                  setIsEditingLabel(false);
                }
              }}
              autoFocus
              rightElement={
                <Button
                  minimal
                  icon={"confirm"}
                  onClick={() => {
                    updateBlock({
                      uid: parentUid,
                      text: `{{query block:${label}}}`,
                    });
                    setIsEditingLabel(false);
                  }}
                />
              }
            />
          ) : (
            <span
              tabIndex={-1}
              onClick={() => setIsEditingLabel(true)}
              className={`${
                !!label ? "" : "italic opacity-25 text-sm"
              } inline-block flex-grow`}
            >
              {!!label ? label : "edit alias"}
            </span>
          )}
          {!hideCustomSwitch && (
            <Switch
              checked={!isCustomEnabled}
              className={"roamjs-query-custom-enabled"}
              onChange={(e) => {
                const enabled = !(e.target as HTMLInputElement).checked;
                const contentUid = getNthChildUidByBlockUid({
                  blockUid: customNodeUid,
                  order: 0,
                });
                const enabledUid = getNthChildUidByBlockUid({
                  blockUid: customNodeUid,
                  order: 1,
                });
                if (enabled) {
                  const { query: text } = getDatalogQuery({
                    conditions,
                    selections,
                  });
                  if (contentUid) updateBlock({ text, uid: contentUid });
                  else
                    createBlock({
                      parentUid: customNodeUid,
                      order: 0,
                      node: {
                        text,
                      },
                    });
                  setCustom(text);
                  if (enabledUid)
                    updateBlock({ text: "enabled", uid: enabledUid });
                  else
                    createBlock({
                      parentUid: customNodeUid,
                      order: 1,
                      node: { text: "enabled" },
                    });
                } else {
                  if (contentUid) {
                    // TODO - translate from custom back into english - seems very hard!
                  }
                  if (enabledUid) deleteBlock(enabledUid);
                }
                setIsCustomEnabled(enabled);
              }}
              innerLabelChecked={"ENG"}
              innerLabel={"DATA"}
            />
          )}
        </div>
      </H6>
      {isCustomEnabled ? (
        <TextArea
          value={custom}
          onChange={(e) => customNodeOnChange(e.target.value)}
          className={"w-full mb-8"}
          style={{ resize: "vertical", fontFamily: "monospace" }}
          rows={8}
        />
      ) : (
        <>
          {conditions.map((con, index) => (
            <QueryCondition
              key={con.uid}
              con={con}
              index={index}
              getAvailableVariables={getAvailableVariables}
              setConditions={setConditions}
              setView={(v) => setViewStack([...viewStack, v])}
            />
          ))}
          {selections.map((sel) => (
            <QuerySelection
              key={sel.uid}
              sel={sel}
              setSelections={setSelections}
              getAvailableVariables={getAvailableVariables}
            />
          ))}
        </>
      )}
      <div style={{ display: "flex" }}>
        <span style={{ minWidth: 144, display: "inline-block" }}>
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
            rightIcon={"search-around"}
          />
        </span>
        <span style={{ minWidth: 144, display: "inline-block" }}>
          <Button
            disabled={isCustomEnabled}
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
            disabled={isCustomEnabled}
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
        <span
          className="flex-grow flex gap-4 justify-end items-center"
          style={{ minWidth: 240 }}
        >
          {showDisabledMessage && (
            <span className="text-red-700 inline-block text-xs">
              {disabledMessage}
            </span>
          )}
          {window.samepage && (
            <Checkbox
              labelElement={
                <Tooltip
                  content={
                    "Use SamePage's backend to fire this query [EXPERIMENTAL]."
                  }
                >
                  <img
                    src="https://samepage.network/images/logo.png"
                    height={24}
                    width={24}
                  />
                </Tooltip>
              }
              style={{ marginBottom: 0, minWidth: 64, textAlign: "right" }}
              checked={isSamePageEnabled}
              onChange={(e) => {
                const enabled = (e.target as HTMLInputElement).checked;
                const scratchNode = getSubTree({ parentUid, key: "scratch" });
                const enabledUid = getSubTree({
                  tree: scratchNode.children,
                  key: "samepage",
                }).uid;
                if (enabled && !enabledUid) {
                  createBlock({
                    parentUid: scratchNode.uid,
                    order: 0,
                    node: {
                      text: "samepage",
                    },
                  });
                } else if (!enabled && enabledUid) {
                  deleteBlock(enabledUid);
                }
                setIsSamePageEnabled(enabled);
              }}
            />
          )}
        </span>
      </div>
    </div>
  ) : (
    <div className={"p-4"}>
      <div>
        <h4>OR Branches</h4>
        <Tabs
          selectedTabId={view.branch}
          onChange={(e) =>
            setViewStack(
              viewStack
                .slice(0, -1)
                .concat([{ uid: view.uid, branch: Number(e) }])
            )
          }
        >
          {viewCondition &&
            Array(viewCondition.conditions.length)
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
                          getAvailableVariables={getAvailableVariables}
                          setConditions={setConditions}
                          setView={(v) => setViewStack([...viewStack, v])}
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
                setViewStack(viewStack.slice(0, -1));
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
                    setConditions((cons) => [
                      ...cons,
                      {
                        uid,
                        source: "",
                        relation: "",
                        target: "",
                        type: "clause",
                      },
                    ]);
                  });
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
                  const newBranch = viewCondition?.conditions.length || 0;
                  viewCondition?.conditions.push([]);
                  setViewStack((vs) =>
                    vs.slice(0, -1).concat({
                      uid: view.uid,
                      branch: newBranch,
                    })
                  );
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
