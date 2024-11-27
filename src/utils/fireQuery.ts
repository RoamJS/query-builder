import conditionToDatalog from "../utils/conditionToDatalog";
import type {
  PullBlock,
  DatalogAndClause,
  DatalogClause,
} from "roamjs-components/types";
import compileDatalog from "./compileDatalog";
import { getNodeEnv } from "roamjs-components/util/env";
import type { Condition, Result as QueryResult, Selection } from "./types";
import getSamePageAPI from "@samepage/external/getSamePageAPI";
import gatherDatalogVariablesFromClause from "./gatherDatalogVariablesFromClause";
import predefinedSelections, {
  PredefinedSelection,
} from "./predefinedSelections";
import { DEFAULT_RETURN_NODE } from "./parseQuery";
import { DiscourseNode } from "./getDiscourseNodes";
import { DiscourseRelation } from "./getDiscourseRelations";
import { logTimestamp } from "../components/QueryTester";
import nanoid from "nanoid";

export type QueryArgs = {
  returnNode?: string;
  conditions: Condition[];
  selections: Selection[];
  inputs?: Record<string, string | number>;
};
type RelationInQuery = {
  id: string;
  text: string;
  isComplement: boolean;
};
type QuerySelection = {
  mapper: PredefinedSelection["mapper"];
  pull: string;
  label: string;
  key: string;
};
export type FireQueryArgs = QueryArgs & {
  isSamePageEnabled?: boolean;
  isCustomEnabled?: boolean;
  customNode?: string;
  context?: {
    relationsInQuery?: RelationInQuery[];
    customNodes?: DiscourseNode[];
    customRelations?: DiscourseRelation[];
  };
  definedSelections?: QuerySelection[];
};

type FireQuery = (query: FireQueryArgs) => Promise<QueryResult[]>;

const firstVariable = (
  clause: DatalogClause | DatalogAndClause
): string | undefined => {
  if (
    clause.type === "data-pattern" ||
    clause.type === "fn-expr" ||
    clause.type === "pred-expr" ||
    clause.type === "rule-expr"
  ) {
    return [...clause.arguments].find((v) => v.type === "variable")?.value;
  } else if (
    clause.type === "not-clause" ||
    clause.type === "or-clause" ||
    clause.type === "and-clause"
  ) {
    return firstVariable(clause.clauses[0]);
  } else if (
    clause.type === "not-join-clause" ||
    clause.type === "or-join-clause"
  ) {
    return clause.variables[0]?.value;
  }
  return undefined;
};

const optimizeQuery = (
  clauses: (DatalogClause | DatalogAndClause)[],
  capturedVariables: Set<string>
): (DatalogClause | DatalogAndClause)[] => {
  const marked = clauses.map(() => false);
  const orderedClauses: (DatalogClause | DatalogAndClause)[] = [];
  const variablesByIndex: Record<number, Set<string>> = {};
  for (let i = 0; i < clauses.length; i++) {
    let bestClauseIndex = clauses.length;
    let bestClauseScore = Number.MAX_VALUE;
    clauses.forEach((c, j) => {
      if (marked[j]) return;
      let score = bestClauseScore;
      if (c.type === "data-pattern") {
        if (
          c.arguments[0]?.type === "variable" &&
          c.arguments[1]?.type === "constant"
        ) {
          if (c.arguments[2]?.type === "constant") {
            score = 1;
          } else if (
            c.arguments[2]?.type === "variable" &&
            (capturedVariables.has(c.arguments[0].value) ||
              capturedVariables.has(c.arguments[2].value))
          ) {
            score = 2;
          } else {
            score = 100000;
          }
        } else {
          score = 100001;
        }
      } else if (
        c.type === "not-clause" ||
        c.type === "or-clause" ||
        c.type === "and-clause"
      ) {
        const allVars =
          variablesByIndex[j] ||
          (variablesByIndex[j] = gatherDatalogVariablesFromClause(c));
        if (Array.from(allVars).every((v) => capturedVariables.has(v))) {
          score = 10;
        } else {
          score = 100002;
        }
      } else if (c.type === "not-join-clause" || c.type === "or-join-clause") {
        if (c.variables.every((v) => capturedVariables.has(v.value))) {
          score = 100;
        } else {
          score = 100003;
        }
      } else if (
        c.type === "fn-expr" ||
        c.type === "pred-expr" ||
        c.type === "rule-expr"
      ) {
        if (
          [...c.arguments].every(
            (a) => a.type !== "variable" || capturedVariables.has(a.value)
          )
        ) {
          score = 1000;
        } else {
          score = 100004;
        }
      } else {
        score = 100005;
      }
      if (score < bestClauseScore) {
        bestClauseScore = score;
        bestClauseIndex = j;
      }
    });
    marked[bestClauseIndex] = true;
    const bestClause = clauses[bestClauseIndex];
    orderedClauses.push(clauses[bestClauseIndex]);
    if (
      bestClause.type === "not-join-clause" ||
      bestClause.type === "or-join-clause" ||
      bestClause.type === "not-clause" ||
      bestClause.type === "or-clause" ||
      bestClause.type === "and-clause"
    ) {
      bestClause.clauses = optimizeQuery(
        bestClause.clauses,
        new Set(capturedVariables)
      );
    } else if (bestClause.type === "data-pattern") {
      bestClause.arguments
        .filter((v) => v.type === "variable")
        .forEach((v) => capturedVariables.add(v.value));
    }
  }
  return orderedClauses;
};

