import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import { Condition } from "./types";

const DatalogTranslator: Record<
  string,
  (args: {
    freeVar: (s: string) => string;
    source: string;
    target: string;
    uid: string;
  }) => string
> = {
  references: ({ source, target, freeVar }) =>
    `[${freeVar(source)} :block/refs ${freeVar(target)}]`,
  "is in page": ({ source, target, freeVar }) =>
    `[${freeVar(source)} :block/page ${freeVar(target)}]`,
  "has title": ({ source, target, freeVar }) =>
    `[${freeVar(source)} :node/title "${normalizePageTitle(target)}"]`,
  "with text in title": ({ source, target, freeVar }) =>
    `[${freeVar(source)} :node/title ${freeVar(
      source
    )}-Title] [(clojure.string/includes? ${freeVar(
      source
    )}-Title "${normalizePageTitle(target)}")]`,
  "has attribute": ({ source, target, freeVar }) =>
    `[${freeVar(target)}-Attribute :node/title "${target}"] [${freeVar(
      target
    )} :block/refs ${freeVar(target)}-Attribute] [${freeVar(
      target
    )} :block/parents ${freeVar(source)}]`,
  "has child": ({ source, target, freeVar }) =>
    `[${freeVar(source)} :block/children ${freeVar(target)}]`,
  "has ancestor": ({ source, target, freeVar }) =>
    `[${freeVar(source)} :block/parents ${freeVar(target)}]`,
  "has descendant": ({ source, target, freeVar }) =>
    `[${freeVar(target)} :block/parents ${freeVar(source)}]`,
  "with text": ({ source, target, freeVar }) =>
    `(or [${freeVar(source)} :block/string ${freeVar(
      source
    )}-String] [${freeVar(source)} :node/title ${freeVar(
      source
    )}-String]) [(clojure.string/includes? ${freeVar(
      source
    )}-String "${normalizePageTitle(target)}")]`,
  "created by": ({ source, target, freeVar }) =>
    `[${freeVar(source)} :create/user ${freeVar(source)}-User] [${freeVar(
      source
    )}-User :user/display-name "${normalizePageTitle(target)}"]`,
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
  }) => string;
}) => {
  DatalogTranslator[key] = callback;
};

export const unregisterDatalogTranslator = ({ key }: { key: string }) =>
  delete DatalogTranslator[key];

export const getConditionLabels = () => Object.keys(DatalogTranslator);

const conditionToDatalog = ({
  not,
  relation,
  ...condition
}: Condition): string => {
  const datalog =
    DatalogTranslator[relation]?.({
      freeVar: (v: string) => `?${v.replace(/ /g, "")}`,
      ...condition,
    }) || "";
  if (datalog && not) return `(not ${datalog})`;
  return datalog;
};

export default conditionToDatalog;
