import React, { useEffect, useMemo, useState } from "react";
import { Spinner } from "@blueprintjs/core";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import type { OnloadArgs } from "roamjs-components/types/native";
import QueryPage from "./QueryPage";
import parseQuery, { DEFAULT_RETURN_NODE } from "../utils/parseQuery";
import createBlock from "roamjs-components/writes/createBlock";

const CommentsQuery = ({
  parentUid,
  onloadArgs,
}: {
  parentUid: string;
  onloadArgs: OnloadArgs;
}) => {
  const initialQueryArgs = useMemo(() => parseQuery(parentUid), [parentUid]);
  const [showQuery, setShowQuery] = useState(
    !!initialQueryArgs.conditions.length
  );

  const initialQueryConditionBlocks = [
    {
      text: "clause",
      children: [
        {
          text: "source",
          children: [{ text: DEFAULT_RETURN_NODE }],
        },
        {
          text: "relation",
          children: [{ text: "is in page with title" }],
        },
        {
          text: "target",
          children: [
            {
              text: "{current}",
            },
          ],
        },
      ],
    },
    {
      text: "clause",
      children: [
        {
          text: "source",
          children: [{ text: DEFAULT_RETURN_NODE }],
        },
        {
          text: "relation",
          children: [{ text: "with text" }],
        },
        {
          text: "target",
          children: [
            {
              text: "Comments",
            },
          ],
        },
      ],
    },
    {
      text: "clause",
      children: [
        {
          text: "source",
          children: [{ text: DEFAULT_RETURN_NODE }],
        },
        {
          text: "relation",
          children: [{ text: "has heading" }],
        },
        {
          text: "target",
          children: [
            {
              text: "1",
            },
          ],
        },
      ],
    },
  ];

  const createInitialQueryblocks = async () => {
    for (const block of initialQueryConditionBlocks) {
      await createBlock({
        parentUid: initialQueryArgs.conditionsNodesUid,
        order: "last",
        node: block,
      });
    }
    setShowQuery(true);
  };

  useEffect(() => {
    if (!showQuery) createInitialQueryblocks();
  }, [parentUid, initialQueryArgs, showQuery]);

  return (
    <ExtensionApiContextProvider {...onloadArgs}>
      {showQuery ? <QueryPage pageUid={parentUid} /> : <Spinner />}
    </ExtensionApiContextProvider>
  );
};

export default CommentsQuery;
