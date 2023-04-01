// TODO POST MIGRATE - Merge into a single query
import { Result } from "roamjs-components/types/query-builder";
import findDiscourseNode from "./findDiscourseNode";
import fireQuery from "./fireQuery";
import getDiscourseNodes from "./getDiscourseNodes";
import getDiscourseRelations from "./getDiscourseRelations";

const resultCache: Record<string, Awaited<ReturnType<typeof fireQuery>>> = {};
const CACHE_TIMEOUT = 1000 * 60 * 5;

const getDiscourseContextResults = async ({
  uid,
  relations = getDiscourseRelations(),
  nodes = getDiscourseNodes(relations),
  ignoreCache,
  isSamePageEnabled = false,
}: {
  uid: string;
  nodes?: ReturnType<typeof getDiscourseNodes>;
  relations?: ReturnType<typeof getDiscourseRelations>;
  ignoreCache?: true;
  isSamePageEnabled?: boolean;
}) => {
  const discourseNode = findDiscourseNode(uid);
  if (!discourseNode) return [];
  const nodeType = discourseNode?.type;
  const nodeTextByType = Object.fromEntries(
    nodes.map(({ type, text }) => [type, text])
  );
  nodeTextByType["*"] = "Any";
  const rawResults = await Promise.all(
    relations
      .flatMap((r) => {
        const queries = [];
        if (r.source === nodeType || r.source === "*") {
          queries.push({
            r,
            complement: false,
          });
        }
        if (r.destination === nodeType || r.destination === "*") {
          queries.push({
            r,
            complement: true,
          });
        }
        return queries;
      })
      .map(({ r, complement }) => {
        const target = complement ? r.source : r.destination;
        const label = complement ? r.complement : r.label;
        const returnNode = nodeTextByType[target];
        const cacheKey = `${uid}~${label}~${target}`;
        const conditionUid = window.roamAlphaAPI.util.generateUID();
        const selections = [];
        if (r.triples.some((t) => t.some((a) => /context/i.test(a)))) {
          selections.push({
            uid: window.roamAlphaAPI.util.generateUID(),
            label: "context",
            text: `node:${conditionUid}-Context`,
          });
        } else if (r.triples.some((t) => t.some((a) => /anchor/i.test(a)))) {
          selections.push({
            uid: window.roamAlphaAPI.util.generateUID(),
            label: "anchor",
            text: `node:${conditionUid}-Anchor`,
          });
        }
        const resultsPromise =
          resultCache[cacheKey] && !ignoreCache
            ? Promise.resolve(resultCache[cacheKey])
            : fireQuery({
                returnNode,
                conditions: [
                  {
                    source: returnNode,
                    // NOTE! This MUST be the OPPOSITE of `label`
                    relation: complement ? r.label : r.complement,
                    target: uid,
                    uid: conditionUid,
                    type: "clause",
                  },
                ],
                selections,
                isSamePageEnabled,
              }).then((results) => {
                resultCache[cacheKey] = results;
                setTimeout(() => {
                  delete resultCache[cacheKey];
                }, CACHE_TIMEOUT);
                return results;
              });
        return resultsPromise.then((results) => ({
          label,
          complement,
          target,
          id: r.id,
          results,
        }));
      })
  ).catch((e) => {
    console.error(e);
    return [] as const;
  });
  const groupedResults = Object.fromEntries(
    rawResults.map((r) => [
      r.label,
      {} as Record<
        string,
        Partial<Result & { target: string; complement: number; id: string }>
      >,
    ])
  );
  rawResults.forEach((r) =>
    r.results
      .filter((a) => a.uid !== uid)
      .forEach(
        (res) =>
         // TODO POST MIGRATE - set result to its own field
          (groupedResults[r.label][res.uid] = {
            ...res,
            target: nodeTextByType[r.target],
            complement: r.complement ? 1 : 0,
            id: r.id,
          })
      )
  );
  return Object.entries(groupedResults).map(([label, results]) => ({
    label,
    results,
  }));
};

export default getDiscourseContextResults;
