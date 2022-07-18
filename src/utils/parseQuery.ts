import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { RoamBasicNode } from "roamjs-components/types/native";
import { Condition, ParseQuery } from "roamjs-components/types/query-builder";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import setInputSetting from "roamjs-components/util/setInputSetting";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import { getConditionLabels } from "./conditionToDatalog";

const oldParseQuery = (q: string[] | RoamBasicNode) => {
  const [findWhere = "", ...conditions] = Array.isArray(q)
    ? q
    : q.children.map((t) => t.text);
  const returnNode = findWhere.split(" ")[1] || "";
  const conditionLabels = getConditionLabels();
  const conditionNodes = conditions
    .filter((s) => !s.startsWith("Select"))
    .map((c) => {
      const not = /^NOT /.test(c);
      const condition = c.replace(/^NOT /, "");
      const relation =
        conditionLabels.find((l) => condition.includes(` ${l} `)) || "";
      const [source, target] = condition.split(` ${relation} `);
      return {
        source,
        relation,
        target,
        not,
        uid: window.roamAlphaAPI.util.generateUID(),
        type: not ? ("not" as const) : ("clause" as const),
      };
    })
    .filter((r) => !!r.relation);
  const selectionNodes = conditions
    .filter((s) => s.startsWith("Select"))
    .map((s) =>
      s
        .replace(/^Select/i, "")
        .trim()
        .split(" AS ")
    )
    .map(([text, label]) => ({
      uid: window.roamAlphaAPI.util.generateUID(),
      text,
      label,
    }));
  return {
    returnNode,
    conditions: conditionNodes,
    selections: selectionNodes,
    returnNodeUid: "",
    conditionsNodesUid: "",
    selectionsNodesUid: "",

    // @deprecated
    conditionNodes,
    selectionNodes,
  };
};

const roamNodeToCondition = ({
  uid,
  children,
  text,
}: RoamBasicNode): Condition => {
  const type = (
    isNaN(Number(text))
      ? text
      : !!getSubTree({ tree: children, key: "not" }).uid
      ? "not"
      : "clause"
  ) as Condition["type"];
  return type === "clause" || type === "not"
    ? {
        uid,
        source: getSettingValueFromTree({ tree: children, key: "source" }),
        target: getSettingValueFromTree({ tree: children, key: "target" }),
        relation: getSettingValueFromTree({
          tree: children,
          key: "relation",
        }),
        type,

        // @deprecated
        not: type === "not" || !!getSubTree({ tree: children, key: "not" }).uid,
      }
    : {
        uid,
        type,
        conditions: children.map((node) =>
          node.children.map(roamNodeToCondition)
        ),
      };
};

const parseQuery: ParseQuery = (parentUidOrNode) => {
  const oldQueryNode =
    typeof parentUidOrNode === "string"
      ? getSubTree({ key: "query", tree: getBasicTreeByParentUid(parentUidOrNode) })
      : { text: "query", uid: "", children: [] };
  const queryNode =
    typeof parentUidOrNode === "string"
      ? getSubTree({ key: "scratch", parentUid: parentUidOrNode })
      : parentUidOrNode;
  const { uid, children } = queryNode;
  const getOrCreateUid = (sub: RoamBasicNode, text: string) => {
    if (sub.uid) return sub.uid;
    const newUid = window.roamAlphaAPI.util.generateUID();
    createBlock({
      node: { text, uid: newUid },
      parentUid: uid,
    });
    return newUid;
  };
  const returnBlock = getSubTree({ tree: children, key: "return" });
  const returnNodeUid = getOrCreateUid(returnBlock, "return");
  const returnNode = returnBlock.children?.[0]?.text;
  const conditionsNode = getSubTree({
    tree: children,
    key: "conditions",
  });
  const conditionsNodesUid = getOrCreateUid(conditionsNode, "conditions");
  const conditions = conditionsNode.children.map(roamNodeToCondition);

  const selectionsNode = getSubTree({ tree: children, key: "selections" });
  const selectionsNodesUid = getOrCreateUid(selectionsNode, "selections");

  const selections = selectionsNode.children.map(({ uid, text, children }) => ({
    uid,
    text,
    label: children?.[0]?.text || "",
  }));
  // if (oldQueryNode.uid) deleteBlock(oldQueryNode.uid); wait until I have confidence in the below migration first
  if (oldQueryNode.children.length) {
    // record event in a migration mitigation tool I need to build
    if (
      !selections.length &&
      !conditions.length &&
      typeof parentUidOrNode === "string"
    ) {
      const { returnNode, conditions, selections } =
        oldParseQuery(oldQueryNode);
      setInputSetting({
        blockUid: queryNode.uid,
        key: "return",
        value: returnNode,
      });
      conditions.forEach((condition, order) =>
        createBlock({
          parentUid: conditionsNodesUid,
          order,
          node: {
            text: condition.type,
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
        })
      );
      selections.map((sel, order) =>
        createBlock({
          parentUid: selectionsNodesUid,
          order,
          node: {
            text: sel.text,
            uid: sel.uid,
            children: [{ text: sel.label }],
          },
        }).then(() => sel)
      );
      return {
        returnNode,
        conditions,
        selections,
        returnNodeUid,
        conditionsNodesUid,
        selectionsNodesUid,
      };
    }
  }
  return {
    returnNode,
    conditions,
    selections,
    returnNodeUid,
    conditionsNodesUid,
    selectionsNodesUid,
  };
};

export default parseQuery;
