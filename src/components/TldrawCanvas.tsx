import React, { useRef, useState, useMemo, useEffect } from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import isFlagEnabled from "../utils/isFlagEnabled";
import {
  App as TldrawApp,
  defineShape,
  TLInstance,
  TLUser,
  TldrawEditorConfig,
  Canvas,
  TldrawEditor,
  ContextMenu,
  TldrawUi,
  TLBaseShape,
  TLOpacityType,
  TLBoxUtil,
  HTMLContainer,
  TLBoxTool,
  TLArrowTool,
  TLSelectTool,
  DraggingHandle,
  toolbarItem,
  MenuGroup,
  menuItem,
  TLTranslationKey,
  TL_COLOR_TYPES,
  StateNodeConstructor,
  TLArrowUtil,
  TLArrowShapeProps,
  Vec2dModel,
  createShapeId,
  TLStore,
  SubMenu,
  TLPointerEvent,
  TLRecord,
  TLImageShape,
  TLTextShape,
  TEXT_PROPS,
  FONT_SIZES,
  FONT_FAMILIES,
  MenuItem,
  TLShape,
  isShape,
  TLArrowTerminal,
  TLShapeId,
  Translating,
} from "@tldraw/tldraw";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import "@tldraw/tldraw/editor.css";
import "@tldraw/tldraw/ui.css";
import getSubTree from "roamjs-components/util/getSubTree";
import {
  AddPullWatch,
  InputTextNode,
  OnloadArgs,
} from "roamjs-components/types";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import createPage from "roamjs-components/writes/createPage";
import getDiscourseNodes, { DiscourseNode } from "../utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "../utils/getDiscourseRelations";
import { useValue } from "signia-react";
import findDiscourseNode from "../utils/findDiscourseNode";
import getBlockProps, { json, normalizeProps } from "../utils/getBlockProps";
import updateBlock from "roamjs-components/writes/updateBlock";
import renderToast from "roamjs-components/components/Toast";
import triplesToBlocks from "../utils/triplesToBlocks";
import getDiscourseContextResults from "../utils/getDiscourseContextResults";
import { StoreSnapshot } from "@tldraw/tlstore";
import setInputSetting from "roamjs-components/util/setInputSetting";
import ContrastColor from "contrast-color";
import nanoid from "nanoid";
import createDiscourseNode from "../utils/createDiscourseNode";
import LabelDialog from "./TldrawCanvasLabelDialog";
import { measureCanvasNodeText } from "../utils/measureCanvasNodeText";
import ExtensionApiContextProvider, {
  useExtensionAPI,
} from "roamjs-components/components/ExtensionApiContext";
import calcCanvasNodeSizeAndImg from "../utils/calcCanvasNodeSizeAndImg";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { formatHexColor } from "./DiscourseNodeCanvasSettings";
import { getNewDiscourseNodeText } from "../utils/formatUtils";

declare global {
  interface Window {
    tldrawApps: Record<string, TldrawApp>;
  }
}

type Props = {
  title: string;
  previewEnabled: boolean;
};

const THROTTLE = 350;
const isPageUid = (uid: string) =>
  !!window.roamAlphaAPI.pull("[:node/title]", [":block/uid", uid])?.[
    ":node/title"
  ];

export type DiscourseContextType = {
  // { [Node.id] => DiscourseNode }
  nodes: Record<string, DiscourseNode & { index: number }>;
  // { [Relation.Label] => DiscourseRelation[] }
  relations: Record<string, DiscourseRelation[]>;
  lastAppEvent: string;
};

const discourseContext: DiscourseContextType = {
  nodes: {},
  relations: {},
  lastAppEvent: "",
};

const getRelationIds = () =>
  new Set(
    Object.values(discourseContext.relations).flatMap((rs) =>
      rs.map((r) => r.id)
    )
  );

const diffObjects = (
  oldRecord: Record<string, any>,
  newRecord: Record<string, any>
): Record<string, any> => {
  const allKeys = Array.from(
    new Set(Object.keys(oldRecord).concat(Object.keys(newRecord)))
  );
  return Object.fromEntries(
    allKeys
      .map((key) => {
        const oldValue = oldRecord[key];
        const newValue = newRecord[key];
        if (typeof oldValue !== typeof newValue) {
          return [key, newValue];
        }
        if (
          typeof oldValue === "object" &&
          oldValue !== null &&
          newValue !== null
        ) {
          const diffed = diffObjects(oldValue, newValue);
          if (Object.keys(diffed).length) {
            return [key, diffed];
          }
          return null;
        }
        if (oldValue !== newValue) {
          return [key, newValue];
        }
        return null;
      })
      .filter((e): e is [string, any] => !!e)
  );
};

const personalRecordTypes = new Set([
  "camera",
  "instance",
  "instance_page_state",
]);
const pruneState = (state: StoreSnapshot<TLRecord>) =>
  Object.fromEntries(
    Object.entries(state).filter(
      ([_, record]) => !personalRecordTypes.has(record.typeName)
    )
  );

const calculateDiff = (
  _newState: StoreSnapshot<TLRecord>,
  _oldState: StoreSnapshot<TLRecord>
) => {
  const newState = pruneState(_newState);
  const oldState = pruneState(_oldState);
  return {
    added: Object.fromEntries(
      Object.keys(newState)
        .filter((id) => !oldState[id])
        .map((id) => [id, newState[id]])
    ),
    removed: Object.fromEntries(
      Object.keys(oldState)
        .filter((id) => !newState[id])
        .map((key) => [key, oldState[key]])
    ),
    updated: Object.fromEntries(
      Object.keys(newState)
        .map((id) => {
          const oldRecord = oldState[id];
          const newRecord = newState[id];
          if (!oldRecord || !newRecord) {
            return null;
          }

          const diffed = diffObjects(oldRecord, newRecord);
          if (Object.keys(diffed).length) {
            return [id, [oldRecord, newRecord]];
          }
          return null;
        })
        .filter((e): e is [string, any] => !!e)
    ),
  };
};

export type DiscourseNodeShape = TLBaseShape<
  string,
  {
    w: number;
    h: number;
    opacity: TLOpacityType;
    uid: string;
    title: string;
    imageUrl?: string;
  }
>;

type DiscourseRelationShape = TLBaseShape<string, TLArrowShapeProps>;

// from @tldraw/editor/editor.css
const COLOR_PALETTE: Record<string, string> = {
  black: "#1d1d1d",
  blue: "#4263eb",
  green: "#099268",
  grey: "#adb5bd",
  "light-blue": "#4dabf7",
  "light-green": "#40c057",
  "light-red": "#ff8787",
  "light-violet": "#e599f7",
  orange: "#f76707",
  red: "#e03131",
  violet: "#ae3ec9",
  white: "#ffffff",
  yellow: "#ffc078",
};
const COLOR_ARRAY = Array.from(TL_COLOR_TYPES).reverse();
const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 64;
export const MAX_WIDTH = "400px";

// FONT_FAMILIES.sans or tldraw_sans not working in toSvg()
// maybe check getSvg()
// in node_modules\@tldraw\tldraw\node_modules\@tldraw\editor\dist\cjs\lib\app\App.js
const SVG_FONT_FAMILY = "sans-serif";

export const DEFAULT_STYLE_PROPS = {
  ...TEXT_PROPS,
  fontSize: FONT_SIZES.m,
  fontFamily: FONT_FAMILIES.sans,
  width: "fit-content",
  padding: "40px",
};

export const loadImage = (
  url: string
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    setTimeout(() => {
      reject(new Error("Image load timeout"));
    }, 3000);

    img.src = url;
  });
};
class DiscourseNodeUtil extends TLBoxUtil<DiscourseNodeShape> {
  constructor(app: TldrawApp, type: string) {
    super(app, type);
  }

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;
  override canEdit = () => true;

  override defaultProps(): DiscourseNodeShape["props"] {
    return {
      opacity: "1" as DiscourseNodeShape["props"]["opacity"],
      w: 160,
      h: 64,
      uid: window.roamAlphaAPI.util.generateUID(),
      title: "",
    };
  }

