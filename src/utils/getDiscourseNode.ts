import findDiscourseNode from "./findDiscourseNode";
import getDiscourseNodes from "./getDiscourseNodes";

const isDiscourseNode = (uid: string) => {
  const nodes = getDiscourseNodes();
  const node = findDiscourseNode(uid, nodes);
  return node || null;
};

export default isDiscourseNode;
