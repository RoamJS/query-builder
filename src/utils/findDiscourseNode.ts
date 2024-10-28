import getDiscourseNodes, { DiscourseNode } from "./getDiscourseNodes";
import matchDiscourseNode from "./matchDiscourseNode";

const discourseNodeTypeCache: Record<string, DiscourseNode | false> = {};

// TODO - should we just tie in cache to refreshConfigTree?

const findDiscourseNode = (
  uid = "",
  nodes = getDiscourseNodes(),
  cache = true
) =>
  cache && typeof discourseNodeTypeCache[uid] !== "undefined"
    ? discourseNodeTypeCache[uid]
    : (discourseNodeTypeCache[uid] =
        nodes.find((n) => matchDiscourseNode({ ...n, uid })) || false);

export default findDiscourseNode;
