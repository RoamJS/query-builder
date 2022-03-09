import conditionToDatalog from "../utils/conditionToDatalog";
import { Condition, Selection } from "./types";
import type { Result as SearchResult } from "../components/ResultsView";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import type { PullBlock } from "roamjs-components/types";

const predefinedSelections: {
  test: RegExp;
  text: string;
  mapper: (r: SearchResult & PullBlock, key: string) => SearchResult[string];
}[] = [
  {
    test: /created?\s*date/i,
    text: ":create/time",
    mapper: (r) => {
      const value = new Date(r[":create/time"]);
      delete r[":create/time"];
      return value;
    },
  },
  {
    test: /edit(ed)?\s*date/i,
    text: ":edit/time",
    mapper: (r) => {
      const value = new Date(r["edit/time"]);
      delete r["edit/time"];
      return value;
    },
  },
  {
    test: /author/i,
    text: ":create/user",
    mapper: (r) => {
      const value = window.roamAlphaAPI.pull(
        "[:user/display-name]",
        r[":create/user"][":db/id"]
      )[":user/display-name"];
      delete r.author;
      return value;
    },
  },
  {
    test: /.*/,
    text: "",
    mapper: (r, key) => {
      return (
        (
          window.roamAlphaAPI.data.fast.q(
            `[:find (pull ?b [:block/string]) :where [?a :node/title "${normalizePageTitle(
              key
            )}"] [?p :block/uid "${
              r.uid
            }"] [?b :block/refs ?a] [?b :block/page ?p]]`
          )?.[0]?.[0] as PullBlock
        )?.[":block/string"] || ""
      )
        .slice(key.length + 2)
        .trim();
    },
  },
];

const DEFAULT_SELECTIONS = [
  {
    mapper: (r: PullBlock & SearchResult, _: string): SearchResult[string] => {
      r.uid = r[":block/uid"];
      const value = r[":node/title"] || r[":block/string"];
      delete r[":block/uid"];
      delete r[":block/string"];
      delete r[":node/title"];
      return value;
    },
    pull: `:block/string\n:node/title\n:block/uid`,
    label: "text",
    key: "",
  },
];

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

  const definedSelections = DEFAULT_SELECTIONS.concat(
    selections
      .map((s) => ({
        defined: predefinedSelections.find((p) => p.test.test(s.text)),
        s,
      }))
      .filter((p) => !!p.defined)
      .map((p) => ({
        mapper: p.defined.mapper,
        pull: p.defined.text,
        label: p.s.label || p.s.text,
        key: p.s.text,
      }))
  );
  const pullSelections = definedSelections.map((p) => p.pull).join("\n");
  const query = `[:find (pull ?${returnNode} [
    ${pullSelections}
  ]) :where ${where}]`;
  try {
    const results = where
      ? window.roamAlphaAPI.data.fast.q(query).map(
          (a) =>
            JSON.parse(JSON.stringify(a[0])) as PullBlock
        )
      : [];
    return results.map(
      (r) =>
        definedSelections.reduce((p, c) => {
          p[c.label] = c.mapper(p, c.key);
          return p;
        }, r as SearchResult & PullBlock) as SearchResult
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
