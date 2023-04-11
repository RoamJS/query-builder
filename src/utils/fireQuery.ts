import conditionToDatalog from "../utils/conditionToDatalog";
import type { Result as QueryResult } from "roamjs-components/types/query-builder";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import type {
  PullBlock,
  DatalogAndClause,
  DatalogClause,
} from "roamjs-components/types";
import compileDatalog from "./compileDatalog";
import { DAILY_NOTE_PAGE_REGEX } from "roamjs-components/date/constants";
import { getNodeEnv } from "roamjs-components/util/env";
import apiPost from "roamjs-components/util/apiPost";
import type { Condition, Selection } from "./types";
import getSamePageAPI from "@samepage/external/getSamePageAPI";

export type QueryArgs = {
  returnNode: string;
  conditions: Condition[];
  selections: Selection[];
  inputs?: Record<string, string | number>;
};

type FireQueryArgs = QueryArgs & {
  isBackendEnabled?: boolean;
  isCustomEnabled?: boolean;
  customNode?: string;
};

type FireQuery = (query: FireQueryArgs) => Promise<QueryResult[]>;

type PredefinedSelection = {
  test: RegExp;
  pull: (a: {
    returnNode: string;
    match: RegExpExecArray;
    where: DatalogClause[];
  }) => string;
  mapper: (
    r: PullBlock,
    key: string,
    result: QueryResult
  ) =>
    | QueryResult[string]
    | Record<string, QueryResult[string]>
    | Promise<QueryResult[string] | Record<string, QueryResult[string]>>;
};

const isVariableExposed = (
  clauses: (DatalogClause | DatalogAndClause)[],
  variable: string
): boolean =>
  clauses.some((c) => {
    switch (c.type) {
      case "data-pattern":
      case "fn-expr":
      case "pred-expr":
      case "rule-expr":
        return c.arguments.some((a) => a.value === variable);
      case "not-clause":
      case "or-clause":
      case "and-clause":
        return isVariableExposed(c.clauses, variable);
      case "not-join-clause":
      case "or-join-clause":
        return c.variables.some((v) => v.value === variable);
      default:
        return false;
    }
  });

const firstVariable = (clause: DatalogClause | DatalogAndClause): string => {
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
};

const getVariables = (
  clause: DatalogClause | DatalogAndClause
): Set<string> => {
  if (
    clause.type === "data-pattern" ||
    clause.type === "fn-expr" ||
    clause.type === "pred-expr" ||
    clause.type === "rule-expr"
  ) {
    return new Set(
      [...clause.arguments]
        .filter((v) => v.type === "variable")
        .map((v) => v.value)
    );
  } else if (
    clause.type === "not-clause" ||
    clause.type === "or-clause" ||
    clause.type === "and-clause"
  ) {
    return new Set(clause.clauses.flatMap((c) => Array.from(getVariables(c))));
  } else if (
    clause.type === "not-join-clause" ||
    clause.type === "or-join-clause"
  ) {
    return new Set(clause.variables.map((c) => c.value));
  }
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
          variablesByIndex[j] || (variablesByIndex[j] = getVariables(c));
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

const ALIAS_TEST = /^node$/i;
const REGEX_TEST = /\/([^}]*)\//;
const CREATE_DATE_TEST = /^\s*created?\s*(date|time)\s*$/i;
const EDIT_DATE_TEST = /^\s*edit(?:ed)?\s*(date|time)\s*$/i;
const CREATE_BY_TEST = /^\s*(author|create(d)?\s*by)\s*$/i;
const EDIT_BY_TEST = /^\s*(last\s*)?edit(ed)?\s*by\s*$/i;
const SUBTRACT_TEST = /^subtract\(([^,)]+),([^,)]+)\)$/i;
const ADD_TEST = /^add\(([^,)]+),([^,)]+)\)$/i;
const NODE_TEST = /^node:(\s*[^:]+\s*)(:.*)?$/i;
const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;

const getArgValue = (key: string, result: QueryResult) => {
  if (/^today$/i.test(key)) return new Date();
  const val = result[key];
  if (typeof val === "string" && DAILY_NOTE_PAGE_REGEX.test(val))
    return window.roamAlphaAPI.util.pageTitleToDate(
      DAILY_NOTE_PAGE_REGEX.exec(val)?.[0]
    );
  return val;
};

const getUserDisplayNameById = (id?: number) => {
  if (!id) {
    return "Anonymous User";
  }
  const pageId = window.roamAlphaAPI.pull("[:user/display-page]", id)?.[
    ":user/display-page"
  ]?.[":db/id"];
  if (!pageId) {
    return "Anonymous User";
  }
  return (
    window.roamAlphaAPI.pull("[:node/title]", pageId)?.[":node/title"] ||
    "Anonymous User"
  );
};

