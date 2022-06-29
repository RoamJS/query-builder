import conditionToDatalog from "../utils/conditionToDatalog";
import type { Result as SearchResult } from "../components/ResultsView";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import type {
  PullBlock,
  DatalogAndClause,
  DatalogClause,
} from "roamjs-components/types";
import compileDatalog from "roamjs-components/queries/compileDatalog";

type PredefinedSelection = Parameters<
  typeof window.roamjs.extension.queryBuilder.registerSelection
>[0];

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

const joinVariables = (
  clauses: (DatalogClause | DatalogAndClause)[]
) => {
  clauses.forEach(clause => {
    if (
      clause.type === "not-clause" ||
      clause.type === "or-clause" ||
      clause.type === "and-clause" ||
      clause.type === "not-join-clause" ||
      clause.type === "or-join-clause"
    ) {
      joinVariables(clause.clauses);
      const allVariables = new Set();
      
    }
  })
}

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

const CREATE_DATE_TEST = /^\s*created?\s*date\s*$/i;
const EDIT_DATE_TEST = /^\s*edit(ed)?\s*date\s*$/i;
const CREATE_BY_TEST = /^\s*(author|create(d)?\s*by)\s*$/i;
const EDIT_BY_TEST = /^\s*(last\s*)?edit(ed)?\s*by\s*$/i;

const predefinedSelections: PredefinedSelection[] = [
  {
    test: CREATE_DATE_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:create/time])`,
    mapper: (r) => {
      return new Date(r?.[":create/time"] || 0);
    },
  },
  {
    test: EDIT_DATE_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:edit/time])`,
    mapper: (r) => {
      return new Date(r?.[":edit/time"] || 0);
    },
  },
  {
    test: CREATE_BY_TEST,
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
    test: EDIT_BY_TEST,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:edit/user])`,
    mapper: (r) => {
      return (
        window.roamAlphaAPI.pull(
          "[:user/display-name]",
          r?.[":edit/user"]?.[":db/id"]
        )?.[":user/display-name"] || "Anonymous User"
      );
    },
  },
  {
    test: /^node:(\s*[^:]+\s*)(?::([^:]+))?$/i,
    pull: ({ match, returnNode, where }) => {
      const node = (match[1] || returnNode)?.trim();
      const field = (match[2] || "").trim();
      const fields = CREATE_BY_TEST.test(field)
        ? `[:create/user]`
        : EDIT_BY_TEST.test(field)
        ? `[:edit/user]`
        : CREATE_DATE_TEST.test(field)
        ? `[:create/time]`
        : EDIT_DATE_TEST.test(field)
        ? `[:edit/time]`
        : `[:node/title :block/uid :block/string]`;

      return isVariableExposed(where, node) ? `(pull ?${node} ${fields})` : "";
    },
    mapper: (r) => {
      const key = Object.keys(r)[0];
      return key === ":create/time"
        ? new Date(r?.[":create/time"] || 0)
        : key === ":edit/time"
        ? new Date(r?.[":edit/time"] || 0)
        : key === ":create/user"
        ? window.roamAlphaAPI.pull(
            "[:user/display-name]",
            r?.[":create/user"]?.[":db/id"]
          )?.[":user/display-name"] || "Anonymous User"
        : key === ":edit/user"
        ? window.roamAlphaAPI.pull(
            "[:user/display-name]",
            r?.[":edit/user"]?.[":db/id"]
          )?.[":user/display-name"] || "Anonymous User"
        : {
            "": r?.[":node/title"] || r[":block/string"] || "",
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

export const registerSelection: typeof window.roamjs.extension.queryBuilder.registerSelection =
  (args) => {
    predefinedSelections.splice(predefinedSelections.length - 1, 0, args);
  };

type FireQueryArgs = Parameters<
  typeof window.roamjs.extension.queryBuilder.fireQuery
>[0];

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

export const getDatalogQueryComponents = ({
  conditions,
  returnNode,
  selections,
}: FireQueryArgs): {
  where: DatalogClause[];
  definedSelections: {
    mapper: PredefinedSelection["mapper"];
    pull: string;
    label: string;
    key: string;
  }[];
} => {
  const where = optimizeQuery(
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
  return { definedSelections, where };
};

export const getDatalogQuery = (
  args: ReturnType<typeof getDatalogQueryComponents>
) => {
  const find = args.definedSelections.map((p) => p.pull).join("\n  ");
  const query = `[:find\n  ${find}\n:where\n${args.where
    .map((c) => compileDatalog(c, 0))
    .join("\n")}\n]`;
  return query;
};

const fireQuery: typeof window.roamjs.extension.queryBuilder.fireQuery = async (
  args
) => {
  const parts = getDatalogQueryComponents(args);
  const query = getDatalogQuery(parts);
  try {
    return Promise.all(
      window.roamAlphaAPI.data.fast
        .q(query)
        .map((a) => a as PullBlock[])
        .map((r) =>
          parts.definedSelections
            .map(
              (c, i) => () =>
                !r[i]
                  ? Promise.resolve({ output: "", label: c.label })
                  : Promise.resolve(c.mapper(r[i], c.key)).then((output) => ({
                      output,
                      label: c.label,
                    }))
            )
            .reduce(
              (prev, c) =>
                prev.then((p) =>
                  c().then(({ output, label }) => {
                    if (
                      typeof output === "object" &&
                      !(output instanceof Date)
                    ) {
                      Object.entries(output).forEach(([k, v]) => {
                        p[label + k] = v;
                      });
                    } else {
                      p[label] = output;
                    }
                    return p;
                  })
                ),
              Promise.resolve({} as SearchResult)
            )
        )
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
