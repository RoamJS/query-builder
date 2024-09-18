import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import discourseConfigRef from "./discourseConfigRef";
import getDiscourseRelations from "./getDiscourseRelations";
import parseQuery from "./parseQuery";
import { Condition } from "./types";
import { RoamBasicNode } from "roamjs-components/types";
import {
  NanopubTripleType,
  PredicateKey,
  TripleType,
} from "../components/nanopub/NanopubNodeConfig";

// TODO - only text and type should be required
export type DiscourseNode = {
  text: string;
  type: string;
  shortcut: string;
  specification: Condition[];
  backedBy: "user" | "default" | "relation";
  canvasSettings: {
    [k: string]: string;
  };
  // @deprecated - use specification instead
  format: string;
  graphOverview?: boolean;
  nanopub?: {
    enabled: boolean;
    nodeType: string; // defined node URI
    triples: NanopubTripleType[];
  };
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
    canvasSettings: { color: "#000000" },
    backedBy: "default",
    nanopub: { enabled: false, nodeType: "", triples: [] },
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
    canvasSettings: { color: "#505050" },
    backedBy: "default",
    nanopub: { enabled: false, nodeType: "", triples: [] },
  },
];

const parseNanopub = (nanopubNode: RoamBasicNode) => {
  const triplesNode = getSubTree({
    tree: nanopubNode.children,
    key: "triples",
  });
  const isEnabled = !!getSubTree({
    tree: nanopubNode.children,
    key: "enabled",
  }).uid;
  const nodeType = getSubTree({
    tree: nanopubNode.children,
    key: "nodeType",
  }).children[0]?.text;
  return {
    enabled: isEnabled,
    nodeType: nodeType,
    triples: triplesNode.children
      .map((tripleType) =>
        tripleType.children.map((t) => ({
          uid: t.uid,
          predicate: t?.text as PredicateKey,
          object: t.children[0]?.text,
          type: tripleType.text as TripleType,
        }))
      )
      .flat(),
  };
};
const getDiscourseNodes = (relations = getDiscourseRelations()) => {
  const configuredNodes = Object.entries(discourseConfigRef.nodes)
    .map(([type, { text, children }]): DiscourseNode => {
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
        backedBy: "user",
        canvasSettings: Object.fromEntries(
          getSubTree({ tree: children, key: "canvas" }).children.map(
            (c) => [c.text, c.children[0]?.text || ""] as const
          )
        ),
        graphOverview:
          children.filter((c) => c.text === "Graph Overview").length > 0,
        nanopub: parseNanopub(
          getSubTree({
            tree: children,
            key: "nanopub",
          })
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
          backedBy: "relation",
          canvasSettings: {},
          nanopub: { enabled: false, nodeType: "", triples: [] },
        }))
    );
  const configuredNodeTexts = new Set(configuredNodes.map((n) => n.text));
  const defaultNodes = DEFAULT_NODES.filter(
    (n) => !configuredNodeTexts.has(n.text)
  );
  return configuredNodes.concat(defaultNodes);
};

export default getDiscourseNodes;
