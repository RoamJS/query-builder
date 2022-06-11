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
  };
};

export default parseQuery;
