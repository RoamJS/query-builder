import { DAILY_NOTE_PAGE_TITLE_REGEX } from "roamjs-components/date/constants";
import parseNlpDate from "roamjs-components/date/parseNlpDate";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import type { DatalogClause } from "roamjs-components/types";
import type { QBClauseData } from "roamjs-components/types/query-builder";

type Translator = Record<
  string,
  {
    callback: (args: {
      source: string;
      target: string;
      uid: string;
    }) => DatalogClause[];
    targetOptions?: string[] | ((source: string) => string[]);
    placeholder?: string;
    isVariable?: true;
  }
>;

const translator: Translator = {
  self: {
    callback: ({ source }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/uid" },
          { type: "constant", value: `"${source}"` },
        ],
      },
    ],
  },
  references: {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/refs" },
          { type: "variable", value: target },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "is referenced by": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: target },
          { type: "constant", value: ":block/refs" },
          { type: "variable", value: source },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "is in page": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/page" },
          { type: "variable", value: target },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "has title": {
    callback: ({ source, target }) =>
      /^\s*{date}\s*$/i.test(target)
        ? [
            {
              type: "data-pattern",
              arguments: [
                { type: "variable", value: source },
                { type: "constant", value: ":node/title" },
                { type: "variable", value: `${source}-Title` },
              ],
            },
            {
              type: "fn-expr",
              fn: "re-pattern",
              arguments: [
                {
                  type: "constant",
                  value: `"${DAILY_NOTE_PAGE_TITLE_REGEX.source}"`,
                },
              ],
              binding: {
                type: "bind-scalar",
                variable: { type: "variable", value: `date-regex` },
              },
            },
            {
              type: "pred-expr",
              pred: "re-find",
              arguments: [
                { type: "variable", value: "date-regex" },
                { type: "variable", value: `${source}-Title` },
              ],
            },
          ]
        : [
            {
              type: "data-pattern",
              arguments: [
                { type: "variable", value: source },
                { type: "constant", value: ":node/title" },
                { type: "constant", value: `"${normalizePageTitle(target)}"` },
              ],
            },
          ],
    targetOptions: () => getAllPageNames().concat(["{date}"]),
    placeholder: "Enter a page name or {date} for any DNP",
  },
  "with text in title": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":node/title" },
          { type: "variable", value: `${source}-Title` },
        ],
      },
      {
        type: "pred-expr",
        pred: "clojure.string/includes?",
        arguments: [
          { type: "variable", value: `${source}-Title` },
          { type: "constant", value: `"${normalizePageTitle(target)}"` },
        ],
      },
    ],
    placeholder: "Enter any text",
  },
  "has attribute": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: `${target}-Attribute` },
          { type: "constant", value: ":node/title" },
          { type: "constant", value: `"${target}"` },
        ],
      },
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: target },
          { type: "constant", value: ":block/refs" },
          { type: "variable", value: `${target}-Attribute` },
        ],
      },
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: target },
          { type: "constant", value: ":block/parents" },
          { type: "variable", value: source },
        ],
      },
    ],
    targetOptions: getAllPageNames,
    placeholder: "Enter any attribute name",
    isVariable: true,
  },
  "has child": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/children" },
          { type: "variable", value: target },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "has parent": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: target },
          { type: "constant", value: ":block/children" },
          { type: "variable", value: source },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "has ancestor": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/parents" },
          { type: "variable", value: target },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "has descendant": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: target },
          { type: "constant", value: ":block/parents" },
          { type: "variable", value: source },
        ],
      },
    ],
    placeholder: "Enter any placeholder for the node",
    isVariable: true,
  },
  "with text": {
    callback: ({ source, target }) => [
      {
        type: "or-clause",
        clauses: [
          {
            type: "data-pattern",
            arguments: [
              { type: "variable", value: source },
              { type: "constant", value: ":block/string" },
              { type: "variable", value: `${source}-String` },
            ],
          },
          {
            type: "data-pattern",
            arguments: [
              { type: "variable", value: source },
              { type: "constant", value: ":node/title" },
              { type: "variable", value: `${source}-String` },
            ],
          },
        ],
      },
      {
        type: "pred-expr",
        pred: "clojure.string/includes?",
        arguments: [
          { type: "variable", value: `${source}-String` },
          { type: "constant", value: `"${normalizePageTitle(target)}"` },
        ],
      },
    ],
    placeholder: "Enter any text",
  },
  "created by": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":create/user" },
          { type: "variable", value: `${source}-User` },
        ],
      },
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: `${source}-User` },
          { type: "constant", value: ":user/display-name" },
          { type: "constant", value: `"${normalizePageTitle(target)}"` },
        ],
      },
    ],
    targetOptions: () =>
      window.roamAlphaAPI.data.fast
        .q(`[:find ?n :where [?u :user/display-name ?n]]`)
        .map((a) => a[0] as string),
    placeholder: "Enter the display name of any user with access to this graph",
  },
  "edited by": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":edit/user" },
          { type: "variable", value: `${source}-User` },
        ],
      },
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: `${source}-User` },
          { type: "constant", value: ":user/display-name" },
          { type: "constant", value: `"${normalizePageTitle(target)}"` },
        ],
      },
    ],
    targetOptions: () =>
      window.roamAlphaAPI.data.fast
        .q(`[:find ?n :where [?u :user/display-name ?n]]`)
        .map((a) => a[0] as string),
    placeholder: "Enter the display name of any user with access to this graph",
  },
  "references title": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/refs" },
          { type: "variable", value: target },
        ],
      },
      ...(/^\s*{date}\s*$/i.test(target)
        ? [
            {
              type: "data-pattern" as const,
              arguments: [
                { type: "variable" as const, value: target },
                { type: "constant" as const, value: ":node/title" },
                { type: "variable" as const, value: `${target}-Title` },
              ],
            },
            {
              type: "fn-expr" as const,
              fn: "re-pattern" as const,
              arguments: [
                {
                  type: "constant" as const,
                  value: `"${DAILY_NOTE_PAGE_TITLE_REGEX.source}"`,
                },
              ],
              binding: {
                type: "bind-scalar" as const,
                variable: { type: "variable" as const, value: `date-regex` },
              },
            },
            {
              type: "pred-expr" as const,
              pred: "re-find" as const,
              arguments: [
                { type: "variable" as const, value: "date-regex" },
                { type: "variable" as const, value: `${target}-Title` },
              ],
            },
          ]
        : [
            {
              type: "data-pattern" as const,
              arguments: [
                { type: "variable" as const, value: target },
                { type: "constant" as const, value: ":node/title" },
                {
                  type: "constant" as const,
                  value: `"${normalizePageTitle(target)}"`,
                },
              ],
            },
          ]),
    ],
    targetOptions: () => getAllPageNames().concat(["{date}"]),
    placeholder: "Enter a page name or {date} for any DNP",
  },
  "has heading": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/heading" },
          { type: "constant", value: target },
        ],
      },
    ],
    targetOptions: ["1", "2", "3", "0"],
    placeholder: "Enter a heading value (0, 1, 2, 3)",
  },
  "is in page with title": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/page" },
          { type: "variable", value: target },
        ],
      },
      ...(/^\s*{date}\s*$/i.test(target)
        ? [
            {
              type: "data-pattern" as const,
              arguments: [
                { type: "variable" as const, value: target },
                { type: "constant" as const, value: ":node/title" },
                { type: "variable" as const, value: `${target}-Title` },
              ],
            },
            {
              type: "fn-expr" as const,
              fn: "re-pattern" as const,
              arguments: [
                {
                  type: "constant" as const,
                  value: `"${DAILY_NOTE_PAGE_TITLE_REGEX.source}"`,
                },
              ],
              binding: {
                type: "bind-scalar" as const,
                variable: { type: "variable" as const, value: `date-regex` },
              },
            },
            {
              type: "pred-expr" as const,
              pred: "re-find" as const,
              arguments: [
                { type: "variable" as const, value: "date-regex" },
                { type: "variable" as const, value: `${target}-Title` },
              ],
            },
          ]
        : [
            {
              type: "data-pattern" as const,
              arguments: [
                { type: "variable" as const, value: target },
                { type: "constant" as const, value: ":node/title" },
                {
                  type: "constant" as const,
                  value: `"${normalizePageTitle(target)}"`,
                },
              ],
            },
          ]),
    ],
    targetOptions: getAllPageNames,
    placeholder: "Enter a page name or {date} for any DNP",
  },
  "created after": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":create/time" },
          { type: "variable", value: `${source}-CreateTime` },
        ],
      },
      {
        type: "pred-expr",
        pred: "<",
        arguments: [
          { type: "constant", value: `${parseNlpDate(target).valueOf()}` },
          { type: "variable", value: `${source}-CreateTime` },
        ],
      },
    ],
    placeholder: "Enter any natural language date value",
  },
  "created before": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":create/time" },
          { type: "variable", value: `${source}-CreateTime` },
        ],
      },
      {
        type: "pred-expr",
        pred: ">",
        arguments: [
          { type: "constant", value: `${parseNlpDate(target).valueOf()}` },
          { type: "variable", value: `${source}-CreateTime` },
        ],
      },
    ],
    placeholder: "Enter any natural language date value",
  },
  "edited after": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":edit/time" },
          { type: "variable", value: `${source}-EditTime` },
        ],
      },
      {
        type: "pred-expr",
        pred: "<",
        arguments: [
          { type: "constant", value: `${parseNlpDate(target).valueOf()}` },
          { type: "variable", value: `${source}-EditTime` },
        ],
      },
    ],
    placeholder: "Enter any natural language date value",
  },
  "edited before": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":edit/time" },
          { type: "variable", value: `${source}-EditTime` },
        ],
      },
      {
        type: "pred-expr",
        pred: ">",
        arguments: [
          { type: "constant", value: `${parseNlpDate(target).valueOf()}` },
          { type: "variable", value: `${source}-EditTime` },
        ],
      },
    ],
    placeholder: "Enter any natural language date value",
  },
};

