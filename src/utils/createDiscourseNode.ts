import { render as renderToast } from "roamjs-components/components/Toast";
import createBlock from "roamjs-components/writes/createBlock";
import stripUid from "roamjs-components/util/stripUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import createPage from "roamjs-components/writes/createPage";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import getDiscourseNodes from "./getDiscourseNodes";
import isFlagEnabled from "./isFlagEnabled";
import resolveQueryBuilderRef from "./resolveQueryBuilderRef";
import { OnloadArgs } from "roamjs-components/types";
import runQuery from "./runQuery";
import updateBlock from "roamjs-components/writes/updateBlock";

type Props = {
  text: string;
  configPageUid: string;
  newPageUid?: string;
  imageUrl?: string;
  extensionAPI?: OnloadArgs["extensionAPI"];
};

const createDiscourseNode = async ({
  text,
  configPageUid,
  newPageUid,
  imageUrl,
  extensionAPI,
}: Props) => {
  const handleOpenInSidebar = (uid: string) => {
    if (isFlagEnabled("disable sidebar open")) return;
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

  const discourseNodes = getDiscourseNodes();
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

    // Add image to page if imageUrl is provided
    const createOrUpdateImageBlock = async (imagePlaceholderUid?: string) => {
      const imageMarkdown = `![](${imageUrl})`;
      if (imagePlaceholderUid) {
        await updateBlock({
          uid: imagePlaceholderUid,
          text: imageMarkdown,
        });
      } else {
        await createBlock({
          node: { text: imageMarkdown },
          order: 0,
          parentUid: pageUid,
        });
      }
    };
    const canvasSettings = Object.fromEntries(
      discourseNodes.map((n) => [n.type, { ...n.canvasSettings }])
    );
    const {
      "query-builder-alias": qbAlias = "",
      "key-image": isKeyImage = "",
      "key-image-option": keyImageOption = "",
    } = canvasSettings[configPageUid] || {};

    if (isKeyImage && imageUrl) {
      if (keyImageOption === "query-builder") {
        if (!extensionAPI) return;

        const parentUid = resolveQueryBuilderRef({
          queryRef: qbAlias,
          extensionAPI,
        });
        const results = await runQuery({
          extensionAPI,
          parentUid,
          inputs: { NODETEXT: text, NODEUID: pageUid },
        });
        const imagePlaceholderUid = results.allProcessedResults[0]?.uid;
        await createOrUpdateImageBlock(imagePlaceholderUid);
      } else if (imageUrl) {
        await createOrUpdateImageBlock();
      }
    }
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