  deleteRelationsInCanvas(
    shape: DiscourseNodeShape,
    {
      allRecords = this.app.store.allRecords(),
      relationIds = getRelationIds(),
    }: { allRecords?: TLRecord[]; relationIds?: Set<string> } = {}
  ) {
    const toDelete = allRecords
      .filter((r): r is DiscourseRelationShape => {
        return r.typeName === "shape" && relationIds.has(r.type);
      })
      .filter((r) => {
        const { start, end } = r.props;
        return (
          (start.type === "binding" && start.boundShapeId === shape.id) ||
          (end.type === "binding" && end.boundShapeId === shape.id)
        );
      });
    this.app.deleteShapes(toDelete.map((r) => r.id));
  }

  async createExistingRelations(
    shape: DiscourseNodeShape,
    {
      allRecords = this.app.store.allRecords(),
      relationIds = getRelationIds(),
      finalUid = shape.props.uid,
    }: {
      allRecords?: TLRecord[];
      relationIds?: Set<string>;
      finalUid?: string;
    } = {}
  ) {
    const isDiscourseRelationShape = (
      shape: TLShape
    ): shape is DiscourseRelationShape => {
      return relationIds.has(shape.type);
    };
    const nodes = Object.values(discourseContext.nodes);
    const nodeIds = new Set(nodes.map((n) => n.type));
    const nodesInCanvas = Object.fromEntries(
      allRecords
        .filter((r): r is DiscourseNodeShape => {
          return r.typeName === "shape" && nodeIds.has(r.type);
        })
        .map((r) => [r.props.uid, r] as const)
    );
    const currentShapeRelations = allRecords
      .filter(isShape)
      .filter(isDiscourseRelationShape)
      .filter((r) => {
        const { start, end } = r.props;
        return (
          (start.type === "binding" && start.boundShapeId === shape.id) ||
          (end.type === "binding" && end.boundShapeId === shape.id)
        );
      });

    const results = await getDiscourseContextResults({
      uid: finalUid,
      nodes: Object.values(discourseContext.nodes),
      relations: Object.values(discourseContext.relations).flat(),
    });

    const toCreate = results
      .flatMap((r) =>
        Object.entries(r.results)
          .filter(([k, v]) => nodesInCanvas[k] && v.id && relationIds.has(v.id))
          .map(([k, v]) => ({
            relationId: v.id!,
            complement: v.complement,
            nodeId: k,
          }))
      )
      .filter(({ relationId, complement, nodeId }) => {
        const startId = complement ? nodesInCanvas[nodeId].id : shape.id;
        const endId = complement ? shape.id : nodesInCanvas[nodeId].id;
        const relationAlreadyExists = currentShapeRelations.some(
          (r) =>
            r.type === relationId &&
            r.props.start.type === "binding" &&
            r.props.end.type === "binding" &&
            r.props.start.boundShapeId === startId &&
            r.props.end.boundShapeId === endId
        );
        return !relationAlreadyExists;
      })
      .map(({ relationId, complement, nodeId }) => {
        return {
          id: createShapeId(),
          type: relationId,
          props: complement
            ? {
                start: {
                  type: "binding",
                  boundShapeId: nodesInCanvas[nodeId].id,
                  normalizedAnchor: { x: 0.5, y: 0.5 },
                  isExact: false,
                },
                end: {
                  type: "binding",
                  boundShapeId: shape.id,
                  normalizedAnchor: { x: 0.5, y: 0.5 },
                  isExact: false,
                },
              }
            : {
                start: {
                  type: "binding",
                  boundShapeId: shape.id,
                  normalizedAnchor: { x: 0.5, y: 0.5 },
                  isExact: false,
                },
                end: {
                  type: "binding",
                  boundShapeId: nodesInCanvas[nodeId].id,
                  normalizedAnchor: { x: 0.5, y: 0.5 },
                  isExact: false,
                },
              },
        };
      });
    this.app.createShapes(toCreate);
  }

  override onBeforeCreate = (shape: DiscourseNodeShape) => {
    if (discourseContext.lastAppEvent === "pointer_down") {
      setTimeout(() =>
        document.body.dispatchEvent(
          new CustomEvent("roamjs:query-builder:created-canvas-node", {
            detail: shape.id,
          })
        )
      );
    }
  };

  onBeforeDelete(shape: DiscourseNodeShape) {
    this.deleteRelationsInCanvas(shape);
  }

  onAfterCreate(shape: DiscourseNodeShape) {
    if (shape.props.title && shape.props.uid)
      this.createExistingRelations(shape);
  }

  getColors() {
    const {
      canvasSettings: { color: backgroundColor = "" } = {},
      index: discourseNodeIndex = -1,
    } = discourseContext.nodes[this.type] || {};
    const paletteColor =
      COLOR_ARRAY[
        discourseNodeIndex >= 0 && discourseNodeIndex < COLOR_ARRAY.length - 1
          ? discourseNodeIndex
          : 0
      ];
    const formattedBackgroundColor =
      backgroundColor && !backgroundColor.startsWith("#")
        ? `#${backgroundColor}`
        : backgroundColor;

    const backgroundInfo = formattedBackgroundColor
      ? {
          backgroundColor: formattedBackgroundColor,
          backgroundCss: formattedBackgroundColor,
        }
      : {
          backgroundColor: COLOR_PALETTE[paletteColor],
          backgroundCss: `var(--palette-${paletteColor})`,
        };
    const textColor = ContrastColor.contrastColor({
      bgColor: backgroundInfo.backgroundColor,
    });
    return { ...backgroundInfo, textColor };
  }