export const registerDatalogTranslator = ({
  key,
  ...translation
}: {
  key: string;
} & Translator[string]) => {
  translator[key] = translation;
};

export const unregisterDatalogTranslator = ({ key }: { key: string }) =>
  delete translator[key];

export const getConditionLabels = () =>
  Object.keys(translator)
    .filter((k) => k !== "self")
    .sort((a, b) => b.length - a.length);

const conditionToDatalog: typeof window.roamjs.extension.queryBuilder.conditionToDatalog =
  (con) => {
    if (con.type === "or" || con.type === "not or") {
      const datalog = [
        {
          type: "or-join-clause",
          clauses: con.conditions.map((branch) => ({
            type: "and-clause",
            clauses: branch.flatMap((c) => conditionToDatalog(c)),
          })),
          variables: [],
        },
      ] as DatalogClause[];
      if (con.type === "not or")
        return [{ type: "not-clause", clauses: datalog }];
      return datalog;
    }
    const { relation, ...condition } = con;
    const datalogTranslator =
      translator[relation] ||
      Object.entries(translator).find(([k]) =>
        new RegExp(relation, "i").test(k)
      )?.[1];
    const datalog = datalogTranslator?.callback?.(condition) || [];
    if (datalog.length && con.type === "not")
      return [{ type: "not-clause", clauses: datalog }];
    return datalog;
  };

export const sourceToTargetOptions = ({
  source,
  relation,
}: {
  source: string;
  relation: string;
}): string[] => {
  const targetOptions = translator[relation]?.targetOptions;
  if (!targetOptions) return [];
  if (typeof targetOptions === "function") return targetOptions(source);
  return targetOptions;
};

export const sourceToTargetPlaceholder = ({
  relation,
}: {
  relation: string;
}): string => {
  return translator[relation]?.placeholder || "Enter Value";
};

export const isTargetVariable = ({
  relation,
}: {
  relation: string;
}): boolean => {
  return translator[relation]?.isVariable || false;
};

export default conditionToDatalog;
