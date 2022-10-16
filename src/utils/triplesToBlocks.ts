import type { InputTextNode } from "roamjs-components/types";

const triplesToBlocks =
  ({
    defaultPageTitle,
    toPage,
    nodeFormatsByLabel = {},
  }: {
    defaultPageTitle: string;
    toPage: (title: string, blocks: InputTextNode[]) => Promise<void>;
    nodeFormatsByLabel?: Record<string, string>;
  }) =>
  (
    triples: {
      source: string;
      target: string;
      relation: string;
    }[]
  ) =>
  () => {
    const relationToTitle = (source: string) => {
      const rel = triples.find(
        (h) =>
          h.source === source &&
          [/is a/i, /has title/i, /with text/i].some((r) => r.test(h.relation))
      ) || {
        relation: "",
        target: "",
      };
      return /is a/i.test(rel.relation)
        ? (nodeFormatsByLabel[rel.target] || "")
            .replace("{content}", `This is a ${rel.target} page.`)
            .replace(".+", "This is a page of any node type")
        : /has title/i.test(rel.relation)
        ? rel.target
        : /with text/i.test(rel.relation)
        ? rel.target
        : source;
    };
    const blockReferences = new Set<{
      uid: string;
      text: string;
    }>();
    const toBlock = (source: string): InputTextNode => ({
      text: `${[
        ...triples
          .filter((e) => /with text/i.test(e.relation) && e.source === source)
          .map((e) => e.target),
        ...triples
          .filter((e) => /references/i.test(e.relation) && e.source === source)
          .map((e) => {
            const title = relationToTitle(e.target);
            if (title) return `[[${relationToTitle(e.target)}]]`;
            const text = triples.find(
              (h) => h.source === e.target && /with text/i.test(h.relation)
            )?.target;
            if (text) {
              const uid = window.roamAlphaAPI.util.generateUID();
              blockReferences.add({ uid, text });
              return `((${uid}))`;
            }
            return "Invalid Reference Target";
          }),
      ].join(" ")}`,
      children: [
        ...triples
          .filter(
            (c) =>
              [/has child/i, /has descendant/i].some((r) =>
                r.test(c.relation)
              ) && c.source === source
          )
          .map((c) => toBlock(c.target)),
        ...triples
          .filter(
            (c) => /has ancestor/i.test(c.relation) && c.target === source
          )
          .map((c) => toBlock(c.source)),
      ],
    });
    const pageTriples = triples.filter((e) => /is in page/i.test(e.relation));
    if (pageTriples.length) {
      const pages = pageTriples.reduce(
        (prev, cur) => ({
          ...prev,
          [cur.target]: [...(prev[cur.target] || []), cur.source],
        }),
        {} as Record<string, string[]>
      );
      return Promise.all(
        Object.entries(pages).map((p) =>
          toPage(
            relationToTitle(p[0]) || p[0],
            p[1].map(toBlock).concat(Array.from(blockReferences))
          )
        )
      ).then(() => Promise.resolve());
    } else {
      return toPage(
        defaultPageTitle,
        Array.from(
          triples.reduce(
            (prev, cur) => {
              if (
                [
                  /has attribute/i,
                  /has child/i,
                  /references/i,
                  /with text/i,
                  /has descendant/i,
                ].some((r) => r.test(cur.relation))
              ) {
                if (!prev.leaves.has(cur.source)) {
                  prev.roots.add(cur.source);
                }
                prev.leaves.add(cur.target);
                prev.roots.delete(cur.target);
              } else if (/has ancestor/i.test(cur.relation)) {
                if (!prev.leaves.has(cur.target)) {
                  prev.roots.add(cur.target);
                }
                prev.leaves.add(cur.source);
                prev.roots.delete(cur.source);
              }
              return prev;
            },
            {
              roots: new Set<string>(),
              leaves: new Set<string>(),
            }
          ).roots
        )
          .map(toBlock)
          .concat(Array.from(blockReferences))
      );
    }
  };

export default triplesToBlocks;