  render(shape: DiscourseNodeShape) {
    const extensionAPI = useExtensionAPI();
    const {
      canvasSettings: { alias = "", "key-image": isKeyImage = "" } = {},
    } = discourseContext.nodes[this.type] || {};
    const isEditing = useValue(
      "isEditing",
      () => this.app.editingId === shape.id,
      [this.app, shape.id]
    );
    const [isLabelEditOpen, setIsEditLabelOpen] = useState(false);
    useEffect(() => {
      if (isEditing) setIsEditLabelOpen(true);
    }, [isEditing, setIsEditLabelOpen]);
    const contentRef = useRef<HTMLDivElement>(null);
    const [loaded, setLoaded] = useState("");
    useEffect(() => {
      if (
        shape.props.uid !== loaded &&
        !isPageUid(shape.props.uid) &&
        contentRef.current &&
        isLiveBlock(shape.props.uid)
      ) {
        window.roamAlphaAPI.ui.components.renderBlock({
          el: contentRef.current,
          uid: shape.props.uid,
        });
        // TODO: resize shape props once this is rendered
        setLoaded(shape.props.uid);
      }
    }, [setLoaded, loaded, contentRef, shape.props.uid]);
    useEffect(() => {
      const listener = (e: CustomEvent) => {
        if (e.detail === shape.id) {
          setIsEditLabelOpen(true);
          this.app.setEditingId(shape.id);
        }
      };
      document.body.addEventListener(
        "roamjs:query-builder:created-canvas-node",
        listener as EventListener
      );
      return () => {
        document.body.removeEventListener(
          "roamjs:query-builder:created-canvas-node",
          listener as EventListener
        );
      };
    }, [setIsEditLabelOpen]);

    const { backgroundCss, textColor } = this.getColors();

    const setSizeAndImgProps = async ({
      context,
      text,
      uid,
    }: {
      context: DiscourseNodeUtil;
      text: string;
      uid: string;
    }) => {
      if (!extensionAPI) return;
      const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
        nodeText: text,
        uid,
        nodeType: this.type,
        extensionAPI,
      });
      context.updateProps(shape.id, {
        h,
        w,
        imageUrl,
      });
    };

    return (
      <HTMLContainer
        id={shape.id}
        className="flex items-center justify-center pointer-events-auto rounded-2xl roamjs-tldraw-node overflow-hidden"
        style={{
          background: backgroundCss,
          color: textColor,
        }}
      >
        <div style={{ pointerEvents: "all" }}>
          {shape.props.imageUrl && isKeyImage ? (
            <img
              src={shape.props.imageUrl}
              className="w-full object-cover h-auto"
              draggable="false"
              style={{ pointerEvents: "none" }}
            />
          ) : null}

          <div
            ref={contentRef}
            style={{ ...DEFAULT_STYLE_PROPS, maxWidth: "" }}
          >
            {alias
              ? new RegExp(alias).exec(shape.props.title)?.[1] ||
                shape.props.title
              : shape.props.title}
          </div>
          <LabelDialog
            initialUid={shape.props.uid}
            isOpen={isLabelEditOpen}
            onClose={() => {
              this.app.setEditingId(null);
              setIsEditLabelOpen(false);
            }}
            isExistingCanvasNode={!!shape.props.title}
            nodeType={this.type}
            discourseContext={discourseContext}
            onSuccess={async ({ text, uid, action }) => {
              if (action === "editing") {
                if (isPageUid(shape.props.uid))
                  await window.roamAlphaAPI.updatePage({
                    page: {
                      uid: shape.props.uid,
                      title: text,
                    },
                  });
                else await updateBlock({ uid: shape.props.uid, text });
              }

              if (action === "creating" && !getPageUidByPageTitle(text)) {
                createDiscourseNode({
                  configPageUid: shape.type,
                  text,
                  newPageUid: uid,
                });
              }

              // Update Shape Props
              setSizeAndImgProps({ context: this, text, uid });
              this.updateProps(shape.id, {
                title: text,
                uid,
              });

              // Update Shape Relations
              const allRecords = this.app.store.allRecords();
              const relationIds = getRelationIds();
              this.deleteRelationsInCanvas(shape, {
                allRecords,
                relationIds,
              });
              await this.createExistingRelations(shape, {
                allRecords,
                relationIds,
                finalUid: uid,
              });

              setIsEditLabelOpen(false);
              this.app.setEditingId(null);
            }}
            onCancel={() => {
              this.app.setEditingId(null);
              setIsEditLabelOpen(false);
              if (!isLiveBlock(shape.props.uid)) {
                this.app.deleteShapes([shape.id]);
              }
            }}
          />
        </div>
      </HTMLContainer>
    );
  }

  async toSvg(shape: DiscourseNodeShape) {
    const { backgroundColor, textColor } = this.getColors();
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    // Create and set attributes for the rectangle (background of the shape)
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", shape.props.w.toString());
    rect.setAttribute("height", shape.props.h.toString());
    rect.setAttribute("fill", backgroundColor);
    rect.setAttribute("opacity", shape.props.opacity);
    rect.setAttribute("rx", "16");
    rect.setAttribute("ry", "16");
    g.appendChild(rect);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");

    // Calculate text dimensions and positioning
    const padding = Number(DEFAULT_STYLE_PROPS.padding.replace("px", ""));
    const textWidth = measureCanvasNodeText({
      ...DEFAULT_STYLE_PROPS,
      maxWidth: shape.props.w - padding * 2 + "px",
      text: shape.props.title,
    }).w;

    const textLines = this.app.textMeasure.getTextLines({
      fontFamily: DEFAULT_STYLE_PROPS.fontFamily,
      fontSize: DEFAULT_STYLE_PROPS.fontSize,
      fontStyle: DEFAULT_STYLE_PROPS.fontStyle,
      fontWeight: DEFAULT_STYLE_PROPS.fontWeight,
      lineHeight: DEFAULT_STYLE_PROPS.lineHeight,
      height: shape.props.h,
      text: shape.props.title,
      padding: 0,
      textAlign: "start",
      width: textWidth,
      wrap: true,
    });

    // set attributes for the text
    text.setAttribute("font-family", SVG_FONT_FAMILY);
    text.setAttribute("font-size", DEFAULT_STYLE_PROPS.fontSize + "px");
    text.setAttribute("font-weight", DEFAULT_STYLE_PROPS.fontWeight);
    text.setAttribute("fill", textColor);
    text.setAttribute("stroke", "none");

    const textX = (shape.props.w - textWidth) / 2;
    const lineHeight =
      DEFAULT_STYLE_PROPS.lineHeight * DEFAULT_STYLE_PROPS.fontSize;

    // Loop through words and add them to lines, wrapping as needed
    textLines.forEach((line, index) => {
      const tspan = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "tspan"
      );
      tspan.setAttribute("x", textX.toString());
      tspan.setAttribute("dy", (index === 0 ? 0 : lineHeight).toString());
      tspan.textContent = line;
      text.appendChild(tspan);
    });

    // Add image to the node if imageUrl exists

    // https://github.com/tldraw/tldraw/blob/8a1b014b02a1960d1e6dde63722f9f221a33e10c/packages/tldraw/src/lib/shapes/image/ImageShapeUtil.tsx#L44
    async function getDataURIFromURL(url: string): Promise<string> {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    if (shape.props.imageUrl) {
      const image = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "image"
      );
      const src = (await getDataURIFromURL(shape.props.imageUrl)) || "";
      image.setAttribute("href", src);
      image.setAttribute("width", shape.props.w.toString());

      // Calculate height based on aspect ratio like in the HTML
      const { width: imageWidth, height: imageHeight } = await loadImage(src);
      const aspectRatio = imageWidth / imageHeight || 1;
      const svgImageHeight = shape.props.w / aspectRatio;

      // TODO - allow for cropped images (css overflow-hidden)
      image.setAttribute("height", svgImageHeight.toString());

      // Adjust text y attribute to be positioned below the image
      const textYOffset =
        svgImageHeight +
        (shape.props.h - svgImageHeight) / 2 -
        (lineHeight * textLines.length) / 2;
      text.setAttribute("y", textYOffset.toString());

      g.appendChild(image);
    } else {
      // Position the text vertically in the center of the shape
      const textY =
        (shape.props.h - lineHeight * textLines.length) / 2 + padding / 2;
      text.setAttribute("y", textY.toString());
    }

    g.appendChild(text);

    return g;
  }

  indicator(shape: DiscourseNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  updateProps(
    id: DiscourseNodeShape["id"],
    props: Partial<DiscourseNodeShape["props"]>
  ) {
    // @ts-ignore
    this.app.updateShapes([{ id, props }]);
  }
}

// Helper to add referenced nodes to node titles
// EG: [[EVD]] - {content} - {Source}
// {Source} is a referenced node
type DiscourseReferencedNodeShape = TLBaseShape<string, TLArrowShapeProps>;
class DiscourseReferencedNodeUtil extends TLArrowUtil<DiscourseReferencedNodeShape> {
  constructor(app: TldrawApp, type: string) {
    super(app, type);
  }
  override canBind = () => true;
  override canEdit = () => false;
  defaultProps() {
    return {
      opacity: "1" as const,
      dash: "draw" as const,
      size: "s" as const,
      fill: "none" as const,
      color: COLOR_ARRAY[0],
      labelColor: COLOR_ARRAY[1],
      bend: 0,
      start: { type: "point" as const, x: 0, y: 0 },
      end: { type: "point" as const, x: 0, y: 0 },
      arrowheadStart: "none" as const,
      arrowheadEnd: "arrow" as const,
      text: "for",
      font: "mono" as const,
    };
  }
  render(shape: DiscourseReferencedNodeShape) {
    return (
      <>
        <style>{`#${shape.id.replace(":", "_")}_clip_0 {
  display: none;
}
[data-shape-type="${this.type}"] .rs-arrow-label {
  left: 0;
  top: 0;
  width: unset;
  height: unset;
}
`}</style>
        {super.render(shape)}
      </>
    );
  }
}
class DiscourseRelationUtil extends TLArrowUtil<DiscourseRelationShape> {
  constructor(app: TldrawApp, type: string) {
    super(app, type);
  }
  override canBind = () => true;
  override canEdit = () => false;
  defaultProps() {
    const relations = Object.values(discourseContext.relations);
    // TODO - add canvas settings to relations config
    const relationIndex = relations.findIndex((rs) =>
      rs.some((r) => r.id === this.type)
    );
    const isValid = relationIndex >= 0 && relationIndex < relations.length;
    const color = isValid ? COLOR_ARRAY[relationIndex + 1] : COLOR_ARRAY[0];
    return {
      opacity: "1" as const,
      dash: "draw" as const,
      size: "s" as const,
      fill: "none" as const,
      color,
      labelColor: color,
      bend: 0,
      start: { type: "point" as const, x: 0, y: 0 },
      end: { type: "point" as const, x: 0, y: 0 },
      arrowheadStart: "none" as const,
      arrowheadEnd: "arrow" as const,
      text: isValid
        ? Object.keys(discourseContext.relations)[relationIndex]
        : "",
      font: "mono" as const,
    };
  }
  override onBeforeCreate = (shape: DiscourseRelationShape) => {
    // TODO - propsForNextShape is clobbering our choice of color
    const relations = Object.values(discourseContext.relations);
    const relationIndex = relations.findIndex((rs) =>
      rs.some((r) => r.id === this.type)
    );
    const isValid = relationIndex >= 0 && relationIndex < relations.length;
    const color = isValid ? COLOR_ARRAY[relationIndex + 1] : COLOR_ARRAY[0];
    return {
      ...shape,
      props: {
        ...shape.props,
        color,
        labelColor: color,
      },
    };
  };
  render(shape: DiscourseRelationShape) {
    return (
      <>
        <style>{`#${shape.id.replace(":", "_")}_clip_0 {
  display: none;
}
[data-shape-type="${this.type}"] .rs-arrow-label {
  left: 0;
  top: 0;
  width: unset;
  height: unset;
}
`}</style>
        {super.render(shape)}
      </>
    );
  }
}

