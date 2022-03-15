import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import { Condition } from "./types";

const freeVar = (v: string) => `?${v.replace(/ /g, "")}`;

const DatalogTranslator: Record<string, (s: string, t: string) => string> = {
  references: (src, tar) => `[${freeVar(src)} :block/refs ${freeVar(tar)}]`,
  "is in page": (src, tar) => `[${freeVar(src)} :block/page ${freeVar(tar)}]`,
  "has title": (src, tar) =>
    `[${freeVar(src)} :node/title "${normalizePageTitle(tar)}"]`,
  "with text in title": (src, tar) =>
    `[${freeVar(src)} :node/title ${freeVar(
      src
    )}-Title] [(clojure.string/includes? ${freeVar(
      src
    )}-Title "${normalizePageTitle(tar)}")]`,
  "has attribute": (src, tar) =>
    `[${freeVar(tar)}-Attribute :node/title "${tar}"] [${freeVar(
      tar
    )} :block/refs ${freeVar(tar)}-Attribute] [${freeVar(
      tar
    )} :block/parents ${freeVar(src)}]`,
  "has child": (src, tar) =>
    `[${freeVar(src)} :block/children ${freeVar(tar)}]`,
  "has ancestor": (src, tar) =>
    `[${freeVar(src)} :block/parents ${freeVar(tar)}]`,
  "has descendant": (src, tar) =>
    `[${freeVar(tar)} :block/parents ${freeVar(src)}]`,
  "with text": (src, tar) =>
    `(or [${freeVar(src)} :block/string ${freeVar(src)}-String] [${freeVar(
      src
    )} :node/title ${freeVar(
      src
    )}-String]) [(clojure.string/includes? ${freeVar(
      src
    )}-String "${normalizePageTitle(tar)}")]`,
  "created by": (src, tar) =>
    `[${freeVar(src)} :create/user ${freeVar(src)}-User] [${freeVar(
      src
    )}-User :user/display-name "${normalizePageTitle(tar)}"]`,
} as const;

export const conditionLabels = Object.keys(DatalogTranslator);

const conditionToDatalog = (condition: Condition): string => {
  return (
    DatalogTranslator[condition.relation]?.(
      condition.source,
      condition.target
    ) || ""
  );
};

export default conditionToDatalog;
