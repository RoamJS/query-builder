import React, { useEffect, useMemo, useState } from "react";
import { Card, Spinner } from "@blueprintjs/core";
import parseQuery, { DEFAULT_RETURN_NODE } from "../../utils/parseQuery";
import createBlock from "roamjs-components/writes/createBlock";
import QueryEditor from "../QueryEditor";

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
            text: ":in NODETEXT",
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
            text: "/^content$/i",
          },
        ],
      },
    ],
  },
];

const NanopubBodySpecification = ({
  parentUid,
  hidden = false,
}: {
  parentUid: string;
  hidden?: boolean;
}) => {
  if (hidden) return null;

  const initialQueryArgs = useMemo(() => parseQuery(parentUid), [parentUid]);
  const [showQuery, setShowQuery] = useState(
    !!initialQueryArgs.conditions.length
  );

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
    if (!showQuery && !hidden) createInitialQueryblocks();
  }, [parentUid, initialQueryArgs, showQuery, hidden]);

  return (
    <>
      <div className="my-2">
        You can add the variables <code>:in NODETEXT</code> or{" "}
        <code>:in NODETITLE</code> which will grab the current pages's text or
        title.
      </div>
      <Card className="p-1 m-0">
        {showQuery ? (
          <QueryEditor parentUid={parentUid} hideCustomSwitch hideQueryButton />
        ) : (
          <Spinner />
        )}
      </Card>
    </>
  );
};

export default NanopubBodySpecification;
