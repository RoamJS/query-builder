import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import { DatalogClause } from "roamjs-components/types";

type Translator = Record<
  string,
  {
    callback: (args: {
      source: string;
      target: string;
      uid: string;
    }) => DatalogClause[];
    targetOptions?: string[] | ((source: string) => string[]);
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
              type: "pred-expr",
              pred: "re-matches",
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
    targetOptions: getAllPageNames,
  },
  "with text in title": {
    callback: ({ source, target }) => [
      {
        type: "data-pattern",
        arguments: [
          { type: "variable", value: source },
          { type: "constant", value: ":block/page" },
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
          { type: "variable", value: `"${normalizePageTitle(target)}"` },
        ],
      },
    ],
    targetOptions: () =>
      window.roamAlphaAPI.data.fast
        .q(`[:find ?n :where [?u :user/display-name ?n]]`)
        .map((a) => a[0] as string),
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
  Object.keys(translator).filter((k) => k !== "self");

const conditionToDatalog: typeof window.roamjs.extension.queryBuilder.conditionToDatalog =
  ({ not, relation, ...condition }) => {
    const datalog = translator[relation]?.callback?.(condition) || [];
    if (datalog.length && not)
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

export default conditionToDatalog;
