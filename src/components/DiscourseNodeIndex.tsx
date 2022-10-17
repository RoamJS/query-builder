import React from "react";
import type { DiscourseNode } from "../utils/getDiscourseNodes";
import QueryPage from "./QueryPage";

const NodeIndex = ({
  parentUid,
  node,
}: {
  parentUid: string;
  node: DiscourseNode;
}) => {
  return <QueryPage pageUid={parentUid} defaultReturnNode={node.text} />;
};

export default NodeIndex;
