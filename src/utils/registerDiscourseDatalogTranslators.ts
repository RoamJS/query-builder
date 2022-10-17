import getPageTitlesStartingWithPrefix from "roamjs-components/queries/getPageTitlesStartingWithPrefix";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import { DatalogAndClause, DatalogClause } from "roamjs-components/types";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getSubTree from "roamjs-components/util/getSubTree";
import discourseNodeFormatToDatalog from "./discourseNodeFormatToDatalog";
import conditionToDatalog, {
  registerDatalogTranslator,
} from "./conditionToDatalog";
import { ANY_RELATION_REGEX } from "./deriveDiscourseNodeAttribute";
import getDiscourseNodes from "./getDiscourseNodes";
import getDiscourseRelations from "./getDiscourseRelations";
import matchDiscourseNode from "./matchDiscourseNode";
import replaceDatalogVariables from "./replaceDatalogVariables";

const collectVariables = (
  clauses: (DatalogClause | DatalogAndClause)[]
): Set<string> =>
  new Set(
    clauses.flatMap((c) => {
      switch (c.type) {
        case "data-pattern":
        case "fn-expr":
        case "pred-expr":
        case "rule-expr":
          return [...c.arguments]
            .filter((a) => a.type === "variable")
            .map((a) => a.value);
        case "not-join-clause":
        case "or-join-clause":
        case "not-clause":
        case "or-clause":
        case "and-clause":
          return Array.from(collectVariables(c.clauses));
        default:
          return [];
      }
    })
  );

