// TODO POST MIGRATE - Merge into a single query
import { Result } from "roamjs-components/types/query-builder";
import findDiscourseNode from "./findDiscourseNode";
import fireQuery, { FireQueryArgs } from "./fireQuery";
import getDiscourseNodes, { DiscourseNode } from "./getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "./getDiscourseRelations";
import { OnloadArgs } from "roamjs-components/types";
import { Selection } from "./types";

const resultCache: Record<string, Awaited<ReturnType<typeof fireQuery>>> = {};
const CACHE_TIMEOUT = 1000 * 60 * 5;

const getDiscourseContextResults = async ({
  uid,
  relations = getDiscourseRelations(),
  nodes = getDiscourseNodes(relations),
  ignoreCache,
  isSamePageEnabled: isSamePageEnabledExternal,
  args,
}: {
  uid: string;
  nodes?: ReturnType<typeof getDiscourseNodes>;
  relations?: ReturnType<typeof getDiscourseRelations>;
  ignoreCache?: true;
  isSamePageEnabled?: boolean;
  args?: OnloadArgs;
}) => {
  const useSamePageFlag = !!args?.extensionAPI.settings.get(
    "use-backend-samepage-discourse-context"
  );
  const isSamePageEnabled =
    isSamePageEnabledExternal ?? useSamePageFlag ?? false;
  const discourseNode = findDiscourseNode(uid);
  if (!discourseNode) return [];
  const nodeType = discourseNode?.type;
  const nodeTextByType = Object.fromEntries(
    nodes.map(({ type, text }) => [type, text])
  );
  nodeTextByType["*"] = "Any";
  const resultsWithRelation = await Promise.all(
    relations
      .flatMap((r) => {
        const queries = [];
        if (r.source === nodeType || r.source === "*") {
          queries.push({
            r,
            complement: false,
            query: r.query,
          });
        }
        if (r.destination === nodeType || r.destination === "*") {
          queries.push({
            r,
            complement: true,
            query: r.complementQuery,
          });
        }
        return queries;
      })
      .map(({ r, complement: isComplement, query }) => {
        const target = isComplement ? r.source : r.destination;
        const text = isComplement ? r.complement : r.label;
        const returnNode = nodeTextByType[target];
        const cacheKey = `${uid}~${text}~${target}`;
        const conditionUid = window.roamAlphaAPI.util.generateUID();
        const selections: Selection[] = [];

        // TODO - not currently supported
        // we are bypassing definedSelections creation

        // if (r.triples.some((t) => t.some((a) => /context/i.test(a)))) {
        //   selections.push({
        //     uid: window.roamAlphaAPI.util.generateUID(),
        //     label: "context",
        //     text: `node:${conditionUid}-Context`,
        //   });
        // } else if (r.triples.some((t) => t.some((a) => /anchor/i.test(a)))) {
        //   selections.push({
        //     uid: window.roamAlphaAPI.util.generateUID(),
        //     label: "anchor",
        //     text: `node:${conditionUid}-Anchor`,
        //   });
        // }

        const definedSelections = [
          {
            key: "",
            label: "text",
            pull: `(pull ?${returnNode} [:block/string :node/title :block/uid])`,
            mapper: (r: any) => {
              return {
                "": r?.[":node/title"] || r?.[":block/string"] || "",
                "-uid": r[":block/uid"] || "",
              };
            },
          },
          {
            key: "",
            label: "uid",
            pull: `(pull ?${returnNode} [:block/uid])`,
            mapper: (r: any) => {
              return r?.[":block/uid"] || "";
            },
          },
        ];
        const relation = {
          id: r.id,
          text,
          target,
          isComplement,
        };

        if (resultCache[cacheKey] && !ignoreCache) {
          return {
            relation,
            queryPromise: Promise.resolve(resultCache[cacheKey]),
          };
        }

        if (query) {
          return {
            relation: {
              text,
              isComplement,
              target,
              id: r.id,
            },
            queryPromise: fireQuery({
              customNode: query.replaceAll("{{placeholder}}", uid),
              isCustomEnabled: true,
              conditions: [],
              selections,
              definedSelections,
              isSamePageEnabled,
            }),
          };
        } else {
          return {
            relation: {
              text,
              isComplement,
              target,
              id: r.id,
            },
            queryPromise: fireQuery({
              returnNode,
              conditions: [
                {
                  source: returnNode,
                  // NOTE! This MUST be the OPPOSITE of `label`
                  relation: isComplement ? r.label : r.complement,
                  target: uid,
                  uid: conditionUid,
                  type: "clause",
                },
              ],
              selections,
              isSamePageEnabled,
              definedSelections,
              context: {
                relationsInQuery: [relation],
                customNodes: nodes,
                customRelations: relations,
              },
            }),
          };
        }
      })
  )
    .then((items) => {
      return Promise.all(
        items.map(async ({ relation, queryPromise }) => ({
          relation,
          results: await queryPromise,
        }))
      );
    })
    .catch((e) => {
      console.error(e);
      return [] as const;
    });
  const groupedResults = Object.fromEntries(
    resultsWithRelation.map((r) => [
      r.relation.text,
      {} as Record<
        string,
        Partial<Result & { target: string; complement: number; id: string }>
      >,
    ])
  );
  resultsWithRelation.forEach((r) =>
    r.results
      .filter((a) => a.uid !== uid)
      .forEach(
        (res) =>
          // TODO POST MIGRATE - set result to its own field
          (groupedResults[r.relation.text][res.uid] = {
            ...res,
            target: nodeTextByType[r.relation.target],
            complement: r.relation.isComplement ? 1 : 0,
            id: r.relation.id,
          })
      )
  );
  return Object.entries(groupedResults).map(([label, results]) => ({
    label,
    results,
  }));
};

export default getDiscourseContextResults;
