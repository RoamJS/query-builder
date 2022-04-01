<<<<<<< HEAD
import type { InputTextNode } from "roamjs-components/types/native";
import { getConditionLabels } from "./conditionToDatalog";

const parseQuery: typeof window.roamjs.extension.queryBuilder.parseQuery = (
  q: string[] | InputTextNode
) => {
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
        type: "clause" as const,
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
=======
import { RoamBasicNode } from "roamjs-components/types";
import { Condition } from "roamjs-components/types/query-builder";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import createBlock from "roamjs-components/writes/createBlock";

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
      }
    : {
        uid,
        type,
        conditions: children.map((node) =>
          node.children.map(roamNodeToCondition)
        ),
      };
};

const parseQuery: typeof window.roamjs.extension.queryBuilder.parseQuery = (
  queryNode: RoamBasicNode
) => {
  const { uid, children } = queryNode;
  const getOrCreateUid = (sub: RoamBasicNode, text: string) => {
    if (sub?.uid) return sub?.uid;
    const newUid = window.roamAlphaAPI.util.generateUID();
    createBlock({
      node: { text, uid: newUid },
      parentUid: uid,
    });
    return newUid;
  };
  const returnBlock = getSubTree({ tree: children, key: "return" });
  const returnNodeUid = getOrCreateUid(returnBlock, 'return');
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
  return {
    returnNode,
    conditions,
    selections,
    returnNodeUid,
    conditionsNodesUid,
    selectionsNodesUid,
>>>>>>> 08e627e (Implementing OR logic for query builder)
  };
};

export default parseQuery;
