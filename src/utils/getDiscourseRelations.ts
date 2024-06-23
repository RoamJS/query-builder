import type {
  InputTextNode,
  RoamBasicNode,
  TextNode,
} from "roamjs-components/types/native";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import DEFAULT_RELATION_VALUES from "../data/defaultDiscourseRelations";
import discourseConfigRef from "./discourseConfigRef";

export type DiscourseRelation = ReturnType<
  typeof getDiscourseRelations
>[number];

const matchNodeText = (keyword: string) => {
  return (node: RoamBasicNode | TextNode) =>
    toFlexRegex(keyword).test(node.text);
};

const getDiscourseRelations = () => {
  const grammarNode = discourseConfigRef.tree.find(matchNodeText("grammar"));
  const relationsNode = grammarNode?.children.find(matchNodeText("relations"));
  const relationNodes = relationsNode?.children || DEFAULT_RELATION_VALUES;
  const discourseRelations = relationNodes.flatMap(
    (r: InputTextNode, i: number) => {
      const tree = (r?.children || []) as TextNode[];
      const data = {
        id: r.uid || `${r.text}-${i}`,
        label: r.text,
        source: getSettingValueFromTree({ tree, key: "Source" }),
        destination: getSettingValueFromTree({ tree, key: "Destination" }),
        complement: getSettingValueFromTree({ tree, key: "Complement" }),
      };
      const ifNode = tree.find(matchNodeText("if"))?.children || [];
      return ifNode.map((node) => ({
        ...data,
        triples: node.children
          .filter((t) => !/node positions/i.test(t.text))
          .map((t) => {
            const target = t.children[0]?.children?.[0]?.text || "";
            return [t.text, t.children[0]?.text, target] as const;
          }),
      }));
    }
  );

  return discourseRelations;
};

export default getDiscourseRelations;
