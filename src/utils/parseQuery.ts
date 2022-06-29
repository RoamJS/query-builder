import { RoamBasicNode } from "roamjs-components/types/native";
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
  queryNode
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
  return {
    returnNode,
    conditions,
    selections,
    returnNodeUid,
    conditionsNodesUid,
    selectionsNodesUid,

    // @deprecated
    conditionNodes: conditions,
    selectionNodes: selections,
  };
};

export default parseQuery;
