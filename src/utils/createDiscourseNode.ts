import { render as renderToast } from "roamjs-components/components/Toast";
import createBlock from "roamjs-components/writes/createBlock";
import stripUid from "roamjs-components/util/stripUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import createPage from "roamjs-components/writes/createPage";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import { DiscourseNode } from "./getDiscourseNodes";
import isFlagEnabled from "./isFlagEnabled";

type Props = {
  text: string;
  configPageUid: string;
  newPageUid?: string;
  discourseNodes: DiscourseNode[];
};

const createDiscourseNode = async ({
  text,
  configPageUid,
  newPageUid,
  discourseNodes,
}: Props) => {
  const handleOpenInSidebar = (uid: string) => {
    if (!isFlagEnabled("open in sidebar")) return;
    openBlockInSidebar(uid);
    setTimeout(() => {
      const sidebarTitle = document.querySelector(
        ".rm-sidebar-outline .rm-title-display"
      );
      sidebarTitle?.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true })
      );
      setTimeout(() => {
        const ta = document.activeElement as HTMLTextAreaElement;
        if (ta.tagName === "TEXTAREA") {
          const index = ta.value.length;
          ta.setSelectionRange(index, index);
        }
      }, 1);
    }, 100);
  };

  const specification = discourseNodes?.find(
    (n) => n.type === configPageUid
  )?.specification;
  // This handles blck-type and creates block in the DNP
  // but could have unintended consequences for other defined discourse nodes
  if (
    specification?.find(
      (spec) => spec.type === "clause" && spec.relation === "is in page"
    )
  ) {
    const blockUid = await createBlock({
      // TODO: for canvas, create in `Auto generated from ${title}`
      parentUid: window.roamAlphaAPI.util.dateToPageUid(new Date()),
      node: { text, uid: newPageUid },
    });
    handleOpenInSidebar(blockUid);
    return blockUid;
  }

  let pageUid: string;
  if (newPageUid) {
    await createPage({ title: text, uid: newPageUid });
    pageUid = newPageUid;
  } else {
    pageUid =
      getPageUidByPageTitle(text) || (await createPage({ title: text }));
  }

  const nodeTree = getFullTreeByParentUid(configPageUid).children;
  const templateNode = getSubTree({
    tree: nodeTree,
    key: "template",
  });

  const createBlocksFromTemplate = async () => {
    await Promise.all(
      stripUid(templateNode.children).map(({ uid, ...node }, order) =>
        createBlock({
          node,
          order,
          parentUid: pageUid,
        })
      )
    );
  };

  const useSmartBlocks =
    templateNode.children.filter((obj) => obj.text.includes("<%")).length > 0;

  if (useSmartBlocks && !window.roamjs?.extension?.smartblocks) {
    renderToast({
      content:
        "This template requires SmartBlocks. Enable SmartBlocks in Roam Depot to use this template.",
      id: "smartblocks-extension-disabled",
      intent: "warning",
    });
    await createBlocksFromTemplate();
  } else if (useSmartBlocks && window.roamjs?.extension?.smartblocks) {
    window.roamjs.extension.smartblocks?.triggerSmartblock({
      srcUid: templateNode.uid,
      targetUid: pageUid,
    });
  } else {
    await createBlocksFromTemplate();
  }
  handleOpenInSidebar(pageUid);
  return pageUid;
};

export default createDiscourseNode;
