import type { RoamBasicNode } from "roamjs-components/types";

const configTreeRef: {
  tree: RoamBasicNode[];
  nodes: { [uid: string]: { text: string; children: RoamBasicNode[] } };
} = { tree: [], nodes: {} };

export default configTreeRef;
