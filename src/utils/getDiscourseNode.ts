import findDiscourseNode from "./findDiscourseNode";
import getDiscourseNodes from "./getDiscourseNodes";

const getDiscourseNode = ({
  uid,
  cache = true,
}: {
  uid: string;
  cache?: boolean;
}) => {
  const nodes = getDiscourseNodes();
  const node = findDiscourseNode(uid, nodes, cache);
  return node || null;
};

export default getDiscourseNode;
