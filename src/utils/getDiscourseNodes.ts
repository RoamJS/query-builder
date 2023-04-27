import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import discourseConfigRef from "./discourseConfigRef";
import getDiscourseRelations from "./getDiscourseRelations";
import parseQuery from "./parseQuery";

export type DiscourseNode = ReturnType<typeof getDiscourseNodes>[number];

const getDiscourseNodes = (relations = getDiscourseRelations()) =>
  Object.entries(discourseConfigRef.nodes)
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
          getSubTree({ tree: children, key: "canvas" }).children.map((c) => [
            c.text,
            c.children[0]?.text || "",
          ] as const)
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

export default getDiscourseNodes;
