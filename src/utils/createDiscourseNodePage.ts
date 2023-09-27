import { render as renderToast } from "roamjs-components/components/Toast";
import createBlock from "roamjs-components/writes/createBlock";
// import stripUid from "roamjs-components/util/stripUid"
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import createPage from "roamjs-components/writes/createPage";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";

// temp
import { InputTextNode, RoamBasicNode } from "roamjs-components/types";
const stripUid = (n: RoamBasicNode[]): InputTextNode[] => {
  return n.map(({ uid: _uid, children, ...c }) => ({
    ...c,
    children: stripUid(children),
  }));
};

type Props = {
  pageName: string;
  configPageUid: string;
  newPageUid?: string;
  openInSidebar?: boolean;
};

const createDiscourseNodePage = async ({
  pageName,
  configPageUid,
  newPageUid,
  openInSidebar = false,
}: Props) => {
  let pageUid: string;
  if (newPageUid) {
    await createPage({ title: pageName, uid: newPageUid });
    pageUid = newPageUid;
  } else {
    pageUid =
      getPageUidByPageTitle(pageName) ||
      (await createPage({ title: pageName }));
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

  if (openInSidebar) {
    openBlockInSidebar(pageUid);
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
  }

  return pageUid;
};

export default createDiscourseNodePage;
