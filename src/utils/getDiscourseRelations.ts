import type { InputTextNode, TextNode } from "roamjs-components/types/native";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import DEFAULT_RELATION_VALUES from "../data/defaultDiscourseRelations";
import discourseConfigRef from "./discourseConfigRef";

export type DiscourseRelation = ReturnType<typeof getDiscourseRelations>[number];

const getDiscourseRelations = () =>
  (
    (
      discourseConfigRef.tree.find((t) => toFlexRegex("grammar").test(t.text))
        ?.children || []
    ).find((t) => toFlexRegex("relations").test(t.text))?.children ||
    DEFAULT_RELATION_VALUES
  ).flatMap((r: InputTextNode, i: number) => {
    const tree = (r?.children || []) as TextNode[];
    const data = {
      id: r.uid || `${r.text}-${i}`,
      label: r.text,
      source: getSettingValueFromTree({
        tree,
        key: "Source",
      }),
      destination: getSettingValueFromTree({
        tree,
        key: "Destination",
      }),
      complement: getSettingValueFromTree({
        tree,
        key: "Complement",
      }),
    };
    return (
      tree.find((i) => toFlexRegex("if").test(i.text))?.children || []
    ).map((c) => ({
      ...data,
      triples: c.children
        .filter((t) => !/node positions/i.test(t.text))
        .map((t) => {
          const target = t.children[0]?.children?.[0]?.text || "";
          return [t.text, t.children[0]?.text, target] as const;
        }),
    }));
  });

export default getDiscourseRelations;
