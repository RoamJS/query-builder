import {
  ShapeUtil,
  Rectangle2d,
  HTMLContainer,
  TLBaseShape,
  useEditor,
  DefaultColorStyle,
  Editor,
  TLRecord,
  TLArrowShapeProps,
  DefaultFontFamilies,
  BaseBoxShapeTool,
  TLOnResizeHandler,
  resizeBox,
  TLShape,
  createShapeId,
  isShape,
  TLEventMapHandler,
  SvgExportContext,
  TLDefaultHorizontalAlignStyle,
  BoxModel,
  TLDefaultVerticalAlignStyle,
  Box,
} from "tldraw";
// import { useValue } from "signia-react";

import React, { useState, useEffect, useRef } from "react";
import { useExtensionAPI } from "roamjs-components/components/ExtensionApiContext";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
// import calcCanvasNodeSizeAndImg from "../../utils/calcCanvasNodeSizeAndImg";
import createDiscourseNode from "../../utils/createDiscourseNode";
import getDiscourseNodes, {
  DiscourseNode,
} from "../../utils/getDiscourseNodes";
import { measureCanvasNodeText } from "../../utils/measureCanvasNodeText";
import { isPageUid } from "./Tldraw-2-3-0";
import LabelDialog from "./LabelDialog";
import getDiscourseRelations, {
  DiscourseRelation,
} from "../../utils/getDiscourseRelations";
import ContrastColor from "contrast-color";
import { discourseContext } from "./Tldraw-2-3-0";
import getDiscourseContextResults from "../../utils/getDiscourseContextResults";
import calcCanvasNodeSizeAndImg from "../../utils/calcCanvasNodeSizeAndImg";
// import { DiscourseRelationShape } from "./DiscourseRelationsUtil";

// TODO REPLACE WITH TLDRAW DEFAULTS
// https://github.com/tldraw/tldraw/pull/1580/files
const TEXT_PROPS = {
  lineHeight: 1.35,
  fontWeight: "normal",
  fontVariant: "normal",
  fontStyle: "normal",
  padding: "0px",
  maxWidth: "auto",
};
// // FONT_FAMILIES.sans or tldraw_sans not working in toSvg()
// // maybe check getSvg()
// // in node_modules\@tldraw\tldraw\node_modules\@tldraw\editor\dist\cjs\lib\app\App.js
const SVG_FONT_FAMILY = `"Inter", "sans-serif"`;

export const DEFAULT_STYLE_PROPS = {
  ...TEXT_PROPS,
  fontSize: 16,
  fontFamily: "'Inter', sans-serif",
  width: "fit-content",
  padding: "40px",
};
export const COLOR_ARRAY = Array.from(DefaultColorStyle.values).reverse();
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

const getRelationIds = () =>
  new Set(
    Object.values(discourseContext.relations).flatMap((rs) =>
      rs.map((r) => r.id)
    )
  );

export const createNodeShapeTools = (nodes: DiscourseNode[]) => {
  return nodes.map((n) => {
    return class DiscourseNodeTool extends BaseBoxShapeTool {
      static id = n.type;
      static initial = "idle";
      shapeType = n.type;
    };
  });
};

export const createNodeShapeUtils = (nodes: DiscourseNode[]) => {
  return nodes.map((node) => {
    // Create a subclass of CardShapeUtil for each type
    class DiscourseNodeUtil extends BaseDiscourseNodeUtil {
      constructor(editor: Editor) {
        super(editor, node.type);
      }
      static override type = node.type; // removing this gives undefined error
      // getDefaultProps(): DiscourseNodeShape["props"] {
      //   const baseProps = super.getDefaultProps();
      //   return {
      //     ...baseProps,
      //     color: node.color,
      //   };
      // }
    }
    return DiscourseNodeUtil;
  });
};

export type DiscourseNodeShape = TLBaseShape<
  string,
  {
    w: number;
    h: number;
    // opacity: TLOpacityType;
    uid: string;
    title: string;
    imageUrl?: string;
  }
>;
export class BaseDiscourseNodeUtil extends ShapeUtil<DiscourseNodeShape> {
  type: string;

