import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import { OnloadArgs, TreeNode } from "roamjs-components/types";
import {
  DEFAULT_STYLE_PROPS,
  MAX_WIDTH,
  loadImage,
} from "../components/TldrawCanvas";
import { measureCanvasNodeText } from "./measureCanvasNodeText";
import resolveQueryBuilderRef from "./resolveQueryBuilderRef";
import runQuery from "./runQuery";
import getDiscourseNodes from "./getDiscourseNodes";

const extractFirstImageUrl = (text: string): string | null => {
  const regex = /!\[.*?\]\((https:\/\/[^)]+)\)/;
  const result = text.match(regex);
  return result ? result[1] : null;
};

const getFirstImageByUid = (uid: string): string | null => {
  const tree = getFullTreeByParentUid(uid);

  const findFirstImage = (node: TreeNode): string | null => {
    const imageUrl = extractFirstImageUrl(node.text);
    if (imageUrl) return imageUrl;

    if (node.children) {
      for (const child of node.children) {
        const childImageUrl = findFirstImage(child);
        if (childImageUrl) return childImageUrl;
      }
    }

    return null;
  };

  return findFirstImage(tree);
};

const calcCanvasNodeSizeAndImg = async ({
  text,
  uid,
  nodeType,
  extensionAPI,
}: {
  text: string;
  uid: string;
  nodeType: string;
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const allNodes = getDiscourseNodes();
  const canvasSettings = Object.fromEntries(
    allNodes.map((n) => [n.type, { ...n.canvasSettings }])
  );
  const {
    "query-builder-alias": qbAlias = "",
    "key-image": isKeyImage = "",
    "key-image-option": keyImageOption = "",
  } = canvasSettings[nodeType] || {};

  const { w, h } = measureCanvasNodeText({
    ...DEFAULT_STYLE_PROPS,
    maxWidth: MAX_WIDTH,
    text,
  });

  if (!isKeyImage) return { w, h, imageUrl: "" };

  let imageUrl;
  if (keyImageOption === "query-builder") {
    const parentUid = resolveQueryBuilderRef({
      queryRef: qbAlias,
      extensionAPI,
    });
    const results = await runQuery({
      extensionAPI,
      parentUid,
      inputs: { NODETEXT: text, NODEUID: uid },
    });
    const result = results.allProcessedResults[0]?.text || "";
    imageUrl = extractFirstImageUrl(result);
  } else {
    imageUrl = getFirstImageByUid(uid);
  }

  const padding = Number(DEFAULT_STYLE_PROPS.padding.replace("px", ""));
  const maxWidth = Number(MAX_WIDTH.replace("px", ""));
  const effectiveWidth = maxWidth - 2 * padding;

  try {
    if (!imageUrl) throw new Error("No Image URL");

    const { width, height } = await loadImage(imageUrl);

    const aspectRatio = width / height;
    const nodeImageHeight = effectiveWidth / aspectRatio;

    return {
      w,
      h: h + nodeImageHeight + padding * 2,
      imageUrl,
    };
  } catch {
    return { w, h, imageUrl: "" };
  }
};

export default calcCanvasNodeSizeAndImg;
