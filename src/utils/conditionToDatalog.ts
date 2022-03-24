import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import { DatalogClause } from "roamjs-components/types";

const DatalogTranslator: Record<
  string,
  (args: { source: string; target: string; uid: string }) => DatalogClause[]
> = {
  self: ({ source }) => [
    {
      type: "data-pattern",
      arguments: [
        { type: "variable", value: source },
        { type: "constant", value: ":block/uid" },
        { type: "constant", value: `"${source}"` },
      ],
    },
  ],
  references: ({ source, target }) => [
    {
      type: "data-pattern",
      arguments: [
        { type: "variable", value: source },
        { type: "constant", value: ":block/refs" },
        { type: "variable", value: target },
      ],
    },
  ],
  "is in page": ({ source, target }) => [
    {
      type: "data-pattern",
      arguments: [
        { type: "variable", value: source },
        { type: "constant", value: ":block/page" },
        { type: "variable", value: target },
      ],
    },
  ],
  "has title": ({ source, target }) =>
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
  "with text in title": ({ source, target }) => [
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
  "has attribute": ({ source, target }) => [
    {
      type: "data-pattern",
      arguments: [
        { type: "variable", value: `${target}-Attribute` },
        { type: "constant", value: ":node/title" },
        { type: "variable", value: `"${target}"` },
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
  "has child": ({ source, target }) => [
    {
      type: "data-pattern",
      arguments: [
        { type: "variable", value: source },
        { type: "constant", value: ":block/children" },
        { type: "variable", value: target },
      ],
    },
  ],
  "has ancestor": ({ source, target }) => [
    {
      type: "data-pattern",
      arguments: [
        { type: "variable", value: source },
        { type: "constant", value: ":block/parents" },
        { type: "variable", value: target },
      ],
    },
  ],
  "has descendant": ({ source, target }) => [
    {
      type: "data-pattern",
      arguments: [
        { type: "variable", value: target },
        { type: "constant", value: ":block/parents" },
        { type: "variable", value: source },
      ],
    },
  ],
  "with text": ({ source, target }) => [
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
        { type: "variable", value: `"${normalizePageTitle(target)}"` },
      ],
    },
  ],
  "created by": ({ source, target }) => [
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
};

export const registerDatalogTranslator = ({
  key,
  callback,
}: {
  key: string;
  callback: (args: {
    source: string;
    target: string;
    freeVar: (s: string) => string;
    uid: string;
  }) => DatalogClause[];
}) => {
  DatalogTranslator[key] = callback;
};

export const unregisterDatalogTranslator = ({ key }: { key: string }) =>
  delete DatalogTranslator[key];

export const getConditionLabels = () =>
  Object.keys(DatalogTranslator).filter((k) => k !== "self");

const conditionToDatalog: typeof window.roamjs.extension.queryBuilder.conditionToDatalog = ({
  not,
  relation,
  ...condition
}) => {
  const datalog = DatalogTranslator[relation]?.(condition) || [];
  if (datalog.length && not) return [{ type: "not-clause", clauses: datalog }];
  return datalog;
};

export default conditionToDatalog;
