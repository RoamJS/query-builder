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

type BuildQueryConfig = {
  args: {
    ignoreCache?: true;
    isSamePageEnabledExternal?: boolean;
    onloadArgs?: OnloadArgs;
  };
  targetUid: string;
  fireQueryContext: {
    nodes: ReturnType<typeof getDiscourseNodes>;
    relations: ReturnType<typeof getDiscourseRelations>;
  };
  nodeTextByType: Record<string, string>;
  r: DiscourseRelation;
  complement: boolean;
  query?: string;
};
type QueryConfig = {
  relation: {
    id: string;
    text: string;
    target: string;
    isComplement: boolean;
  };
  queryPromise: () => Promise<Result[]>;
};

type SelectionConfig = {
  r: DiscourseRelation;
  conditionUid?: string;
};
const buildSelections = ({
  r,
  conditionUid = window.roamAlphaAPI.util.generateUID(),
}: SelectionConfig): Selection[] => {
  const selections: Selection[] = [];

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

  return selections;
};

const executeQueries = async (queryConfigs: QueryConfig[]) => {
  console.time("queries");
  const results = await Promise.all(
    queryConfigs.map(async ({ relation, queryPromise }) => ({
      relation,
      results: await queryPromise(),
    }))
  );
  console.timeEnd("queries");
  return results;
};

const buildQueryConfig = ({
  args,
  targetUid,
  fireQueryContext,
  nodeTextByType,
  r,
  complement: isComplement,
  query,
}: BuildQueryConfig): QueryConfig => {
  const { ignoreCache, isSamePageEnabledExternal, onloadArgs } = args;
  const useSamePageFlag = !!onloadArgs?.extensionAPI.settings.get(
    "use-backend-samepage-discourse-context"
  );
  const isSamePageEnabled =
    isSamePageEnabledExternal ?? useSamePageFlag ?? false;
  const target = isComplement ? r.source : r.destination;
  const text = isComplement ? r.complement : r.label;
  const cacheKey = `${targetUid}~${text}~${target}`;

  const relation = {
    id: r.id,
    text,
    target,
    isComplement,
  };

  if (resultCache[cacheKey] && !ignoreCache) {
    return {
      relation,
      queryPromise: () => Promise.resolve(resultCache[cacheKey]),
    };
  }

  // prebuilt datalogQuery
  //
  // if (query) {
  //
  // const selections = buildSelections({ r });
  // const definedSelections = [
  //   {
  //     key: "",
  //     label: "text",
  //     pull: `(pull ?${returnNode} [:block/string :node/title :block/uid])`,
  //     mapper: (r: any) => {
  //       return {
  //         "": r?.[":node/title"] || r?.[":block/string"] || "",
  //         "-uid": r[":block/uid"] || "",
  //       };
  //     },
  //   },
  //   {
  //     key: "",
  //     label: "uid",
  //     pull: `(pull ?${returnNode} [:block/uid])`,
  //     mapper: (r: any) => {
  //       return r?.[":block/uid"] || "";
  //     },
  //   },
  // ];
  //
  //   return {
  //     relation,
  //     queryPromise: () =>
  //       fireQuery({
  //         customNode: query.replaceAll("{{placeholder}}", uid),
  //         isCustomEnabled: true,
  //         conditions: [],
  //         selections,
  //         definedSelections: [], //TODO
  //         isSamePageEnabled,
  //       }),
  //   };

  const returnNode = nodeTextByType[target];

  const conditionUid = window.roamAlphaAPI.util.generateUID();
  const selections = buildSelections({ r, conditionUid });
  const { nodes, relations } = fireQueryContext;
  return {
    relation,
    queryPromise: () =>
      fireQuery({
        returnNode,
        conditions: [
          {
            source: returnNode,
            // NOTE! This MUST be the OPPOSITE of `label`
            relation: isComplement ? r.label : r.complement,
            target: targetUid,
            uid: conditionUid,
            type: "clause",
          },
        ],
        selections,
        isSamePageEnabled,
        context: {
          relationsInQuery: [relation],
          customNodes: nodes,
          customRelations: relations,
          r: fireQueryContext.r,
          isComplement,
        },
      }),
  };
};

const getDiscourseContextResults = async ({
  uid,
  relations = getDiscourseRelations(),
  nodes = getDiscourseNodes(relations),
  ignoreCache,
  isSamePageEnabled: isSamePageEnabledExternal,
  args: onloadArgs,
}: {
  uid: string;
  nodes?: ReturnType<typeof getDiscourseNodes>;
  relations?: ReturnType<typeof getDiscourseRelations>;
  ignoreCache?: true;
  isSamePageEnabled?: boolean;
  args?: OnloadArgs;
}) => {
  const args = { ignoreCache, isSamePageEnabledExternal, onloadArgs };

  const discourseNode = findDiscourseNode(uid);
  if (!discourseNode) return [];
  const nodeType = discourseNode?.type;
  const nodeTextByType = Object.fromEntries(
    nodes.map(({ type, text }) => [type, text])
  );
  nodeTextByType["*"] = "Any";

  console.log("relations", relations);

  type RelationWithComplement = {
    id: string;
    r: DiscourseRelation;
    complement: boolean;
  };
  const uniqueRelations = new Map<string, RelationWithComplement>();

  relations.forEach((r) => {
    if (r.source === nodeType || r.source === "*") {
      uniqueRelations.set(`${r.id}-false`, {
        id: r.id,
        r,
        complement: false,
      });
    }
    if (r.destination === nodeType || r.destination === "*") {
      uniqueRelations.set(`${r.id}-true`, {
        id: r.id,
        r,
        complement: true,
      });
    }
  });

  const relationsWithComplement = Array.from(uniqueRelations.values());

  console.log("relationsWithComplement", relationsWithComplement);

  const context = { nodes, relations };
  const queryConfigs = relationsWithComplement.map((relation) =>
    buildQueryConfig({
      args,
      targetUid: uid,
      nodeTextByType,
      fireQueryContext: {
        r: relation.r,
        isComplement: relation.complement,
        ...context,
      },
      r: relation.r,
      complement: relation.complement,
      // query: relation.query,
    })
  );
  // console.log("queryConfigs", queryConfigs);

  const resultsWithRelation = await executeQueries(queryConfigs);
  console.log("resultsWithRelation", resultsWithRelation);
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
