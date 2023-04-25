import getDiscourseNodes from "./getDiscourseNodes";
import findDiscourseNode from "./findDiscourseNode";

const isDiscourseNode = (uid?: string, nodes = getDiscourseNodes()) =>
  !!findDiscourseNode(uid, nodes);

export default isDiscourseNode;
