import conditionToDatalog from "../utils/conditionToDatalog";
import { Condition, Selection } from "./types";
import type { Result as SearchResult } from "../components/ResultsView";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import type { PullBlock } from "roamjs-components/types";
import { DAILY_NOTE_PAGE_TITLE_REGEX } from "roamjs-components/date/constants";

type PredefinedSelection = {
  test: RegExp;
  pull: (a: {
    returnNode: string;
    match: RegExpExecArray;
    where: string;
  }) => string;
  mapper: (
    r: PullBlock,
    key: string
  ) => SearchResult[string] | Record<string, SearchResult[string]>;
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
      return where.includes(`?${node}`)
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
  const where = conditions.length
    ? conditions.map(conditionToDatalog).join("\n")
    : conditionToDatalog({
        relation: "self",
        source: returnNode,
        target: returnNode,
        uid: "",
        not: false,
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
  const find = definedSelections.map((p) => p.pull).join("\n");
  const query = `[:find\n${find}\n:in $ ?date-regex\n:where\n${where}\n]`;
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