  constructor(editor: Editor, type: string) {
    super(editor);
    this.type = type;
  }

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;
  override canEdit = () => true;
  getGeometry(shape: DiscourseNodeShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  getDefaultProps(): DiscourseNodeShape["props"] {
    return {
      // opacity: "1" as DiscourseNodeShape["props"]["opacity"],
      w: 160,
      h: 64,
      uid: window.roamAlphaAPI.util.generateUID(),
      title: "",
    };
  }

  deleteRelationsInCanvas({
    shape,
    relationIds = getRelationIds(),
  }: {
    shape: DiscourseNodeShape;
    relationIds?: Set<string>;
  }) {
    const editor = this.editor;
    const bindingsToThisShape = Array.from(relationIds).flatMap((r) =>
      editor.getBindingsToShape(shape.id, r)
    );
    const relationIdsAndType = bindingsToThisShape.map((b) => {
      return { id: b.fromId, type: b.type };
    });
    const bindingsToDelete = relationIdsAndType.flatMap((r) => {
      return editor.getBindingsFromShape(r.id, r.type);
    });

    const relationIdsToDelete = relationIdsAndType.map((r) => r.id);
    const bindingIdsToDelete = bindingsToDelete.map((b) => b.id);

    editor.deleteShapes(relationIdsToDelete).deleteBindings(bindingIdsToDelete);
  }

  async createExistingRelations({
    shape,
    relationIds = getRelationIds(),
    finalUid = shape.props.uid,
  }: {
    shape: DiscourseNodeShape;
    relationIds?: Set<string>;
    finalUid?: string;
  }) {
    const editor = this.editor;
    const nodes = Object.values(discourseContext.nodes);
    const nodeIds = new Set(nodes.map((n) => n.type));
    const allRecords = editor.store.allRecords();
    const nodesInCanvas = Object.fromEntries(
      allRecords
        .filter((r): r is DiscourseNodeShape => {
          return r.typeName === "shape" && nodeIds.has(r.type);
        })
        .map((r) => [r.props.uid, r] as const)
    );
    const discourseContextResults = await getDiscourseContextResults({
      uid: finalUid,
      nodes: Object.values(discourseContext.nodes),
      relations: Object.values(discourseContext.relations).flat(),
    });
    const discourseContextRelationIds = new Set(
      discourseContextResults
        .flatMap((item) =>
          Object.values(item.results).map((result) => result.id)
        )
        .filter((id) => id !== undefined)
    );
    const currentShapeRelations = Array.from(
      discourseContextRelationIds
    ).flatMap((relationId) => {
      const bindingsToThisShape = editor.getBindingsToShape(
        shape.id,
        relationId
      );
      return bindingsToThisShape.map((b) => {
        const arrowId = b.fromId;
        const bindingsFromArrow = editor.getBindingsFromShape(
          arrowId,
          relationId
        );
        const endBinding = bindingsFromArrow.find((b) => b.toId !== shape.id);
        if (!endBinding) return null;
        return {
          startId: shape.id,
          endId: endBinding.toId,
        };
      });
    });

    const toCreate = discourseContextResults
      .flatMap((r) =>
        Object.entries(r.results)
          .filter(([k, v]) => nodesInCanvas[k] && v.id && relationIds.has(v.id))
          .map(([k, v]) => ({
            relationId: v.id!,
            complement: v.complement,
            nodeId: k,
          }))
      )
      .filter(({ complement, nodeId }) => {
        const startId = complement ? nodesInCanvas[nodeId].id : shape.id;
        const endId = complement ? shape.id : nodesInCanvas[nodeId].id;
        const relationAlreadyExists = currentShapeRelations.some((r) => {
          return complement
            ? r?.startId === endId && r?.endId === startId
            : r?.startId === startId && r?.endId === endId;
        });
        return !relationAlreadyExists;
      })
      .map(({ relationId, complement, nodeId }) => {
        const arrowId = createShapeId();
        return { relationId, complement, nodeId, arrowId };
      });

    const shapesToCreate = toCreate.map(({ relationId, arrowId }) => {
      return {
        id: arrowId,
        type: relationId,
      };
    });

    const bindingsToCreate = toCreate.flatMap(
      ({ relationId, complement, nodeId, arrowId }) => {
        const staticRelationProps = {
          type: relationId,
          fromId: arrowId,
        };
        return [
          {
            ...staticRelationProps,
            toId: complement ? nodesInCanvas[nodeId].id : shape.id,
            props: {
              terminal: "start",
            },
          },
          {
            ...staticRelationProps,
            toId: complement ? shape.id : nodesInCanvas[nodeId].id,
            props: {
              terminal: "end",
            },
          },
        ];
      }
    );

    editor.createShapes(shapesToCreate).createBindings(bindingsToCreate);
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

  getColors() {
    const {
      canvasSettings: { color: setColor = "" } = {},
      index: discourseNodeIndex = -1,
    } = discourseContext.nodes[this.type] || {};
    const paletteColor =
      COLOR_ARRAY[
        discourseNodeIndex >= 0 && discourseNodeIndex < COLOR_ARRAY.length - 1
          ? discourseNodeIndex
          : 0
      ];
    const formattedBackgroundColor =
      setColor && !setColor.startsWith("#") ? `#${setColor}` : setColor;

    const backgroundColor = formattedBackgroundColor
      ? formattedBackgroundColor
      : COLOR_PALETTE[paletteColor];
    const textColor = ContrastColor.contrastColor({
      bgColor: backgroundColor,
    });
    return { backgroundColor, textColor };
  }

  toSvg(shape: DiscourseNodeShape): JSX.Element {
    // packages\tldraw\src\lib\shapes\shared\createTextJsxFromSpans.tsx
    function correctSpacesToNbsp(input: string) {
      return input.replace(/\s/g, "\xa0");
    }
    function createTextJsxFromSpans(
      spans: { text: string; box: BoxModel }[],
      opts: {
        fontSize: number;
        fontFamily: string;
        textAlign: TLDefaultHorizontalAlignStyle;
        verticalTextAlign: TLDefaultVerticalAlignStyle;
        fontWeight: string;
        fontStyle: string;
        width: number;
        height: number;
        stroke?: string;
        strokeWidth?: number;
        fill?: string;
        padding?: number;
        offsetX?: number;
        offsetY?: number;
      }
    ) {
      const { padding = 0 } = opts;
      if (spans.length === 0) return null;

      const bounds = Box.From(spans[0].box);
      for (const { box } of spans) {
        bounds.union(box);
      }

      const offsetX = padding + (opts.offsetX ?? 0);
      const offsetY =
        (opts.offsetY ?? 0) +
        opts.fontSize / 2 +
        (opts.verticalTextAlign === "start"
          ? padding
          : opts.verticalTextAlign === "end"
          ? opts.height - padding - bounds.height
          : (Math.ceil(opts.height) - bounds.height) / 2);

      // Create text span elements for each word
      let currentLineTop = null;
      const children = [];
      for (const { text, box } of spans) {
        // if we broke a line, add a line break span. This helps tools like
        // figma import our exported svg correctly
        const didBreakLine = currentLineTop !== null && box.y > currentLineTop;
        if (didBreakLine) {
          children.push(
            <tspan
              key={children.length}
              alignmentBaseline="mathematical"
              x={offsetX}
              y={box.y + offsetY}
            >
              {"\n"}
            </tspan>
          );
        }

        children.push(
          <tspan
            key={children.length}
            alignmentBaseline="mathematical"
            x={box.x + offsetX}
            y={box.y + offsetY}
            // N.B. This property, while discouraged ("intended for Document Type Definition (DTD) designers")
            // is necessary for ensuring correct mixed RTL/LTR behavior when exporting SVGs.
            unicodeBidi="plaintext"
          >
            {correctSpacesToNbsp(text)}
          </tspan>
        );

        currentLineTop = box.y;
      }
      debugger;
      return (
        <text
          fontSize={opts.fontSize}
          fontFamily={opts.fontFamily}
          fontStyle={opts.fontFamily}
          fontWeight={opts.fontWeight}
          dominantBaseline="mathematical"
          alignmentBaseline="mathematical"
          stroke={opts.stroke}
          strokeWidth={opts.strokeWidth}
          fill={opts.fill}
        >
          {children}
        </text>
      );
    }

    const { backgroundColor, textColor } = this.getColors();
    const padding = Number(DEFAULT_STYLE_PROPS.padding.replace("px", ""));
    const props = shape.props;
    const bounds = new Box(0, 0, props.w, props.h);

    const opts = {
      fontSize: DEFAULT_STYLE_PROPS.fontSize,
      fontStyle: DEFAULT_STYLE_PROPS.fontStyle,
      fontWeight: DEFAULT_STYLE_PROPS.fontWeight,
      fontFamily: DEFAULT_STYLE_PROPS.fontFamily,
      lineHeight: DEFAULT_STYLE_PROPS.lineHeight,
      textAlign: "middle" as const,
      verticalTextAlign: "middle" as const,
      width: Math.ceil(bounds.width),
      height: Math.ceil(bounds.height),
      padding,
      overflow: "wrap" as const,
      offsetX: 0,
      offsetY: 0,
      fill: textColor,
    };

    const spans = this.editor.textMeasure.measureTextSpans(props.title, opts);
    const textElement = createTextJsxFromSpans(spans, opts);
    debugger;
    let imageElement = null;
    // let textYOffset =
    // (props.h - lineHeight * numberOfLines) / 2 + padding / 2;

    // if (props.imageUrl) {
    // // Load image dimensions synchronously
    // const { imageWidth, imageHeight } = (() => {
    //   const img = new Image();
    //   img.src = props.imageUrl || "";

    //   if (img.complete) {
    //     return {
    //       imageWidth: img.naturalWidth,
    //       imageHeight: img.naturalHeight,
    //     };
    //   } else {
    //     // Image not loaded yet; use default dimensions or aspect ratio
    //     const defaultAspectRatio = 1; // Assuming square image as default
    //     return {
    //       imageWidth: props.w,
    //       imageHeight: props.w / defaultAspectRatio,
    //     };
    //   }
    // })();

    // const aspectRatio = imageWidth / imageHeight || 1;
    // const svgImageHeight = props.w / aspectRatio;

    // Adjust text Y offset to position below the image
    // textYOffset =
    //   svgImageHeight +
    //   (props.h - svgImageHeight) / 2 -
    //   (lineHeight * numberOfLines) / 2;

    //   imageElement = (
    //     <image
    //       href={props.imageUrl}
    //       width={props.w}
    //       height={svgImageHeight}
    //       preserveAspectRatio="xMidYMid meet"
    //     />
    //   );
    // } else {
    // Position the text vertically in the center of the shape
    // textYOffset =
    //   (props.h - lineHeight * numberOfLines) / 2 + padding / 2;
    // }

    return (
      <g>
        <rect
          width={shape.props.w}
          height={shape.props.h}
          fill={backgroundColor}
          opacity={shape.opacity}
          rx={16}
          ry={16}
        />
        {imageElement}
        {textElement}
      </g>
    );
  }

  override onResize: TLOnResizeHandler<DiscourseNodeShape> = (shape, info) => {
    return resizeBox(shape, info);
  };

  indicator(shape: DiscourseNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  updateProps(
    id: DiscourseNodeShape["id"],
    type: DiscourseNodeShape["type"],
    props: Partial<DiscourseNodeShape["props"]>
  ) {
    this.editor.updateShapes([{ id, props, type }]);
  }
  component(shape: DiscourseNodeShape) {
    const editor = useEditor();
    const extensionAPI = useExtensionAPI();
    const {
      canvasSettings: { alias = "", "key-image": isKeyImage = "" } = {},
    } = discourseContext.nodes[shape.type] || {};

    // Handle LabelDialog
    useEffect(() => {
      const handleChangeEvent: TLEventMapHandler<"change"> = (change) => {
        for (const [_, to] of Object.values(change.changes.updated)) {
          if (to.typeName === "instance_page_state") {
            if (to.editingShapeId === shape.id) {
              setIsEditLabelOpen(true);
            }
          }
        }
      };
      const cleanupFunction = editor.store.listen(handleChangeEvent, {
        source: "user",
        scope: "all",
      });

      return () => {
        cleanupFunction();
      };
    }, [editor]);

    const [isLabelEditOpen, setIsEditLabelOpen] = useState(false);
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
        console.log(
          "roamjs:query-builder:created-canvas-node",
          e.detail,
          shape.id
        );
        if (e.detail === shape.id) {
          setIsEditLabelOpen(true);
          editor.setEditingShape(shape);
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

    const { backgroundColor, textColor } = this.getColors();

    const setSizeAndImgProps = async ({
      context,
      text,
      uid,
    }: {
      context: BaseDiscourseNodeUtil;
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
      context.updateProps(shape.id, shape.type, {
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
          background: backgroundColor,
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
              editor.setEditingShape(null);
              setIsEditLabelOpen(false);
            }}
            label={shape.props.title}
            nodeType={shape.type}
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
              this.updateProps(shape.id, shape.type, {
                title: text,
                uid,
              });

              // Update Shape Relations
              const relationIds = getRelationIds();
              this.deleteRelationsInCanvas({ shape, relationIds });
              await this.createExistingRelations({
                shape,
                relationIds,
                finalUid: uid,
              });

              setIsEditLabelOpen(false);
              editor.setEditingShape(null);
            }}
            onCancel={() => {
              editor.setEditingShape(null);
              setIsEditLabelOpen(false);
              if (!isLiveBlock(shape.props.uid)) {
                editor.deleteShapes([shape.id]);
              }
            }}
          />
        </div>
      </HTMLContainer>
    );
  }
}
