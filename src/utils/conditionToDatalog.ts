import { DAILY_NOTE_PAGE_TITLE_REGEX } from "roamjs-components/date/constants";
import parseNlpDate from "roamjs-components/date/parseNlpDate";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import startOfDay from "date-fns/startOfDay";
import endOfDay from "date-fns/endOfDay";
import type { DatalogClause, PullBlock } from "roamjs-components/types";
import { Condition } from "./types";

type ConditionToDatalog = (condition: Condition) => DatalogClause[];

const INPUT_REGEX = /^:in /;

const getTitleDatalog = ({
  source,
  target,
}: {
  source: string;
  target: string;
}): DatalogClause[] => {
  const dateMatch = /^\s*{date(?::([^}]+))?}\s*$/i.exec(target);
  if (dateMatch) {
    const nlp = dateMatch[1] || "";
    if (nlp) {
      const date = parseNlpDate(nlp);
      return [
        {
          type: "data-pattern",
          arguments: [
            { type: "variable", value: source },
            { type: "constant", value: ":node/title" },
            {
              type: "constant",
              value: `"${window.roamAlphaAPI.util.dateToPageTitle(date)}"`,
            },
          ],
        },
      ];
    } else {
      return [
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
      ];
    }
  }
  if (target.startsWith("/") && target.endsWith("/")) {
    return [
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
        fn: "re-pattern" as const,
        arguments: [
          {
            type: "constant",
            value: `"${target.slice(1, -1).replace(/\\/g, "\\\\")}"`,
          },
        ],
        binding: {
          type: "bind-scalar",
          variable: { type: "variable", value: `${target}-regex` },
        },
      },
      {
        type: "pred-expr",
        pred: "re-find",
        arguments: [
          { type: "variable", value: `${target}-regex` },
          { type: "variable", value: `${source}-Title` },
        ],
      },
    ];
  }
  if (INPUT_REGEX.test(target)) {
    return [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":node/title" },
          { type: "variable", value: target.replace(INPUT_REGEX, "") },
        ],
      },
    ];
  }
  return [
    {
      type: "data-pattern",
      arguments: [
        { type: "variable", value: source },
        { type: "constant", value: ":node/title" },
        { type: "constant", value: `"${normalizePageTitle(target)}"` },
      ],
    },
  ];
};

type Translator = {
  callback: (args: {
    source: string;
    target: string;
    uid: string;
  }) => DatalogClause[];
  targetOptions?: string[] | ((source: string) => string[]);
  placeholder?: string;
  isVariable?: true;
};

const translator: Record<string, Translator> = {
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
    callback: getTitleDatalog,
    targetOptions: () => getAllPageNames().concat(["{date}", "{date:today}"]),
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
          { type: "constant", value: ":user/display-page" },
          { type: "variable", value: `${source}-User-Display` },
        ],
      },
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: `${source}-User-Display` },
          { type: "constant", value: ":node/title" },
          { type: "constant", value: `"${normalizePageTitle(target)}"` },
        ],
      },
    ],
    targetOptions: () =>
      window.roamAlphaAPI.data.fast
        .q(`[:find (pull ?n [:node/title]) :where [?u :user/display-page ?n]]`)
        .map((d: [PullBlock]) => d[0][":node/title"]),
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
          { type: "constant", value: ":user/display-page" },
          { type: "variable", value: `${source}-User-Display` },
        ],
      },
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: `${source}-User-Display` },
          { type: "constant", value: ":node/title" },
          { type: "constant", value: `"${normalizePageTitle(target)}"` },
        ],
      },
    ],
    targetOptions: () =>
      window.roamAlphaAPI.data.fast
        .q(`[:find (pull ?n [:node/title]) :where [?u :user/display-page ?n]]`)
        .map((d: [PullBlock]) => d[0][":node/title"]),
    placeholder: "Enter the display name of any user with access to this graph",
  },
  "references title": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/refs" },
          { type: "variable", value: `${target}-Ref` },
        ],
      },
      ...getTitleDatalog({ source: `${target}-Ref`, target }),
    ],
    targetOptions: () => getAllPageNames().concat(["{date}", "{date:today}"]),
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
      ...getTitleDatalog({ source: target, target }),
    ],
    targetOptions: () => getAllPageNames().concat(["{date}", "{date:today}"]),
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
  "titled before": {
    callback: ({ source, target }) => {
      const sourceLog: DatalogClause = {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":log/id" },
          { type: "variable", value: `${source}-Log` },
        ],
      };
      return INPUT_REGEX.test(target)
        ? [
            sourceLog,
            {
              type: "data-pattern",
              arguments: [
                { type: "variable", value: `${target}-Date` },
                { type: "constant", value: ":node/title" },
                { type: "variable", value: target.replace(INPUT_REGEX, "") },
              ],
            },
            {
              type: "data-pattern",
              arguments: [
                { type: "variable", value: `${target}-Date` },
                { type: "constant", value: ":log/id" },
                { type: "variable", value: `${target}-Log` },
              ],
            },
            {
              type: "pred-expr",
              pred: ">",
              arguments: [
                {
                  type: "variable",
                  value: `${target}-Log`,
                },
                { type: "variable", value: `${source}-Log` },
              ],
            },
          ]
        : [
            sourceLog,
            {
              type: "pred-expr",
              pred: ">",
              arguments: [
                {
                  type: "constant",
                  value: `${startOfDay(parseNlpDate(target)).valueOf()}`,
                },
                { type: "variable", value: `${source}-Log` },
              ],
            },
          ];
    },
    placeholder: "Enter any natural language date value",
  },
  "titled after": {
    callback: ({ source, target }) => {
      const sourceLog: DatalogClause = {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":log/id" },
          { type: "variable", value: `${source}-Log` },
        ],
      };
      return INPUT_REGEX.test(target)
        ? [
            sourceLog,
            {
              type: "data-pattern",
              arguments: [
                { type: "variable", value: `${target}-Date` },
                { type: "constant", value: ":node/title" },
                { type: "variable", value: target.replace(INPUT_REGEX, "") },
              ],
            },
            {
              type: "data-pattern",
              arguments: [
                { type: "variable", value: `${target}-Date` },
                { type: "constant", value: ":log/id" },
                { type: "variable", value: `${target}-Log` },
              ],
            },
            {
              type: "pred-expr",
              pred: "<",
              arguments: [
                {
                  type: "variable",
                  value: `${target}-Log`,
                },
                { type: "variable", value: `${source}-Log` },
              ],
            },
          ]
        : [
            sourceLog,
            {
              type: "pred-expr",
              pred: "<",
              arguments: [
                {
                  type: "constant",
                  value: `${endOfDay(parseNlpDate(target)).valueOf()}`,
                },
                { type: "variable", value: `${source}-Log` },
              ],
            },
          ];
    },
    placeholder: "Enter any natural language date value",
  },
};

export const registerDatalogTranslator = ({
  key,
  ...translation
}: Translator & { key: string }) => {
  translator[key] = translation;
  return () => unregisterDatalogTranslator({ key });
};

export const unregisterDatalogTranslator = ({ key }: { key: string }) =>
  delete translator[key];

export const getConditionLabels = () =>
  Object.keys(translator)
    .filter((k) => k !== "self")
    .sort((a, b) => b.length - a.length);

const conditionToDatalog: ConditionToDatalog = (con) => {
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
  if (datalog.length && (con.type === "not" || con.not))
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