export const getWhereClauses = ({
  conditions,
  returnNode = DEFAULT_RETURN_NODE,
}: Omit<QueryArgs, "selections">) => {
  return conditions.length
    ? conditions.flatMap(conditionToDatalog)
    : conditionToDatalog({
        relation: "self",
        source: returnNode,
        target: returnNode,
        uid: "",
        not: false,
        type: "clause",
      });
};

const getConditionTargets = (conditions: Condition[]): string[] =>
  conditions.flatMap((c) =>
    c.type === "clause" || c.type === "not"
      ? [c.target]
      : getConditionTargets(c.conditions.flat())
  );

type FormatResultFn = (result: unknown[]) => Promise<QueryResult>;
type FormattedOutput = {
  output: string | number | Record<string, unknown> | Date;
  label: string;
};

const createFormatResultFn = (
  definedSelections: QuerySelection[]
): FormatResultFn => {
  const formatSingleResult = async (
    pullResult: unknown,
    selection: QuerySelection,
    prev: QueryResult
  ): Promise<FormattedOutput> => {
    if (typeof pullResult === "object" && pullResult !== null) {
      const output = await selection.mapper(
        pullResult as PullBlock,
        selection.key,
        prev
      );
      return { output, label: selection.label };
    }

    if (typeof pullResult === "string" || typeof pullResult === "number") {
      return { output: pullResult, label: selection.label };
    }

    return { output: "", label: selection.label };
  };

  const applyOutputToResult = (
    result: QueryResult,
    { output, label }: FormattedOutput
  ): void => {
    if (typeof output === "object" && !(output instanceof Date)) {
      Object.entries(output as Record<string, unknown>).forEach(([k, v]) => {
        result[label + k] = String(v);
      });
    } else if (typeof output === "number") {
      result[label] = output.toString();
    } else {
      result[label] = String(output);
    }
  };

  return async (results: unknown[]): Promise<QueryResult> => {
    const formatters = definedSelections.map(
      (selection, i) => (prev: QueryResult) =>
        formatSingleResult(results[i], selection, prev)
    );

    return formatters.reduce(
      (prev, formatter) =>
        prev.then(async (p) => {
          const output = await formatter(p);
          applyOutputToResult(p, output);
          return p;
        }),
      Promise.resolve({} as QueryResult)
    );
  };
};