const formatDate = ({
  regex,
  key,
  value,
}: {
  regex: RegExp;
  key: string;
  value?: number;
}) => {
  const exec = regex.exec(key);
  const date = new Date(value || 0);
  return /time/i.test(exec?.[1] || "")
    ? `${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}`
    : date;
};

const getBlockAttribute = (key: string, r: PullBlock) => {
  const block = window.roamAlphaAPI.data.fast.q(
    `[:find (pull ?b [:block/string :block/uid]) :where [?a :node/title "${normalizePageTitle(
      key
    )}"] [?p :block/uid "${
      r[":block/uid"]
    }"] [?b :block/refs ?a] [?b :block/parents ?p]]`
  )?.[0]?.[0] as PullBlock;
  return {
    "": (block?.[":block/string"] || "").slice(key.length + 2).trim(),
    "-uid": block?.[":block/uid"],
  };
};

const predefinedSelections: PredefinedSelection[] = [
  {
    test: CREATE_DATE_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:create/time])`,
    mapper: (r, key) => {
      return formatDate({
        regex: CREATE_DATE_TEST,
        key,
        value: r?.[":create/time"],
      });
    },
  },
  {
    test: EDIT_DATE_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:edit/time])`,
    mapper: (r, key) => {
      return formatDate({
        regex: EDIT_DATE_TEST,
        key,
        value: r?.[":edit/time"],
      });
    },
  },
  {
    test: CREATE_BY_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:create/user])`,
    mapper: (r) => {
      return getUserDisplayNameById(r?.[":create/user"]?.[":db/id"]);
    },
  },
  {
    test: EDIT_BY_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:edit/user])`,
    mapper: (r) => {
      return getUserDisplayNameById(r?.[":edit/user"]?.[":db/id"]);
    },
  },
  {
    test: NODE_TEST,
    pull: ({ match, returnNode, where }) => {
      const node = (match[1] || returnNode)?.trim();
      const field = (match[2] || "").trim().substring(1);
      const fields = CREATE_BY_TEST.test(field)
        ? `[:create/user]`
        : EDIT_BY_TEST.test(field)
        ? `[:edit/user]`
        : CREATE_DATE_TEST.test(field)
        ? `[:create/time]`
        : EDIT_DATE_TEST.test(field)
        ? `[:edit/time]`
        : REGEX_TEST.test(field)
        ? `[:node/title :block/string]`
        : field
        ? `[:block/uid]`
        : `[:node/title :block/uid :block/string]`;

      return isVariableExposed(where, node) ? `(pull ?${node} ${fields})` : "";
    },
    mapper: (r, key) => {
      const match = (NODE_TEST.exec(key)?.[2] || "").substring(1);
      const field = Object.keys(r)[0];
      return field === ":create/time"
        ? formatDate({
            regex: CREATE_DATE_TEST,
            key: match,
            value: r?.[":create/time"],
          })
        : field === ":edit/time"
        ? formatDate({
            regex: EDIT_DATE_TEST,
            key: match,
            value: r?.[":edit/time"],
          })
        : field === ":create/user"
        ? getUserDisplayNameById(r?.[":create/user"]?.[":db/id"])
        : field === ":edit/user"
        ? getUserDisplayNameById(r?.[":edit/user"]?.[":db/id"])
        : REGEX_TEST.test(match)
        ? new RegExp(match.slice(1, -1))
            .exec(r?.[":block/string"] || r?.[":node/title"])
            ?.slice(-1)[0]
        : match
        ? getBlockAttribute(match, r)
        : {
            "": r?.[":node/title"] || r[":block/string"] || "",
            "-uid": r[":block/uid"],
          };
    },
  },
  {
    test: ALIAS_TEST,
    pull: () => "",
    mapper: (r) => {
      return "";
    },
  },
  {
    test: SUBTRACT_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:db/id])`,
    mapper: (_, key, result) => {
      const exec = SUBTRACT_TEST.exec(key);
      const arg0 = exec?.[1] || "";
      const arg1 = exec?.[2] || "";
      const val0 = getArgValue(arg0, result);
      const val1 = getArgValue(arg1, result);
      if (val0 instanceof Date && val1 instanceof Date) {
        return Math.floor(
          (val0.valueOf() - val1.valueOf()) / MILLISECONDS_IN_DAY
        );
      } else if (val0 instanceof Date) {
        return new Date(
          val0.valueOf() - MILLISECONDS_IN_DAY * (Number(val1) || 0)
        );
      } else {
        return (Number(val0) || 0) - (Number(val1) || 0);
      }
    },
  },
  {
    test: ADD_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:db/id])`,
    mapper: (_, key, result) => {
      const exec = ADD_TEST.exec(key);
      const arg0 = exec?.[1] || "";
      const arg1 = exec?.[2] || "";
      const val0 = getArgValue(arg0, result);
      const val1 = getArgValue(arg1, result);
      if (val0 instanceof Date && val1 instanceof Date) {
        return val1;
      } else if (val0 instanceof Date) {
        return new Date(
          val0.valueOf() + MILLISECONDS_IN_DAY * (Number(val1) || 0)
        );
      } else if (val1 instanceof Date) {
        return new Date(
          val1.valueOf() + MILLISECONDS_IN_DAY * (Number(val0) || 0)
        );
      } else {
        return (Number(val0) || 0) + (Number(val1) || 0);
      }
    },
  },
  {
    test: /.*/,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:block/uid])`,
    mapper: (r, key) => {
      return getBlockAttribute(key, r);
    },
  },
];

export const registerSelection = (args: PredefinedSelection) => {
  predefinedSelections.splice(predefinedSelections.length - 1, 0, args);
  return () => {
    const index = predefinedSelections.indexOf(args);
    if (index >= 0) {
      predefinedSelections.splice(index, 1);
    }
  };
};

export const getWhereClauses = ({
  conditions,
  returnNode,
}: Omit<FireQueryArgs, "selections">) => {
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

export const getDatalogQuery = ({
  conditions,
  selections,
  returnNode,
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
          "-uid": r[":block/uid"],
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
      .filter((p) => !!p.defined)
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
  const where = whereClauses.map((c) => compileDatalog(c, 0)).join("\n  ");
  return {
    query: `[:find\n  ${find}\n${
      expectedInputs.length
        ? `  :in $ ${expectedInputs.map((i) => `?${i}`).join(" ")}\n`
        : ""
    }:where\n${
      whereClauses.length === 1 && whereClauses[0].type === "not-clause"
        ? `[?node :block/uid _]`
        : ""
    }  ${where}\n]`,
    formatResult: (result: unknown[]) =>
      definedSelections
        .map((c, i) => (prev: QueryResult) => {
          const pullResult = result[i];
          return typeof pullResult === "object" && pullResult !== null
            ? Promise.resolve(
                c.mapper(pullResult as PullBlock, c.key, prev)
              ).then((output) => ({
                output,
                label: c.label,
              }))
            : typeof pullResult === "string" || typeof pullResult === "number"
            ? Promise.resolve({ output: pullResult, label: c.label })
            : Promise.resolve({ output: "", label: c.label });
        })
        .reduce(
          (prev, c) =>
            prev.then((p) =>
              c(p).then(({ output, label }) => {
                if (typeof output === "object" && !(output instanceof Date)) {
                  Object.entries(output).forEach(([k, v]) => {
                    p[label + k] = v;
                  });
                } else if (typeof output === "number") {
                  p[label] = output.toString();
                } else {
                  p[label] = output;
                }
                return p;
              })
            ),
          Promise.resolve({} as QueryResult)
        ),
    inputs: expectedInputs.map((i) => inputs[i]),
  };
};

export let backendToken = "";
export const setBackendToken = (t: string) => (backendToken = t);

const fireQuery: FireQuery = async (args) => {
  // @ts-ignore
  const { isCustomEnabled, customNode } = args as {
    isCustomEnabled: boolean;
    custom: string;
  };
  const { query, formatResult, inputs } = isCustomEnabled
    ? {
        query: customNode as string,
        formatResult: (r: unknown[]): Promise<QueryResult> =>
          Promise.resolve({
            text: "",
            uid: "",
            ...Object.fromEntries(
              r.flatMap((p, index) =>
                typeof p === "object"
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
      console.log("Query to Roam:");
      console.log(query);
    }
    return args.isBackendEnabled && backendToken
      ? apiPost<{ result: PullBlock[][] }>({
          domain: "https://lambda.roamjs.com",
          path: "query",
          authorization: `Bearer ${backendToken}`,
          data: {
            graph: window.roamAlphaAPI.graph.name,
            query,
          },
        }).then((r) => Promise.all(r.result.map(formatResult)))
      : Promise.all(
          window.roamAlphaAPI.data.fast.q(query, ...inputs).map(formatResult)
        );
  } catch (e) {
    console.error("Error from Roam:");
    console.error(e.message);
    return [];
  }
};

export default fireQuery;
