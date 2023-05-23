import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import discourseConfigRef from "./discourseConfigRef";
import getDiscourseRelations from "./getDiscourseRelations";
import parseQuery from "./parseQuery";
import { Condition } from "./types";

// TODO - only text and type should be required
export type DiscourseNode = {
  text: string;
  type: string;
  shortcut: string;
  specification: Condition[];
  
  // TODO - wondering if this should be an enum instead
  // 'relation' | 'default' | 'user'
  isRelationBacked: boolean; 
  canvasSettings: {
    [k: string]: string;
  };
  // @deprecated - use specification instead
  format: string;
};

const DEFAULT_NODES: DiscourseNode[] = [
  {
    text: "Page",
    type: "page-node",
    shortcut: "p",
    format: "{content}",
    specification: [
      {
        type: "clause",
        source: "Page",
        relation: "has title",
        target: "/^(.*)$/",
        uid: window.roamAlphaAPI.util.generateUID(),
      },
    ],
    isRelationBacked: false,
    canvasSettings: {},
  },
  {
    text: "Block",
    type: "blck-node",
    shortcut: "b",
    format: "{content}",
    specification: [
      {
        type: "clause",
        source: "Block",
        relation: "is in page",
        target: "_",
        uid: window.roamAlphaAPI.util.generateUID(),
      },
    ],
    isRelationBacked: false,
    canvasSettings: {},
  },
];

const getDiscourseNodes = (relations = getDiscourseRelations()) => {
  const configuredNodes = Object.entries(discourseConfigRef.nodes)
    .map(([type, { text, children }]) => {
      const spec = getSubTree({
        tree: children,
        key: "specification",
      });
      const specTree = spec.children;
      return {
        format: getSettingValueFromTree({ tree: children, key: "format" }),
        text,
        shortcut: getSettingValueFromTree({ tree: children, key: "shortcut" }),
        type,
        specification: !!getSubTree({ tree: specTree, key: "enabled" }).uid
          ? parseQuery(spec.uid).conditions
          : [],
        isRelationBacked: false,
        canvasSettings: Object.fromEntries(
          getSubTree({ tree: children, key: "canvas" }).children.map(
            (c) => [c.text, c.children[0]?.text || ""] as const
          )
        ),
      };
    })
    .concat(
      relations
        .filter((r) => r.triples.some((t) => t.some((n) => /anchor/i.test(n))))
        .map((r) => ({
          format: "",
          text: r.label,
          type: r.id,
          shortcut: r.label.slice(0, 1),
          specification: r.triples.map(([source, relation, target]) => ({
            type: "clause",
            source: /anchor/i.test(source) ? r.label : source,
            relation,
            target:
              target === "source"
                ? r.source
                : target === "destination"
                ? r.destination
                : /anchor/i.test(target)
                ? r.label
                : target,
            uid: window.roamAlphaAPI.util.generateUID(),
          })),
          isRelationBacked: true,
          canvasSettings: {},
        }))
    );
  const configuredNodeTexts = new Set(configuredNodes.map((n) => n.text));
  const defaultNodes = DEFAULT_NODES.filter(
    (n) => !configuredNodeTexts.has(n.text)
  );
  return defaultNodes.concat(configuredNodes);
};

export default getDiscourseNodes;