export const getDatalogQuery = ({
  conditions,
  selections,
  returnNode = DEFAULT_RETURN_NODE,
  inputs = {},
}: FireQueryArgs) => {
  const expectedInputs = getConditionTargets(conditions)
    .filter((c) => /^:in /.test(c))
    .map((c) => c.substring(4))
    .filter((c) => !!inputs[c]);
  const whereClauses = optimizeQuery(
    getWhereClauses({ conditions, returnNode }),
    new Set([])
  ) as DatalogClause[];

  const defaultSelections: {
    mapper: PredefinedSelection["mapper"];
    pull: string;
    label: string;
    key: string;
  }[] = [
    {
      mapper: (r) => {
        return {
          "": r?.[":node/title"] || r?.[":block/string"] || "",
          "-uid": r[":block/uid"] || "",
        };
      },
      pull: `(pull ?${returnNode} [:block/string :node/title :block/uid])`,
      label: selections.find((s) => s.text === "node")?.label || "text",
      key: "",
    },
    {
      mapper: (r) => {
        return r?.[":block/uid"] || "";
      },
      pull: `(pull ?${returnNode} [:block/uid])`,
      label: "uid",
      key: "",
    },
  ];
  const definedSelections = defaultSelections.concat(
    selections
      .map((s) => ({
        defined: predefinedSelections.find((p) => p.test.test(s.text)),
        s,
      }))
      .filter(
        (p): p is { defined: PredefinedSelection; s: Selection } => !!p.defined
      )
      .map((p) => ({
        mapper: p.defined.mapper,
        pull: p.defined.pull({
          where: whereClauses,
          returnNode,
          match: p.defined.test.exec(p.s.text),
        }),
        label: p.s.label || p.s.text,
        key: p.s.text,
      }))
      .filter((p) => !!p.pull)
  );
  const find = definedSelections.map((p) => p.pull).join("\n  ");
  const where = whereClauses.map((c) => compileDatalog(c, 1)).join("\n");
  return {
    query: `[:find\n  ${find}\n${
      expectedInputs.length
        ? `  :in $ ${expectedInputs.map((i) => `?${i}`).join(" ")}\n`
        : ""
    }:where\n${
      whereClauses.length === 1 && whereClauses[0].type === "not-clause"
        ? `[?node :block/uid _]`
        : ""
    }${where}\n]`,
    formatResult: createFormatResultFn(definedSelections),
    inputs: expectedInputs.map((i) => inputs[i]),
  };
};

export const fireQuerySync = (args: FireQueryArgs): QueryResult[] => {
  const { query } = getDatalogQuery(args);
  return (window.roamAlphaAPI.data.fast.q(query) as [PullBlock][]).map((r) => ({
    text: r[0][":node/title"] || r[0][":block/string"] || "",
    uid: r[0][":block/uid"] || "",
  }));
};

const fireQuery: FireQuery = async (_args) => {
  const {
    isCustomEnabled,
    customNode,
    isSamePageEnabled,
    definedSelections,
    ...args
  } = _args;

  if (isSamePageEnabled) {
    return getSamePageAPI()
      .then((api) => api.postToAppBackend({ path: "query", data: { ...args } }))
      .then((r) => r.results as QueryResult[])
      .catch((e) => {
        console.error("Error from SamePage:");
        console.error(e.message);
        return [];
      });
  }
  logTimestamp("💽💽", "getDatalogQuery");
  const { query, formatResult, inputs } = isCustomEnabled
    ? {
        query: customNode as string,
        formatResult: definedSelections
          ? createFormatResultFn(definedSelections)
          : (r: unknown[]): Promise<QueryResult> =>
              Promise.resolve({
                text: "",
                uid: "",
                ...Object.fromEntries(
                  r.flatMap((p, index) =>
                    typeof p === "object" && p !== null
                      ? Object.entries(p)
                      : [[index.toString(), p]]
                  )
                ),
              }),
        inputs: [],
      }
    : getDatalogQuery(args);

  try {
    if (getNodeEnv() === "development") {
      // console.log("Query to Roam:");
      // console.log(query);
    }
    const id = nanoid(6);
    const queryName = (query.match(/\?(\w+)/)?.[1] || "unnamed") + `-${id}`;
    const consistentWithCount = (query.match(/consistentWith/g) || []).length;

    const startTime = performance.now();
    logTimestamp("🔍🟢", `${queryName} - ${consistentWithCount}`);
    if (inputs.length) console.log("Inputs:", ...inputs);

    const queryResults = await window.roamAlphaAPI.data.async.q(
      query,
      ...inputs
    );
    // console.log(args.context?.r || args.context);
    console.log({
      label: args.context?.r.label,
      iscomplement: args.context?.isComplement,
      complement: args.context?.r.complement,
      query,
      queryResults,
    });
    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`Query ${queryName} took ${duration}ms`);
    logTimestamp("🔍🛑", `${queryName} - ${consistentWithCount}`);

    return Promise.all(queryResults.map(formatResult));
  } catch (e) {
    // console.error("Error from Roam:");
    console.error((e as Error).message);
    console.log({
      label: args.context?.r.label,
      iscomplement: args.context?.isComplement,
      complement: args.context?.r.complement,
      query,
    });

    // Fallback to fast query
    try {
      console.log("Falling back to fast query");
      const fastResults = await window.roamAlphaAPI.data.fast.q(
        query,
        ...inputs
      );
      return Promise.all(fastResults.map(formatResult));
    } catch (fastError) {
      console.error("Fast query also failed:", (fastError as Error).message);
      return [];
    }
  }
};

export default fireQuery;