const registerDiscourseDatalogTranslators = () => {
  const isACallback: Parameters<
    typeof registerDatalogTranslator
  >[0]["callback"] = ({ source, target }) => {
    const nodeByTypeOrText = Object.fromEntries([
      ...discourseNodes.map((n) => [n.type, n] as const),
      ...discourseNodes.map((n) => [n.text, n] as const),
    ]);
    return target === "*"
      ? [
          {
            type: "or-join-clause" as const,
            variables: [{ type: "variable" as const, value: `any` }],
            clauses: discourseNodes.map((dn) => ({
              type: "and-clause" as const,
              clauses: discourseNodeFormatToDatalog({
                freeVar: "any",
                ...dn,
              }),
            })),
          },
        ]
      : nodeByTypeOrText[target]
      ? discourseNodeFormatToDatalog({
          freeVar: source,
          ...nodeByTypeOrText[target],
        })
      : [];
  };
  const discourseRelations = getDiscourseRelations();
  const discourseNodes = getDiscourseNodes(discourseRelations);
  const unregisters = new Set<() => void>();
  unregisters.add(
    registerDatalogTranslator({
      key: "is a",
      callback: isACallback,
      targetOptions: discourseNodes.map((d) => d.text),
      isVariable: true,
      placeholder: "Enter a discourse node",
    })
  );
  unregisters.add(
    registerDatalogTranslator({
      key: "self",
      callback: ({ source, uid }) =>
        isACallback({ source, target: source, uid }),
    })
  );
  unregisters.add(
    registerDatalogTranslator({
      key: "is involved with query",
      targetOptions: () =>
        getPageTitlesStartingWithPrefix("discourse-graph/queries/").map((q) =>
          q.substring("discourse-graph/queries/".length)
        ),
      callback: ({ source, target }) => {
        const queryUid = getPageUidByPageTitle(
          `discourse-graph/queries/${target}`
        );
        const queryMetadataTree = getBasicTreeByParentUid(queryUid);
        const queryData = getSubTree({
          tree: queryMetadataTree,
          key: "query",
        });
        const { conditions, returnNode } =
          window.roamjs.extension.queryBuilder.parseQuery(queryData);
        // @ts-ignore
        const { getWhereClauses } = window.roamjs.extension.queryBuilder;
        const clauses = (
          getWhereClauses as (
            args: Omit<
              Parameters<
                typeof window.roamjs.extension.queryBuilder.fireQuery
              >[0],
              "selections" | "isBackendEnabled"
            >
          ) => DatalogClause[]
        )({ conditions, returnNode });
        const variables = Array.from(collectVariables(clauses));
        const orClause: DatalogClause = {
          type: "or-join-clause",
          variables: [{ type: "variable" as const, value: source }].concat(
            variables.map((value) => ({ value, type: "variable" }))
          ),
          clauses: variables.map((v) => ({
            type: "and-clause",
            clauses: [
              {
                type: "data-pattern",
                arguments: [
                  { type: "variable", value: v },
                  { type: "constant", value: ":block/uid" },
                  { type: "variable", value: `${v}-Uid` },
                ],
              },
              {
                type: "data-pattern",
                arguments: [
                  { type: "variable", value: source },
                  { type: "constant", value: ":block/uid" },
                  { type: "variable", value: `${v}-Uid` },
                ],
              },
            ],
          })),
        };
        return clauses.concat(orClause);
      },
      placeholder: "Enter query label",
    })
  );

  const nodeLabelByType = Object.fromEntries(
    discourseNodes.map((n) => [n.type, n.text])
  );
  const nodeByType = Object.fromEntries(discourseNodes.map((n) => [n.type, n]));
  const nodeTypeByLabel = Object.fromEntries(
    discourseNodes.map((n) => [n.text.toLowerCase(), n.type])
  );
  const doesDiscourseRelationMatchCondition = (
    relation: { source: string; destination: string },
    condition: { source: string; target: string }
  ) => {
    const sourceType = nodeLabelByType[relation.source];
    const targetType = nodeLabelByType[relation.destination];
    const sourceMatches =
      sourceType === condition.source || relation.source === "*";
    const targetNode = nodeByType[relation.destination];
    const targetMatches =
      targetType === condition.target ||
      relation.destination === "*" ||
      matchDiscourseNode({
        ...targetNode,
        title: condition.target,
      }) ||
      matchDiscourseNode({
        ...targetNode,
        uid: condition.target,
      });
    if (sourceMatches) {
      return (
        targetMatches ||
        (!nodeTypeByLabel[condition.target.toLowerCase()] &&
          !Object.values(nodeByType).some(
            (node) =>
              matchDiscourseNode({
                ...node,
                title: condition.target,
              }) ||
              matchDiscourseNode({
                ...node,
                uid: condition.target,
              })
          ))
      );
    }
    if (targetMatches) {
      return sourceMatches || !nodeTypeByLabel[condition.source.toLowerCase()];
    }
    // if both are placeholders, sourceType and targetType will both be null, meaning we could match any condition
    return false; // !nodeLabelByType[condition.source] && !nodeLabelByType[condition.target]
  };
  const relationLabels = new Set(
    discourseRelations.flatMap((d) => [d.label, d.complement])
  );
  relationLabels.add(ANY_RELATION_REGEX.source);
  relationLabels.forEach((label) => {
    unregisters.add(
      registerDatalogTranslator({
        key: label,
        callback: ({ source, target, uid }) => {
          const filteredRelations = discourseRelations
            .map((r) =>
              (r.label === label || ANY_RELATION_REGEX.test(label)) &&
              doesDiscourseRelationMatchCondition(r, { source, target })
                ? { ...r, forward: true }
                : doesDiscourseRelationMatchCondition(
                    { source: r.destination, destination: r.source },
                    { source, target }
                  ) &&
                  (r.complement === label || ANY_RELATION_REGEX.test(label))
                ? { ...r, forward: false }
                : undefined
            )
            .filter((r) => !!r);
          if (!filteredRelations.length) return [];
          const andParts = filteredRelations.map(({ triples, forward }) => {
            const sourceTriple = triples.find((t) => t[2] === "source");
            const targetTriple = triples.find(
              (t) => t[2] === "destination" || t[2] === "target"
            );
            if (!sourceTriple || !targetTriple) return [];
            const computeEdgeTriple = (
              value: string,
              triple: readonly [string, string, string]
            ): DatalogClause[] => {
              const possibleNodeType = nodeTypeByLabel[value.toLowerCase()];
              if (possibleNodeType) {
                return conditionToDatalog({
                  uid,
                  not: false,
                  target: possibleNodeType,
                  relation: "is a",
                  source: triple[0],
                  type: "clause",
                });
              } else if (
                !!window.roamAlphaAPI.pull("[:db/id]", [":block/uid", value])
              ) {
                return [
                  {
                    type: "data-pattern",
                    arguments: [
                      { type: "variable", value: triple[0] },
                      { type: "constant", value: ":block/uid" },
                      { type: "constant", value: `"${value}"` },
                    ],
                  },
                ];
              } else {
                return conditionToDatalog({
                  uid,
                  not: false,
                  target: value,
                  relation: "has title",
                  source: triple[0],
                  type: "clause",
                });
              }
            };
            const edgeTriples = forward
              ? computeEdgeTriple(source, sourceTriple)
                  .concat(computeEdgeTriple(target, targetTriple))
                  .concat([
                    {
                      type: "data-pattern",
                      arguments: [
                        { type: "variable", value: sourceTriple[0] },
                        { type: "constant", value: ":block/uid" },
                        { type: "variable", value: `${source}-uid` },
                      ],
                    },
                    {
                      type: "data-pattern",
                      arguments: [
                        { type: "variable", value: source },
                        { type: "constant", value: ":block/uid" },
                        { type: "variable", value: `${source}-uid` },
                      ],
                    },
                    {
                      type: "data-pattern",
                      arguments: [
                        { type: "variable", value: targetTriple[0] },
                        { type: "constant", value: ":block/uid" },
                        { type: "variable", value: `${target}-uid` },
                      ],
                    },
                    {
                      type: "data-pattern",
                      arguments: [
                        { type: "variable", value: target },
                        { type: "constant", value: ":block/uid" },
                        { type: "variable", value: `${target}-uid` },
                      ],
                    },
                  ])
              : computeEdgeTriple(target, sourceTriple)
                  .concat(computeEdgeTriple(source, targetTriple))
                  .concat([
                    {
                      type: "data-pattern",
                      arguments: [
                        { type: "variable", value: targetTriple[0] },
                        { type: "constant", value: ":block/uid" },
                        { type: "variable", value: `${source}-uid` },
                      ],
                    },
                    {
                      type: "data-pattern",
                      arguments: [
                        { type: "variable", value: source },
                        { type: "constant", value: ":block/uid" },
                        { type: "variable", value: `${source}-uid` },
                      ],
                    },
                    {
                      type: "data-pattern",
                      arguments: [
                        { type: "variable", value: sourceTriple[0] },
                        { type: "constant", value: ":block/uid" },
                        { type: "variable", value: `${target}-uid` },
                      ],
                    },
                    {
                      type: "data-pattern",
                      arguments: [
                        { type: "variable", value: target },
                        { type: "constant", value: ":block/uid" },
                        { type: "variable", value: `${target}-uid` },
                      ],
                    },
                  ]);
            const subQuery = triples
              .filter((t) => t !== sourceTriple && t !== targetTriple)
              .flatMap(([src, rel, tar]) =>
                conditionToDatalog({
                  source: src,
                  relation: rel,
                  target: tar,
                  not: false,
                  uid,
                  type: "clause",
                })
              );
            return replaceDatalogVariables(
              [
                { from: source, to: source },
                { from: target, to: target },
                { from: true, to: (v) => `${uid}-${v}` },
              ],
              edgeTriples.concat(subQuery)
            );
          });
          if (andParts.length === 1) return andParts[0];

          const orJoinedVars = collectVariables(andParts[0]);
          andParts.slice(1).forEach((a) => {
            const freeVars = collectVariables(a);
            Array.from(orJoinedVars).forEach((v) => {
              if (!freeVars.has(v)) orJoinedVars.delete(v);
            });
          });
          return [
            {
              type: "or-join-clause",
              variables: Array.from(orJoinedVars).map((v) => ({
                type: "variable",
                value: v,
              })),
              clauses: andParts.map((a) => ({
                type: "and-clause",
                clauses: a,
              })),
            },
          ];
        },
        targetOptions: (source) => {
          const pageNames = getAllPageNames();
          const sourcedRelations = discourseRelations
            .flatMap((dr) => [
              { source: dr.source, relation: dr.label, target: dr.destination },
              {
                source: dr.destination,
                relation: dr.complement,
                target: dr.source,
              },
            ])
            .filter(
              (dr) =>
                dr.relation === label &&
                (!source ||
                  dr.source === source ||
                  nodeLabelByType[dr.source] === source)
            );
          return pageNames.filter((p) =>
            sourcedRelations.some((sr) =>
              matchDiscourseNode({
                ...nodeByType[sr.target],
                title: p,
              })
            )
          );
        },
        placeholder: "Enter a valid target",
      })
    );
  });
  return Array.from(unregisters);
};

export default registerDiscourseDatalogTranslators;
