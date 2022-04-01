import { getConditionLabels } from "./conditionToDatalog";

const parseQuery = (q: string[]) => {
  const [findWhere = "", ...conditions] = q;
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
  return { returnNode, conditionNodes, selectionNodes, };
};

export default parseQuery;
