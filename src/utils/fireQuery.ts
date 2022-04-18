import conditionToDatalog from "../utils/conditionToDatalog";
import type { Result as SearchResult } from "../components/ResultsView";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import type {
  PullBlock,
  DatalogAndClause,
  DatalogClause,
} from "roamjs-components/types";
import { DAILY_NOTE_PAGE_TITLE_REGEX } from "roamjs-components/date/constants";
import compileDatalog from "roamjs-components/queries/compileDatalog";

type PredefinedSelection = {
  test: RegExp;
  pull: (a: {
    returnNode: string;
    match: RegExpExecArray;
    where: DatalogClause[];
  }) => string;
  mapper: (
    r: PullBlock,
    key: string
  ) => SearchResult[string] | Record<string, SearchResult[string]>;
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

const predefinedSelections: PredefinedSelection[] = [
  {
    test: /created?\s*date/i,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:create/time])`,
    mapper: (r) => {
      return new Date(r?.[":create/time"] || 0);
    },
  },
  {
    test: /edit(ed)?\s*date/i,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:edit/time])`,
    mapper: (r) => {
      return new Date(r?.[":edit/time"] || 0);
    },
  },
  {
    test: /author/i,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:create/user])`,
    mapper: (r) => {
      return (
        window.roamAlphaAPI.pull(
          "[:user/display-name]",
          r?.[":create/user"]?.[":db/id"]
        )?.[":user/display-name"] || "Anonymous User"
      );
    },
  },
  {
    test: /^node:(\s*.*\s*)$/i,
    pull: ({ match, returnNode, where }) => {
      const node = (match[1] || returnNode)?.trim();

      return isVariableExposed(where, node)
        ? `(pull ?${node} [:node/title :block/uid])`
        : "";
    },
    mapper: (r) => {
      return {
        "": r?.[":node/title"] || "",
        "-uid": r[":block/uid"],
      };
    },
  },
  {
    test: /.*/,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:block/uid])`,
    mapper: (r, key) => {
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
    },
  },
];

export const registerSelection = (args: PredefinedSelection) => {
  predefinedSelections.splice(predefinedSelections.length - 1, 0, args);
};

export const getDatalogQuery = ({
  conditions,
  returnNode,
  selections,
}: Parameters<typeof window.roamjs.extension.queryBuilder.fireQuery>[0]): {
  query: string;
  definedSelections: {
    mapper: PredefinedSelection["mapper"];
    pull: string;
    label: string;
    key: string;
  }[];
} => {
  const where = conditions.length
    ? conditions.flatMap(conditionToDatalog)
    : conditionToDatalog({
        relation: "self",
        source: returnNode,
        target: returnNode,
        uid: "",
        not: false,
        type: "clause",
      });

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
      label: "text",
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
          where,
          returnNode,
          match: p.defined.test.exec(p.s.text),
        }),
        label: p.s.label || p.s.text,
        key: p.s.text,
      }))
      .filter((p) => !!p.pull)
  );
  const find = definedSelections.map((p) => p.pull).join("\n  ");
  const query = `[:find\n  ${find}\n:in $ ?date-regex\n:where\n${optimizeQuery(
    where,
    new Set(["date-regex"])
  )
    .map((c) => compileDatalog(c, 0))
    .join("\n")}\n]`;
  return { query, definedSelections };
};

const fireQuery: typeof window.roamjs.extension.queryBuilder.fireQuery = (
  args
) => {
  const { query, definedSelections } = getDatalogQuery(args);
  try {
    return window.roamAlphaAPI.data.fast
      .q(query, DAILY_NOTE_PAGE_TITLE_REGEX)
      .map((a) => a as PullBlock[])
      .map((r) =>
        definedSelections.reduce((p, c, i) => {
          const output = c.mapper(r[i], c.key);
          if (typeof output === "object" && !(output instanceof Date)) {
            Object.entries(output).forEach(([k, v]) => {
              p[c.label + k] = v;
            });
          } else {
            p[c.label] = output;
          }
          return p;
        }, {} as SearchResult)
      );
  } catch (e) {
    console.error("Error from Roam:");
    console.error(e.message);
    console.error("Query from Roam:");
    console.error(query);
    return [];
  }
};

export default fireQuery;
