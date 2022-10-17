import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import type { InputTextNode } from "roamjs-components/types";
import createPage from "roamjs-components/writes/createPage";

const pruneNodes = (
  nodes: { children?: InputTextNode[]; uid?: string }[]
): {}[] =>
  nodes
    .filter((n) => !getPageTitleByPageUid(n.uid))
    .map((n) => ({ ...n, children: pruneNodes(n.children || []) }));

const importDiscourseGraph = ({
  title,
  grammar,
  nodes,
  relations,
}: {
  title: string;
  grammar: { source: string; label: string; destination: string }[];
  nodes: {
    uid: string;
    title: string;
    children: InputTextNode[];
    date: string;
    createdBy: string;
  }[];
  relations: { source: string; label: string; target: string }[];
}) => {
  const pagesByUids = Object.fromEntries(
    nodes.map(({ uid, title }) => [uid, title])
  );
  return createPage({
    title,
    tree: relations.map(({ source, target, label }) => ({
      text: `[[${pagesByUids[source]}]]`,
      children: [
        {
          text: label,
          children: [
            {
              text: `[[${pagesByUids[target]}]]`,
            },
          ],
        },
      ],
    })),
  }).then(() =>
    Promise.all(
      pruneNodes(nodes).map(
        (node: { title: string; children: InputTextNode[]; uid: string }) =>
          createPage({ title: node.title, tree: node.children, uid: node.uid })
      )
    )
  );
};

export default importDiscourseGraph;
