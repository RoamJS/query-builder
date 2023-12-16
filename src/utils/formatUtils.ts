// To be removed when format is migrated to specification
// https://github.com/RoamJS/query-builder/issues/189

import { PullBlock } from "roamjs-components/types";
import getDiscourseNodes from "../utils/getDiscourseNodes";
import compileDatalog from "./compileDatalog";
import discourseNodeFormatToDatalog from "./discourseNodeFormatToDatalog";

export const getNewDiscourseNodeText = ({
  text,
  nodeType,
  blockUid,
}: {
  text: string;
  nodeType: string;
  blockUid?: string;
}) => {
  const discourseNodes = getDiscourseNodes().filter(
    (n) => n.backedBy === "user"
  );
  const indexedByType = Object.fromEntries(
    discourseNodes.map((mi, i) => [mi.type, mi])
  );

  const format = indexedByType[nodeType]?.format || "";
  const newText = format.replace(/{([\w\d-]*)}/g, (_, val) => {
    if (/content/i.test(val)) return text;
    const referencedNode = discourseNodes.find(({ text }) =>
      new RegExp(text, "i").test(val)
    );
    if (referencedNode) {
      const referenced = window.roamAlphaAPI.data.fast.q(
        `[:find (pull ?r [:node/title :block/string]) :where [?b :block/uid "${blockUid}"] (or-join [?b ?r] (and [?b :block/parents ?p] [?p :block/refs ?r]) (and [?b :block/page ?r])) ${discourseNodeFormatToDatalog(
          {
            freeVar: "r",
            ...referencedNode,
          }
        )
          .map((c) => compileDatalog(c, 0))
          .join(" ")}]`
      )?.[0]?.[0] as PullBlock;
      return referenced?.[":node/title"]
        ? `[[${referenced?.[":node/title"]}]]`
        : referenced?.[":block/string"] || "";
    }
    return "";
  });
  return newText;
};