const TldrawCanvas = ({ title }: Props) => {
  const serializeRef = useRef(0);
  const deserializeRef = useRef(0);
  const allRelations = useMemo(() => {
    const relations = getDiscourseRelations();
    discourseContext.relations = relations.reduce((acc, r) => {
      if (acc[r.label]) {
        acc[r.label].push(r);
      } else {
        acc[r.label] = [r];
      }
      return acc;
    }, {} as Record<string, DiscourseRelation[]>);
    return relations;
  }, []);
  const allRelationsById = useMemo(() => {
    return Object.fromEntries(allRelations.map((r) => [r.id, r])) as Record<
      string,
      DiscourseRelation
    >;
  }, [allRelations]);
  const allRelationIds = useMemo(() => {
    return Object.keys(allRelationsById);
  }, [allRelationsById]);
  const allRelationNames = useMemo(() => {
    return Object.keys(discourseContext.relations);
  }, [allRelations]);
  const allNodes = useMemo(() => {
    const allNodes = getDiscourseNodes(allRelations);
    discourseContext.nodes = Object.fromEntries(
      allNodes.map((n, index) => [n.type, { ...n, index }])
    );
    return allNodes;
  }, [allRelations]);
  const isCustomArrowShape = (shape: TLShape) => {
    // TODO: find a better way to identify custom arrow shapes
    // shape.type or shape.name probably?
    const allRelationIdSet = new Set(allRelationIds);
    const allAddReferencedNodeActionsSet = new Set(allAddReferencedNodeActions);

    return (
      allRelationIdSet.has(shape.type) ||
      allAddReferencedNodeActionsSet.has(shape.type)
    );
  };

  type AddReferencedNodeType = Record<string, ReferenceFormatType[]>;

  type ReferenceFormatType = {
    format: string;
    sourceName: string;
    sourceType: string;
    destinationType: string;
    destinationName: string;
  };

  const allAddReferencedNodeByAction = useMemo(() => {
    const obj: AddReferencedNodeType = {};

    // TODO: support multiple referenced node
    // with migration from format to specification
    allNodes.forEach((n) => {
      const referencedNodes = [...n.format.matchAll(/{([\w\d-]+)}/g)].filter(
        (match) => match[1] !== "content"
      );

      if (referencedNodes.length > 0) {
        const sourceName = referencedNodes[0][1];
        const sourceType = allNodes.find((node) => node.text === sourceName)
          ?.type as string;

        if (!obj[`Add ${sourceName}`]) obj[`Add ${sourceName}`] = [];

        obj[`Add ${sourceName}`].push({
          format: n.format,
          sourceName,
          sourceType,
          destinationType: n.type,
          destinationName: n.text,
        });
      }
    });

    return obj;
  }, [allNodes]);
  const allAddReferencedNodeActions = useMemo(() => {
    return Object.keys(allAddReferencedNodeByAction);
  }, [allAddReferencedNodeByAction]);

  const extensionAPI = useExtensionAPI();

  const isBindingType = (
    binding: TLArrowTerminal
  ): binding is TLArrowTerminal & {
    boundShapeId: TLShapeId;
  } => {
    return binding.type === "binding" && !!binding.boundShapeId;
  };
  const hasValidBindings = (bindings: TLArrowTerminal[]) => {
    return bindings.every(isBindingType);
  };
  const compareBindings = (a: TLArrowTerminal, b: TLArrowTerminal) => {
    if (isBindingType(a) && isBindingType(b)) {
      return a.boundShapeId === b.boundShapeId;
    }
    return false;
  };
  type CancelAndWarnType = {
    content: string;
    shape: TLShape;
    context: Translating | DraggingHandle;
  };
  const cancelAndWarn = ({ content, shape, context }: CancelAndWarnType) => {
    renderToast({
      id: "tldraw-warning",
      intent: "warning",
      content,
    });
    context.app.updateShapes([
      {
        id: shape.id,
        type: shape.type,
        props: {
          ...context.info.shape.props,
        },
      },
    ]);
  };

  const customTldrawConfig = useMemo(
    () =>
      new TldrawEditorConfig({
        tools: allNodes
          .map(
            (n): StateNodeConstructor =>
              class extends TLBoxTool {
                static id = n.type;
                static initial = "idle";
                shapeType = n.type;
                override styles = ["opacity" as const];
              }
          )
          .concat(
            allRelationNames.map(
              (name) =>
                class extends TLArrowTool {
                  static id = name;
                  static initial = "idle";
                  static children: typeof TLArrowTool.children = () => {
                    const [Idle, Pointing] = TLArrowTool.children();
                    return [
                      class extends Idle {
                        override onPointerDown: TLPointerEvent = (info) => {
                          const cancelAndWarn = (content: string) => {
                            renderToast({
                              id: "tldraw-warning",
                              intent: "warning",
                              content,
                            });
                            this.onCancel();
                          };
                          if (info.target !== "shape") {
                            return cancelAndWarn("Must start on a node.");
                          }
                          const relation = discourseContext.relations[
                            name
                          ].find((r) => r.source === info.shape.type);
                          if (!relation) {
                            return cancelAndWarn(
                              `Starting node must be one of ${discourseContext.relations[
                                name
                              ]
                                .map(
                                  (r) => discourseContext.nodes[r.source].text
                                )
                                .join(", ")}`
                            );
                          } else {
                            (this.parent as TLArrowTool).shapeType =
                              relation.id;
                          }
                          this.parent.transition("pointing", info);
                        };
                      },
                      Pointing,
                    ];
                  };
                  shapeType = name;
                  override styles = ["opacity" as const];
                }
            )
          )
          .concat(
            Object.keys(allAddReferencedNodeByAction).map(
              (action) =>
                class extends TLArrowTool {
                  static id = `${action}` as string;
                  static initial = "idle";
                  static children: typeof TLArrowTool.children = () => {
                    const [Idle, Pointing] = TLArrowTool.children();
                    return [
                      class extends Idle {
                        override onPointerDown: TLPointerEvent = (info) => {
                          const cancelAndWarn = (content: string) => {
                            renderToast({
                              id: "tldraw-warning",
                              intent: "warning",
                              content,
                            });
                            this.onCancel();
                          };
                          if (info.target !== "shape") {
                            return cancelAndWarn("Must start on a node.");
                          }
                          const sourceType =
                            allAddReferencedNodeByAction[action][0].sourceType;
                          const sourceName =
                            allAddReferencedNodeByAction[action][0].sourceName;
                          if (info.shape.type !== sourceType) {
                            return cancelAndWarn(
                              `Starting node must be one of ${sourceName}`
                            );
                          } else {
                            (
                              this.parent as TLArrowTool
                            ).shapeType = `${action}`;
                          }
                          this.parent.transition("pointing", info);
                        };
                      },
                      Pointing,
                    ];
                  };
                  shapeType = `${action}`;
                  override styles = ["opacity" as const];
                }
            )
          )
          .concat([
            class extends TLSelectTool {
              // @ts-ignore
              static children: typeof TLSelectTool.children = () => {
                return TLSelectTool.children().map((c) => {
                  if (c.id === "translating") {
                    const Translate = c as unknown as typeof Translating;
                    return class extends Translate {
                      override onPointerUp: TLPointerEvent = () => {
                        this.onComplete({
                          type: "misc",
                          name: "complete",
                        });
                        const shape = this.app.getShapeById(
                          this.info.shape?.id // sometimes undefined?
                        );
                        if (!shape) return;
                        if (!isCustomArrowShape(shape)) return;

                        // Stop accidental arrow reposition
                        const { start, end } = shape.props as TLArrowShapeProps;
                        const { end: thisEnd, start: thisStart } = this.info
                          .shape.props as TLArrowShapeProps;
                        const hasPreviousBinding = hasValidBindings([
                          thisEnd,
                          thisStart,
                        ]);
                        const bindingsMatchPrevBindings =
                          compareBindings(thisEnd, end) &&
                          compareBindings(thisStart, start);
                        if (hasPreviousBinding && !bindingsMatchPrevBindings) {
                          return cancelAndWarn({
                            content: "Cannot move relation.",
                            shape,
                            context: this,
                          });
                        }
                      };
                    };
                  }

                  if (c.id === "dragging_handle") {
                    const Handle = c as unknown as typeof DraggingHandle;
                    const allRelationIdSet = new Set(allRelationIds);
                    const allAddReferencedNodeActionsSet = new Set(
                      allAddReferencedNodeActions
                    );
                    return class extends Handle {
                      override onPointerUp: TLPointerEvent = async () => {
                        this.onComplete({
                          type: "misc",
                          name: "complete",
                        });

                        const shape = this.app.getShapeById(this.shapeId);
                        if (!shape) return;
                        if (!isCustomArrowShape(shape)) return;
                        const arrow = shape;
                        const {
                          start,
                          end,
                          text: arrowText,
                        } = arrow.props as TLArrowShapeProps;

                        const deleteAndWarn = (content: string) => {
                          renderToast({
                            id: "tldraw-warning",
                            intent: "warning",
                            content,
                          });
                          this.app.deleteShapes([arrow.id]);
                        };

                        // Allow arrow bend
                        if (this.info.handle.id === "middle") return;

                        // Stop accidental handle removal
                        const { end: thisEnd, start: thisStart } =
                          this.info.shape.props;
                        const hasPreviousBindings = hasValidBindings([
                          thisEnd,
                          thisStart,
                        ]);
                        const bindingsMatchPrevBindings =
                          compareBindings(thisEnd, end) &&
                          compareBindings(thisStart, start);
                        if (hasPreviousBindings && !bindingsMatchPrevBindings) {
                          return cancelAndWarn({
                            content: "Cannot remove handle.",
                            shape,
                            context: this,
                          });
                        }

                        // Allow handles to be repositioned in same shape
                        if (hasPreviousBindings && bindingsMatchPrevBindings) {
                          return;
                        }

                        if (
                          start.type !== "binding" ||
                          end.type !== "binding"
                        ) {
                          return deleteAndWarn(
                            "Relation must connect two nodes."
                          );
                        }
                        const source = this.app.getShapeById(
                          start.boundShapeId
                        ) as DiscourseNodeShape;
                        if (!source) {
                          return deleteAndWarn("Failed to find source node.");
                        }
                        const target = this.app.getShapeById(
                          end.boundShapeId
                        ) as DiscourseNodeShape;
                        if (!target) {
                          return deleteAndWarn("Failed to find target node.");
                        }

                        // Handle "Add Referenced Node" Arrows
                        if (allAddReferencedNodeActionsSet.has(arrow.type)) {
                          const possibleTargets = allAddReferencedNodeByAction[
                            arrow.type
                          ].map((action) => action.destinationType);
                          if (!possibleTargets.includes(target.type)) {
                            return deleteAndWarn(
                              `Target node must be of type ${possibleTargets
                                .map((t) => discourseContext.nodes[t].text)
                                .join(", ")}`
                            );
                          }

                          // source and target are expected to be pages
                          // TODO: support blocks
                          const targetTitle = target.props.title;
                          const sourceTitle = source.props.title;
                          const isTargetTitleCurrent =
                            getPageTitleByPageUid(target.props.uid).trim() ===
                            targetTitle.trim();
                          const isSourceTitleCurrent =
                            getPageTitleByPageUid(source.props.uid).trim() ===
                            sourceTitle.trim();
                          if (!isTargetTitleCurrent || !isSourceTitleCurrent) {
                            return deleteAndWarn(
                              "Either the source or target node has been renamed. Please update the nodes and try again."
                            );
                          }

                          // Hack for default shipped EVD format: [[EVD]] - {content} - {Source},
                          // replace when migrating from format to specification
                          let newTitle: string;
                          if (targetTitle.endsWith(" - ")) {
                            newTitle = `${targetTitle}[[${sourceTitle}]]`;
                          } else if (targetTitle.endsWith(" -")) {
                            newTitle = `${targetTitle} [[${sourceTitle}]]`;
                          } else {
                            newTitle = `${targetTitle} - [[${sourceTitle}]]`;
                          }

                          if (!extensionAPI) {
                            return deleteAndWarn(
                              `Failed to update node title.`
                            );
                          }

                          await window.roamAlphaAPI.data.page.update({
                            page: {
                              uid: target.props.uid,
                              title: newTitle,
                            },
                          });
                          const { h, w, imageUrl } =
                            await calcCanvasNodeSizeAndImg({
                              nodeText: newTitle,
                              uid: target.props.uid,
                              nodeType: target.type,
                              extensionAPI,
                            });
                          this.app.updateShapes([
                            {
                              id: target.id,
                              type: target.type,
                              props: {
                                h,
                                w,
                                imageUrl,
                                title: newTitle,
                              },
                            },
                          ]);

                          renderToast({
                            id: "tldraw-success",
                            intent: "success",
                            content: `Updated node title.`,
                          });

                          return;
                        }

                        // Handle "Add Relationship Arrows"
                        if (allRelationIdSet.has(arrow.type)) {
                          const relation = allRelationsById[arrow.type];
                          if (!relation) return;
                          const sourceLabel =
                            discourseContext.nodes[relation.source].text;
                          if (source.type !== relation.source) {
                            return deleteAndWarn(
                              `Source node must be of type ${sourceLabel}`
                            );
                          }
                          const possibleTargets = discourseContext.relations[
                            relation.label
                          ]
                            .filter((r) => r.source === relation.source)
                            .map((r) => r.destination);
                          if (!possibleTargets.includes(target.type)) {
                            return deleteAndWarn(
                              `Target node must be of type ${possibleTargets
                                .map((t) => discourseContext.nodes[t].text)
                                .join(", ")}`
                            );
                          }
                          if (arrow.type !== target.type) {
                            this.app.updateShapes([
                              {
                                id: arrow.id,
                                type: target.type,
                              },
                            ]);
                          }
                          const {
                            triples,
                            label: relationLabel,
                            // complement,
                          } = relation;
                          const isOriginal = arrowText === relationLabel;
                          const newTriples = triples
                            .map((t) => {
                              if (/is a/i.test(t[1])) {
                                const targetNode =
                                  (t[2] === "source" && isOriginal) ||
                                  (t[2] === "destination" && !isOriginal)
                                    ? source
                                    : target;
                                const { title, uid } =
                                  targetNode.props as DiscourseNodeShape["props"];
                                return [
                                  t[0],
                                  isPageUid(uid) ? "has title" : "with uid",
                                  isPageUid(uid) ? title : uid,
                                ];
                              }
                              return t.slice(0);
                            })
                            .map(([source, relation, target]) => ({
                              source,
                              relation,
                              target,
                            }));
                          triplesToBlocks({
                            defaultPageTitle: `Auto generated from ${title}`,
                            toPage: async (
                              title: string,
                              blocks: InputTextNode[]
                            ) => {
                              const parentUid =
                                getPageUidByPageTitle(title) ||
                                (await createPage({
                                  title: title,
                                }));

                              await Promise.all(
                                blocks.map((node, order) =>
                                  createBlock({ node, order, parentUid }).catch(
                                    () =>
                                      console.error(
                                        `Failed to create block: ${JSON.stringify(
                                          { node, order, parentUid },
                                          null,
                                          4
                                        )}`
                                      )
                                  )
                                )
                              );
                              await openBlockInSidebar(parentUid);
                            },
                            nodeSpecificationsByLabel: Object.fromEntries(
                              Object.values(discourseContext.nodes).map((n) => [
                                n.text,
                                n.specification,
                              ])
                            ),
                          })(newTriples)();
                        }
                      };
                    };
                  }
                  return c;
                });
              };
            },
          ]),
        shapes: [
          ...allNodes.map((n) =>
            defineShape<DiscourseNodeShape>({
              type: n.type,
              getShapeUtil: () =>
                class extends DiscourseNodeUtil {
                  constructor(app: TldrawApp) {
                    super(app, n.type);
                  }
                },
            })
          ),
          ...allRelationIds.map((id) =>
            defineShape<DiscourseRelationShape>({
              type: id,
              getShapeUtil: () =>
                class extends DiscourseRelationUtil {
                  constructor(app: TldrawApp) {
                    super(app, id);
                  }
                },
            })
          ),
          ...allAddReferencedNodeActions.map((action) =>
            defineShape<DiscourseReferencedNodeShape>({
              type: action,
              getShapeUtil: () =>
                class extends DiscourseReferencedNodeUtil {
                  constructor(app: TldrawApp) {
                    super(app, action);
                  }
                },
            })
          ),
        ],
        allowUnknownShapes: true,
      }),
    [allNodes, allRelationIds, allRelationsById, allAddReferencedNodeActions]
  );
  const pageUid = useMemo(() => getPageUidByPageTitle(title), [title]);
  const tree = useMemo(() => getBasicTreeByParentUid(pageUid), [pageUid]);
  const appRef = useRef<TldrawApp>();
  const lastInsertRef = useRef<Vec2dModel>();
  const initialState = useMemo(() => {
    const persisted = getSubTree({
      parentUid: pageUid,
      tree,
      key: "State",
    });
    if (!persisted.uid) {
      // we create a block so that the page is not garbage collected
      createBlock({
        node: {
          text: "State",
        },
        parentUid: pageUid,
      });
    }
    const instanceId = TLInstance.createCustomId(pageUid);
    const userId = TLUser.createCustomId(getCurrentUserUid());
    const props = getBlockProps(pageUid) as Record<string, unknown>;
    const rjsqb = props["roamjs-query-builder"] as Record<string, unknown>;
    const data = rjsqb?.tldraw as Parameters<TLStore["deserialize"]>[0];
    return { instanceId, userId, data };
  }, [tree, pageUid]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [maximized, setMaximized] = useState(false);
  const localStateIds: string[] = [];
  const store = useMemo(() => {
    const _store = customTldrawConfig.createStore({
      initialData: initialState.data,
      instanceId: initialState.instanceId,
      userId: initialState.userId,
    });
    _store.listen((rec) => {
      if (rec.source !== "user") return;
      const validChanges = Object.keys(rec.changes.added)
        .concat(Object.keys(rec.changes.removed))
        .concat(Object.keys(rec.changes.updated))
        .filter(
          (k) =>
            !/^(user_presence|camera|instance|instance_page_state):/.test(k)
        );
      if (!validChanges.length) return;
      clearTimeout(serializeRef.current);
      serializeRef.current = window.setTimeout(async () => {
        const state = _store.serialize();
        const props = getBlockProps(pageUid) as Record<string, unknown>;
        const rjsqb =
          typeof props["roamjs-query-builder"] === "object"
            ? props["roamjs-query-builder"]
            : {};
        await setInputSetting({
          blockUid: pageUid,
          key: "timestamp",
          value: new Date().valueOf().toString(),
        });
        const newstateId = nanoid();
        localStateIds.push(newstateId);
        localStateIds.splice(0, localStateIds.length - 25);
        window.roamAlphaAPI.updateBlock({
          block: {
            uid: pageUid,
            props: {
              ...props,
              ["roamjs-query-builder"]: {
                ...rjsqb,
                stateId: newstateId,
                tldraw: state,
              },
            },
          },
        });
      }, THROTTLE);
    });
    return _store;
  }, [initialState, serializeRef]);

  useEffect(() => {
    const pullWatchProps: Parameters<AddPullWatch> = [
      "[:edit/user :block/props :block/string {:block/children ...}]",
      `[:block/uid "${pageUid}"]`,
      (_, after) => {
        const props = normalizeProps(
          (after?.[":block/props"] || {}) as json
        ) as Record<string, json>;
        const rjsqb = props["roamjs-query-builder"] as Record<string, unknown>;
        const propsStateId = rjsqb?.stateId as string;
        if (localStateIds.some((s) => s === propsStateId)) return;
        const newState = rjsqb?.tldraw as Parameters<
          typeof store.deserialize
        >[0];
        if (!newState) return;
        clearTimeout(deserializeRef.current);
        deserializeRef.current = window.setTimeout(() => {
          store.mergeRemoteChanges(() => {
            const currentState = store.serialize();
            const diff = calculateDiff(newState, currentState);
            store.applyDiff(diff);
          });
        }, THROTTLE);
      },
    ];
    window.roamAlphaAPI.data.addPullWatch(...pullWatchProps);
    return () => {
      window.roamAlphaAPI.data.removePullWatch(...pullWatchProps);
    };
  }, [initialState, store]);

  // Handle actions (roamjs:query-builder:action)
  useEffect(() => {
    const handleCreateShapeAction = ({
      uid,
      val,
      onRefresh,
    }: {
      uid: string;
      val: string;
      onRefresh: () => void;
    }) => {
      const app = appRef.current;
      if (!app) return;
      const { x, y } = app.pageCenter;
      const { w, h } = app.pageBounds;
      const lastTime = lastInsertRef.current;
      const position = lastTime
        ? {
            x: lastTime.x + w * 0.025,
            y: lastTime.y + h * 0.05,
          }
        : { x: x - DEFAULT_WIDTH / 2, y: y - DEFAULT_HEIGHT / 2 };
      const nodeType = findDiscourseNode(uid, allNodes);
      if (nodeType) {
        app.createShapes([
          {
            type: nodeType.type,
            id: createShapeId(),
            props: {
              uid,
              title: val,
            },
            ...position,
          },
        ]);
        lastInsertRef.current = position;
        onRefresh();
      }
    };
    const handleMoveCameraToShapeAction = ({
      shapeId,
    }: {
      shapeId: TLShapeId;
    }) => {
      const app = appRef.current;
      if (!app) return;
      const shape = app.getShapeById(shapeId);
      if (!shape) {
        return renderToast({
          id: "tldraw-warning",
          intent: "warning",
          content: `Shape not found.`,
        });
      }
      const x = shape?.x || 0;
      const y = shape?.y || 0;
      app.centerOnPoint(x, y, { duration: 500, easing: (t) => t * t });
      app.select(shapeId);
    };
    const actionListener = ((
      e: CustomEvent<{
        action: string;
        uid?: string;
        val?: string;
        shapeId?: TLShapeId;
        onRefresh?: () => void;
      }>
    ) => {
      if (e.detail.action === "move-camera-to-shape") {
        if (!e.detail.shapeId) return;
        handleMoveCameraToShapeAction({ shapeId: e.detail.shapeId });
      }
      if (/canvas/i.test(e.detail.action)) {
        if (!e.detail.uid || !e.detail.val || !e.detail.onRefresh) return;
        handleCreateShapeAction({
          uid: e.detail.uid,
          val: e.detail.val,
          onRefresh: e.detail.onRefresh,
        });
      }
    }) as EventListener;
    document.addEventListener("roamjs:query-builder:action", actionListener);
    return () => {
      document.removeEventListener(
        "roamjs:query-builder:action",
        actionListener
      );
    };
  }, [appRef, allNodes]);

  const triggerContextMenuConvertTo = () => {
    const shape = appRef.current?.onlySelectedShape;
    if (!shape) return;
    const shapeEl = document.getElementById(shape.id);
    const rect = shapeEl?.getBoundingClientRect();
    const contextMenu = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: rect?.left,
      clientY: rect?.top,
    });
    shapeEl?.dispatchEvent(contextMenu);
    const menuItem = document.querySelector(
      'button[data-wd="menu-item.convert-to"]'
    ) as HTMLMenuElement;
    if (menuItem) {
      setTimeout(() => {
        menuItem.click();
      }, 100);
    }
  };

  // Menu Overrides
  const addFullScreenToggle = (mainMenu: MenuGroup) => {
    const viewSubMenu = mainMenu.children.find(
      (m): m is SubMenu => m.type === "submenu" && m.id === "view"
    );
    const viewActionsGroup = viewSubMenu?.children.find(
      (m): m is MenuGroup => m.type === "group" && m.id === "view-actions"
    );
    if (!viewActionsGroup) return;
    viewActionsGroup.children.push({
      type: "item",
      readonlyOk: true,
      id: "toggle-full-screen",
      disabled: false,
      checked: maximized,
      actionItem: {
        id: "toggle-full-screen",
        label: "action.toggle-full-screen" as TLTranslationKey,
        kbd: "!3",
        onSelect: () => {
          setMaximized(!maximized);
        },
        readonlyOk: true,
      },
    });
  };
  const editCopyAsShortcuts = (mainMenu: MenuGroup) => {
    const editSubMenu = mainMenu.children.find(
      (m): m is SubMenu => m.type === "submenu" && m.id === "edit"
    );
    const conversionsGroup = editSubMenu?.children.find(
      (m): m is MenuGroup => m.type === "group" && m.id === "conversions"
    );
    const copyAsSubMenu = conversionsGroup?.children.find(
      (m): m is SubMenu => m.type === "submenu" && m.id === "copy-as"
    );
    const copyAsGroup = copyAsSubMenu?.children.find(
      (m): m is MenuGroup => m.type === "group" && m.id === "copy-as-group"
    );
    const copyAsPngItem = copyAsGroup?.children.find(
      (m): m is MenuItem => m.type === "item" && m.id === "copy-as-png"
    );
    const copyAsSvgItem = copyAsGroup?.children.find(
      (m): m is MenuItem => m.type === "item" && m.id === "copy-as-svg"
    );
    if (!copyAsPngItem || !copyAsSvgItem) return;
    copyAsPngItem.actionItem.kbd = "$!C";
    copyAsSvgItem.actionItem.kbd = "$!X";
  };

  return (
    <div
      className={`border border-gray-300 rounded-md bg-white h-full w-full z-10 overflow-hidden ${
        maximized ? "absolute inset-0" : "relative"
      }`}
      id={`roamjs-tldraw-canvas-container`}
      ref={containerRef}
      tabIndex={-1}
    >
      <style>
        {`.roam-article .rm-block-children {
        display: none;
      }
      .rs-arrow-label__inner{
        min-width: initial;
      }
      kbd.tlui-kbd {
        background-color: initial;
        box-shadow: initial;
        border-radius: initial;
        padding: initial;
      }${
        maximized
          ? "div.roam-body div.roam-app div.roam-main div.roam-article { position: inherit; }"
          : ""
      }
      #roamjs-tldraw-canvas-container .rs-shape .roamjs-tldraw-node .rm-block-main .rm-block-separator {
        display: none;
      }
      /* arrow label line fix */
      /* seems like width is being miscalculted cause letters to linebreak */
      /* TODO: this is a temporary fix */
      /* also Roam is hijacking the font choice */
      .rs-arrow-label .rs-arrow-label__inner p {
        padding: 0;
        white-space: nowrap;
        font-family: var(--rs-font-sans);
      }`}
      </style>
      <TldrawEditor
        baseUrl="https://samepage.network/assets/tldraw/"
        instanceId={initialState.instanceId}
        userId={initialState.userId}
        config={customTldrawConfig}
        store={store}
        onMount={(app) => {
          if (process.env.NODE_ENV !== "production") {
            if (!window.tldrawApps) window.tldrawApps = {};
            const { tldrawApps } = window;
            tldrawApps[title] = app;
          }
          appRef.current = app;
          // TODO - this should move to one of DiscourseNodeTool's children classes instead
          app.on("event", (e) => {
            discourseContext.lastAppEvent = e.name;

            const validModifier = e.shiftKey || e.ctrlKey || e.metaKey;
            if (!(e.name === "pointer_up" && e.shape && validModifier)) return;
            if (app.selectedIds.length) return; // User is positioning selected shape

            const shapeUid = e.shape?.props.uid;
            if (!isLiveBlock(shapeUid)) {
              if (!e.shape.props.title) return;
              renderToast({
                id: "tldraw-warning",
                intent: "warning",
                content: `Not a valid UID. Cannot Open.`,
              });
            }

            if (e.shiftKey) {
              // TODO - do not openBlockInSidebar if user is using shift to select
              openBlockInSidebar(e.shape.props.uid);
            }
            if (e.ctrlKey || e.metaKey) {
              const isPage = !!getPageTitleByPageUid(shapeUid);
              if (isPage) {
                window.roamAlphaAPI.ui.mainWindow.openPage({
                  page: { uid: shapeUid },
                });
              } else {
                window.roamAlphaAPI.ui.mainWindow.openBlock({
                  block: { uid: shapeUid },
                });
              }
            }
          });
          const oldOnBeforeDelete = app.store.onBeforeDelete;
          app.store.onBeforeDelete = (record) => {
            oldOnBeforeDelete?.(record);
            if (record.typeName === "shape") {
              const util = app.getShapeUtil(record);
              if (util instanceof DiscourseNodeUtil) {
                util.onBeforeDelete(record as DiscourseNodeShape);
              }
            }
          };
          const oldOnAfterCreate = app.store.onAfterCreate;
          app.store.onAfterCreate = (record) => {
            oldOnAfterCreate?.(record);
            if (record.typeName === "shape") {
              const util = app.getShapeUtil(record);
              if (util instanceof DiscourseNodeUtil) {
                util.onAfterCreate(record as DiscourseNodeShape);
              }
            }
          };
        }}
      >
        <TldrawUi
          assetBaseUrl="https://samepage.network/assets/tldraw/"
          overrides={{
            translations: {
              en: {
                ...Object.fromEntries(
                  allNodes.map((node) => [`shape.node.${node.type}`, node.text])
                ),
                ...Object.fromEntries(
                  allRelationNames.map((name) => [
                    `shape.relation.${name}`,
                    name,
                  ])
                ),
                ...Object.fromEntries(
                  allAddReferencedNodeActions.map((name) => [
                    `shape.referenced.${name}`,
                    name,
                  ])
                ),
                "action.toggle-full-screen": "Toggle Full Screen",
                "action.convert-to": "Convert to",
                ...Object.fromEntries(
                  allNodes.map((node) => [
                    `action.convert-to-${node.type}`,
                    `${node.text}`,
                  ])
                ),
              },
            },
            contextMenu(app, schema, helpers) {
              if (helpers.oneSelected) {
                const shape = app.getShapeById(app.selectedIds[0]);
                if (!shape) return schema;
                const convertToDiscourseNode = async (
                  text: string,
                  type: string,
                  imageShapeUrl?: string
                ) => {
                  if (!extensionAPI) {
                    renderToast({
                      id: "tldraw-warning",
                      intent: "danger",
                      content: `Failed to convert to ${type}.  Please contact support`,
                    });
                    return;
                  }
                  const nodeText =
                    type === "blck-node"
                      ? text
                      : await getNewDiscourseNodeText({
                          text,
                          nodeType: type,
                        });
                  const uid = await createDiscourseNode({
                    configPageUid: type,
                    text: nodeText,
                    imageUrl: imageShapeUrl,
                    extensionAPI,
                  });
                  app.deleteShapes([shape.id]);
                  const { x, y } = shape;
                  const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
                    nodeText: nodeText,
                    extensionAPI,
                    nodeType: type,
                    uid,
                  });
                  app.createShapes([
                    {
                      type,
                      id: createShapeId(),
                      props: {
                        uid,
                        title: nodeText,
                        h,
                        w,
                        imageUrl,
                      },
                      x,
                      y,
                    },
                  ]);
                };
                const getOnSelectForShape = (
                  shape: TLShape,
                  nodeType: string
                ) => {
                  if (!shape.type) return null;
                  if (shape.type === "image") {
                    return async () => {
                      const { assetId } = (shape as TLImageShape).props;
                      if (!assetId) return;
                      const asset = app.getAssetById(assetId);
                      if (!asset || !asset.props.src) return;
                      const file = await fetch(asset.props.src)
                        .then((r) => r.arrayBuffer())
                        .then((buf) => new File([buf], shape.id));
                      const src = await window.roamAlphaAPI.util.uploadFile({
                        file,
                      });
                      const text =
                        nodeType === "blck-node" ? `![](${src})` : "";
                      convertToDiscourseNode(text, nodeType, src);
                    };
                  } else if (shape.type === "text") {
                    return () => {
                      const { text } = (shape as TLTextShape).props;
                      convertToDiscourseNode(text, nodeType);
                    };
                  }
                };

                if (shape.type === "image" || shape.type === "text") {
                  const nodeMenuItems = allNodes.map((node) => {
                    return {
                      checked: false,
                      id: `convert-to-${node.type}`,
                      type: "item",
                      readonlyOk: true,
                      disabled: false,
                      actionItem: {
                        label:
                          `action.convert-to-${node.type}` as TLTranslationKey,
                        id: `convert-to-${node.type}`,
                        onSelect: getOnSelectForShape(shape, node.type),
                        readonlyOk: true,
                        menuLabel:
                          `Convert to ${node.text}` as TLTranslationKey,
                        title: `Convert to ${node.text}`,
                      },
                    } as MenuItem;
                  });

                  // Page not yet supported
                  // requires page-node to have image flag option
                  const filteredItems =
                    shape.type === "image"
                      ? nodeMenuItems.filter(
                          (item) => item.id !== "convert-to-page-node"
                        )
                      : nodeMenuItems;

                  const submenuGroup: MenuGroup = {
                    id: "convert-to-group",
                    type: "group",
                    checkbox: false,
                    disabled: false,
                    readonlyOk: true,
                    children: [
                      {
                        id: "convert-to",
                        type: "submenu",
                        label: "action.convert-to" as TLTranslationKey,
                        disabled: false,
                        readonlyOk: true,
                        children: [...filteredItems],
                      },
                    ],
                  };

                  schema.push(submenuGroup);
                }
              }
              return schema;
            },
            actions(_app, actions) {
              (actions["toggle-full-screen"] = {
                id: "toggle-full-screen",
                label: "action.toggle-full-screen" as TLTranslationKey,
                kbd: "!3",
                onSelect: () => {
                  setMaximized(!maximized);
                },
                readonlyOk: true,
              }),
                (actions["convert-to"] = {
                  id: "convert-to",
                  label: "action.convert-to" as TLTranslationKey,
                  kbd: "?C",
                  onSelect: () => triggerContextMenuConvertTo(),
                  readonlyOk: true,
                });
              return actions;
            },
            tools(app, tools) {
              allNodes.forEach((node, index) => {
                tools[node.type] = {
                  id: node.type,
                  icon: "color",
                  label: `shape.node.${node.type}` as TLTranslationKey,
                  kbd: node.shortcut,
                  readonlyOk: true,
                  onSelect: () => {
                    app.setSelectedTool(node.type);
                  },
                  style: {
                    color:
                      formatHexColor(node.canvasSettings.color) ||
                      `var(--palette-${COLOR_ARRAY[index]})`,
                  },
                };
              });
              allRelationNames.forEach((relation, index) => {
                tools[relation] = {
                  id: relation,
                  icon: "tool-arrow",
                  label: `shape.relation.${relation}` as TLTranslationKey,
                  kbd: "",
                  readonlyOk: true,
                  onSelect: () => {
                    app.setSelectedTool(relation);
                  },
                  style: {
                    color: `var(--palette-${COLOR_ARRAY[index + 1]})`,
                  },
                };
              });
              Object.keys(allAddReferencedNodeByAction).forEach((name) => {
                const action = allAddReferencedNodeByAction[name];
                const nodeColorArray = Object.keys(discourseContext.nodes).map(
                  (key) => ({
                    text: discourseContext.nodes[key].text,
                    color: discourseContext.nodes[key].canvasSettings.color,
                  })
                );
                const color =
                  nodeColorArray.find((n) => n.text === action[0].sourceName)
                    ?.color || "";
                tools[name] = {
                  id: name,
                  icon: "tool-arrow",
                  label: `shape.referenced.${name}` as TLTranslationKey,
                  kbd: "",
                  readonlyOk: true,
                  onSelect: () => {
                    app.setSelectedTool(`${name}`);
                  },
                  style: {
                    color:
                      formatHexColor(color) ??
                      `var(--palette-${COLOR_ARRAY[0]})`,
                  },
                };
              });
              return tools;
            },
            toolbar(_app, toolbar, { tools }) {
              toolbar.push(
                ...allNodes.map((n) => toolbarItem(tools[n.type])),
                ...allRelationNames.map((name) => toolbarItem(tools[name])),
                ...allAddReferencedNodeActions.map((action) =>
                  toolbarItem(tools[action])
                )
              );
              return toolbar;
            },
            keyboardShortcutsMenu(
              _app,
              keyboardShortcutsMenu,
              { tools, actions }
            ) {
              const toolsGroup = keyboardShortcutsMenu.find(
                (group) => group.id === "shortcuts-dialog.tools"
              ) as MenuGroup;
              const viewGroup = keyboardShortcutsMenu.find(
                (group) => group.id === "shortcuts-dialog.view"
              ) as MenuGroup;
              const transformGroup = keyboardShortcutsMenu.find(
                (group) => group.id === "shortcuts-dialog.transform"
              ) as MenuGroup;

              toolsGroup.children.push(
                ...allNodes.map((n) => menuItem(tools[n.type]))
              );
              viewGroup.children.push(menuItem(actions["toggle-full-screen"]));
              transformGroup.children.push(menuItem(actions["convert-to"]));

              return keyboardShortcutsMenu;
            },
            menu(_app, menu) {
              const mainMenu = menu.find(
                (m): m is MenuGroup => m.type === "group" && m.id === "menu"
              );
              if (mainMenu) {
                addFullScreenToggle(mainMenu);
                editCopyAsShortcuts(mainMenu);
              }
              return menu;
            },
          }}
        >
          <ContextMenu>
            <Canvas />
          </ContextMenu>
        </TldrawUi>
      </TldrawEditor>
    </div>
  );
};

export const renderTldrawCanvas = (title: string, onloadArgs: OnloadArgs) => {
  const children = document.querySelector<HTMLDivElement>(
    ".roam-article .rm-block-children"
  );
  if (
    children &&
    children.parentElement &&
    !children.hasAttribute("data-roamjs-discourse-playground")
  ) {
    children.setAttribute("data-roamjs-discourse-playground", "true");
    const parent = document.createElement("div");
    children.parentElement.appendChild(parent);
    parent.style.height = "500px";
    renderWithUnmount(
      <ExtensionApiContextProvider {...onloadArgs}>
        <TldrawCanvas title={title} previewEnabled={isFlagEnabled("preview")} />
      </ExtensionApiContextProvider>,
      parent
    );
  }
};

export default TldrawCanvas;
