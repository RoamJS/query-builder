import React from "react";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import type { OnloadArgs } from "roamjs-components/types/native";
import type { DiscourseNode } from "../utils/getDiscourseNodes";
import QueryPage from "./QueryPage";

const NodeIndex = ({
  parentUid,
  node,
  onloadArgs,
}: {
  parentUid: string;
  node: DiscourseNode;
  onloadArgs: OnloadArgs
}) => {
  return (
    <ExtensionApiContextProvider {...onloadArgs}>
      <QueryPage pageUid={parentUid} defaultReturnNode={node.text} />
    </ExtensionApiContextProvider>
  );
};

export default NodeIndex;
