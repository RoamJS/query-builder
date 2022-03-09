import { conditionLabels } from "./conditionToDatalog";

const parseQuery = (q: string[]) => {
  const [findWhere = "", ...conditions] = q;
  const returnNode = findWhere.split(" ")[1];
  const conditionNodes = conditions
    .filter((s) => !s.startsWith("Select"))
    .map((c) => {
      const [source, rest] = c.split(/ (.+)/);
      const relation = conditionLabels.find((l) => rest.startsWith(l)) || "";
      const target = rest.substring(relation.length + 1);
      return {
        source,
        relation,
        target,
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
  return { returnNode, conditionNodes, selectionNodes };
};

export default parseQuery;
