import conditionToDatalog from "../utils/conditionToDatalog";
import { Condition, Selection } from "./types";
import type { Result as SearchResult } from "../components/ResultsView";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import type { PullBlock } from "roamjs-components/types";

type PredefinedSelection = {
  test: RegExp;
  pull: (a: { returnNode: string; match: RegExpExecArray }) => string;
  mapper: (r: PullBlock, key: string) => SearchResult[string];
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
    pull: ({ match, returnNode }) =>
      `(pull ?${(match[1] || returnNode)?.trim()} [:node/title :block/uid])`,
    mapper: (r) => {
      return r?.[":node/title"] || r?.[":block/string"] || "";
    },
  },
  {
    test: /.*/,
    pull: ({ returnNode }) => `(pull ?${returnNode} [:block/uid])`,
    mapper: (r, key) => {
      return (
        (
          window.roamAlphaAPI.data.fast.q(
            `[:find (pull ?b [:block/string]) :where [?a :node/title "${normalizePageTitle(
              key
            )}"] [?p :block/uid "${
              r[":block/uid"]
            }"] [?b :block/refs ?a] [?b :block/parents ?p]]`
          )?.[0]?.[0] as PullBlock
        )?.[":block/string"] || ""
      )
        .slice(key.length + 2)
        .trim();
    },
  },
];

export const registerSelection = (args: PredefinedSelection) => {
  predefinedSelections.unshift(args);
};

const fireQuery = ({
  conditions,
  returnNode,
  selections,
}: {
  returnNode: string;
  conditions: Condition[];
  selections: Selection[];
}) => {
  const where = conditions.map(conditionToDatalog).join("\n");

  const definedSelections = [
    {
      mapper: (r: PullBlock, _: string): SearchResult[string] => {
        return r?.[":node/title"] || r?.[":block/string"] || "";
      },
      pull: `(pull ?${returnNode} [:block/string :node/title])`,
      label: "text",
      key: "",
    },
    {
      mapper: (r: PullBlock, _: string): SearchResult[string] => {
        return r?.[":block/uid"] || "";
      },
      pull: `(pull ?${returnNode} [:block/uid])`,
      label: "uid",
      key: "",
    },
  ].concat(
    selections
      .map((s) => ({
        defined: predefinedSelections.find((p) => p.test.test(s.text)),
        s,
      }))
      .filter((p) => !!p.defined)
      .map((p) => ({
        mapper: p.defined.mapper,
        pull: p.defined.pull({
          returnNode,
          match: p.defined.test.exec(p.s.text),
        }),
        label: p.s.label || p.s.text,
        key: p.s.text,
      }))
  );
  const find = definedSelections.map((p) => p.pull).join("\n");
  const query = `[:find\n${find}\n:where\n${where}\n]`;
  try {
    const results = where
      ? window.roamAlphaAPI.data.fast
          .q(query)
          .map((a) => JSON.parse(JSON.stringify(a)) as PullBlock[])
      : [];
    return results.map((r) =>
      definedSelections.reduce((p, c, i) => {
        p[c.label] = c.mapper(r[i], c.key);
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
