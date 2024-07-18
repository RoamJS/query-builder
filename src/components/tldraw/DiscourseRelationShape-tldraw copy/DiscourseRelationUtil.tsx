import React, { useEffect, useRef, useState } from "react";
import {
  RecordPropsType,
  arrowShapeProps,
  TLBaseShape,
  ShapeUtil,
  TLShapeUtilCanBindOpts,
  TLShapeUtilFlag,
  Geometry2d,
  Edge2d,
  Vec,
  Group2d,
  TLHandle,
  useDefaultColorTheme,
  SVGContainer,
  TextLabel,
  TEXT_PROPS,
  TLOnEditEndHandler,
  Editor,
  TLShapeId,
  createComputedCache,
  TLDefaultSizeStyle,
  Mat,
  TLArrowBinding,
  TLShape,
  MatModel,
  VecLike,
  intersectLineSegmentPolygon,
  intersectLineSegmentPolyline,
  Box,
  getPerfectDashProps,
  toDomPrecision,
  track,
  useEditor,
  TLDefaultFillStyle,
  TLDefaultColorTheme,
  TLDefaultColorStyle,
  useSvgExportContext,
  useValue,
  PI,
  intersectCircleCircle,
  Arc2d,
  FONT_FAMILIES,
  clamp,
  getPointOnCircle,
  Circle2d,
  Polygon2d,
  TLArrowInfo,
  angleDistance,
  intersectCirclePolygon,
  useIsEditing,
  Rectangle2d,
  SvgExportContext,
  getDefaultColorTheme,
  DefaultFontStyle,
  SvgExportDef,
  DefaultFontFamilies,
  TLDefaultFontStyle,
  TLDefaultHorizontalAlignStyle,
  TLDefaultVerticalAlignStyle,
  BoxModel,
  FileHelpers,
  TLShapeUtilCanvasSvgDef,
} from "tldraw";
import {
  RelationBinding,
  RelationBindings,
  RelationInfo,
} from "./DiscourseRelationBindings";

interface BoundShapeInfo<T extends TLShape = TLShape> {
  shape: T;
  didIntersect: boolean;
  isExact: boolean;
  isClosed: boolean;
  transform: Mat;
  outline: Vec[];
}

let globalRenderIndex = 0;

const MIN_ARROW_LENGTH = 10;
const BOUND_ARROW_OFFSET = 10;
const labelSizeCache = new WeakMap<RelationShape, Vec>();
const LABEL_TO_ARROW_PADDING = 20;
const ARROW_LABEL_PADDING = 4.25;

const ARROW_LABEL_FONT_SIZES: Record<TLDefaultSizeStyle, number> = {
  s: 18,
  m: 20,
  l: 24,
  xl: 28,
};

// packages\tldraw\src\lib\shapes\shared\default-shape-constants.ts
const STROKE_SIZES: Record<TLDefaultSizeStyle, number> = {
  s: 2,
  m: 3.5,
  l: 5,
  xl: 10,
};

enum ARROW_HANDLES {
  START = "start",
  MIDDLE = "middle",
  END = "end",
}

type RelationShapeProps = RecordPropsType<typeof arrowShapeProps>;
export type RelationShape = TLBaseShape<"relation", RelationShapeProps>;

const arrowInfoCache = createComputedCache(
  "relation info",
  (editor: Editor, shape: RelationShape) => {
    const bindings = getArrowBindings(editor, shape);
    return getStraightArrowInfo(editor, shape, bindings);
  }
  //     return getIsArrowStraight(shape)
  //       ? getStraightArrowInfo(editor, shape, bindings)
  //       : getCurvedArrowInfo(editor, shape, bindings);
  //   }
);

export function getArrowInfo(editor: Editor, shape: RelationShape | TLShapeId) {
  const id = typeof shape === "string" ? shape : shape.id;
  return arrowInfoCache.get(editor, id);
}

export function getArrowBindings(
  editor: Editor,
  shape: RelationShape
): RelationBindings {
  const bindings = editor.getBindingsFromShape<RelationBinding>(
    shape,
    "relation"
  );
  return {
    start: bindings.find((b) => b.props.terminal === "start"),
    end: bindings.find((b) => b.props.terminal === "end"),
  };
}

function getStraightArrowInfo(
  editor: Editor,
  shape: RelationShape,
  bindings: RelationBindings
): RelationInfo {
  const { arrowheadStart, arrowheadEnd } = shape.props;

  const terminalsInArrowSpace = getArrowTerminalsInArrowSpace(
    editor,
    shape,
    bindings
  );

  const a = terminalsInArrowSpace.start.clone();
  const b = terminalsInArrowSpace.end.clone();
  const c = Vec.Med(a, b);

  if (Vec.Equals(a, b)) {
    return {
      bindings,
      isStraight: true,
      start: {
        handle: a,
        point: a,
        arrowhead: shape.props.arrowheadStart,
      },
      end: {
        handle: b,
        point: b,
        arrowhead: shape.props.arrowheadEnd,
      },
      middle: c,
      isValid: false,
      length: 0,
    };
  }

  const uAB = Vec.Sub(b, a).uni();

  // Update the arrowhead points using intersections with the bound shapes, if any.

  const startShapeInfo = getBoundShapeInfoForTerminal(editor, shape, "start");
  const endShapeInfo = getBoundShapeInfoForTerminal(editor, shape, "end");

  const arrowPageTransform = editor.getShapePageTransform(shape)!;

  // Update the position of the arrowhead's end point
  updateArrowheadPointWithBoundShape(
    b, // <-- will be mutated
    terminalsInArrowSpace.start,
    arrowPageTransform,
    endShapeInfo
  );

  // Then update the position of the arrowhead's end point
  updateArrowheadPointWithBoundShape(
    a, // <-- will be mutated
    terminalsInArrowSpace.end,
    arrowPageTransform,
    startShapeInfo
  );

  let offsetA = 0;
  let offsetB = 0;
  let strokeOffsetA = 0;
  let strokeOffsetB = 0;
  let minLength = MIN_ARROW_LENGTH * shape.props.scale;

  const isSelfIntersection =
    startShapeInfo &&
    endShapeInfo &&
    startShapeInfo.shape === endShapeInfo.shape;

  const relationship =
    startShapeInfo && endShapeInfo
      ? getBoundShapeRelationships(
          editor,
          startShapeInfo.shape.id,
          endShapeInfo.shape.id
        )
      : "safe";

  if (
    relationship === "safe" &&
    startShapeInfo &&
    endShapeInfo &&
    !isSelfIntersection &&
    !startShapeInfo.isExact &&
    !endShapeInfo.isExact
  ) {
    if (endShapeInfo.didIntersect && !startShapeInfo.didIntersect) {
      // ...and if only the end shape intersected, then make it
      // a short arrow ending at the end shape intersection.

      if (startShapeInfo.isClosed) {
        a.setTo(
          b.clone().add(uAB.clone().mul(MIN_ARROW_LENGTH * shape.props.scale))
        );
      }
    } else if (!endShapeInfo.didIntersect) {
      // ...and if only the end shape intersected, or if neither
      // shape intersected, then make it a short arrow starting
      // at the start shape intersection.
      if (endShapeInfo.isClosed) {
        b.setTo(
          a.clone().sub(uAB.clone().mul(MIN_ARROW_LENGTH * shape.props.scale))
        );
      }
    }
  }

  const distance = Vec.Sub(b, a);
  // Check for divide-by-zero before we call uni()
  const u = Vec.Len(distance) ? distance.uni() : Vec.From(distance);
  const didFlip = !Vec.Equals(u, uAB);

  // If the arrow is bound non-exact to a start shape and the
  // start point has an arrowhead, then offset the start point
  if (!isSelfIntersection) {
    if (
      relationship !== "start-contains-end" &&
      startShapeInfo &&
      arrowheadStart !== "none" &&
      !startShapeInfo.isExact
    ) {
      strokeOffsetA =
        STROKE_SIZES[shape.props.size] / 2 +
        ("size" in startShapeInfo.shape.props
          ? STROKE_SIZES[startShapeInfo.shape.props.size] / 2
          : 0);
      offsetA = (BOUND_ARROW_OFFSET + strokeOffsetA) * shape.props.scale;
      minLength += strokeOffsetA * shape.props.scale;
    }

    // If the arrow is bound non-exact to an end shape and the
    // end point has an arrowhead offset the end point
    if (
      relationship !== "end-contains-start" &&
      endShapeInfo &&
      arrowheadEnd !== "none" &&
      !endShapeInfo.isExact
    ) {
      strokeOffsetB =
        STROKE_SIZES[shape.props.size] / 2 +
        ("size" in endShapeInfo.shape.props
          ? STROKE_SIZES[endShapeInfo.shape.props.size] / 2
          : 0);
      offsetB = (BOUND_ARROW_OFFSET + strokeOffsetB) * shape.props.scale;
      minLength += strokeOffsetB * shape.props.scale;
    }
  }

  // Adjust offsets if the length of the arrow is too small

  const tA = a.clone().add(u.clone().mul(offsetA * (didFlip ? -1 : 1)));
  const tB = b.clone().sub(u.clone().mul(offsetB * (didFlip ? -1 : 1)));

  if (Vec.DistMin(tA, tB, minLength)) {
    if (offsetA !== 0 && offsetB !== 0) {
      // both bound + offset
      offsetA *= -1.5;
      offsetB *= -1.5;
    } else if (offsetA !== 0) {
      // start bound + offset
      offsetA *= -1;
    } else if (offsetB !== 0) {
      // end bound + offset
      offsetB *= -1;
    } else {
      // noop, its just a really short arrow
    }
  }

  a.add(u.clone().mul(offsetA * (didFlip ? -1 : 1)));
  b.sub(u.clone().mul(offsetB * (didFlip ? -1 : 1)));

  // If the handles flipped their order, then set the center handle
  // to the midpoint of the terminals (rather than the midpoint of the
  // arrow body); otherwise, it may not be "between" the other terminals.
  if (didFlip) {
    if (startShapeInfo && endShapeInfo) {
      // If we have two bound shapes...then make the arrow a short arrow from
      // the start point towards where the end point should be.
      b.setTo(Vec.Add(a, u.clone().mul(-MIN_ARROW_LENGTH * shape.props.scale)));
    }
    c.setTo(Vec.Med(terminalsInArrowSpace.start, terminalsInArrowSpace.end));
  } else {
    c.setTo(Vec.Med(a, b));
  }

  const length = Vec.Dist(a, b);

  return {
    bindings,
    isStraight: true,
    start: {
      handle: terminalsInArrowSpace.start,
      point: a,
      arrowhead: shape.props.arrowheadStart,
    },
    end: {
      handle: terminalsInArrowSpace.end,
      point: b,
      arrowhead: shape.props.arrowheadEnd,
    },
    middle: c,
    isValid: length > 0,
    length,
  };
}

function getBoundShapeInfoForTerminal(
  editor: Editor,
  arrow: RelationShape,
  terminalName: "start" | "end"
): BoundShapeInfo | undefined {
  const binding = editor
    .getBindingsFromShape<RelationBinding>(arrow, "relation")
    .find((b) => b.props.terminal === terminalName);
  if (!binding) return;

  const boundShape = editor.getShape(binding.toId)!;
  if (!boundShape) return;
  const transform = editor.getShapePageTransform(boundShape)!;
  const geometry = editor.getShapeGeometry(boundShape);

  // This is hacky: we're only looking at the first child in the group. Really the arrow should
  // consider all items in the group which are marked as snappable as separate polygons with which
  // to intersect, in the case of a group that has multiple children which do not overlap; or else
  // flatten the geometry into a set of polygons and intersect with that.
  const outline =
    geometry instanceof Group2d
      ? geometry.children[0].vertices
      : geometry.vertices;

  return {
    shape: boundShape,
    transform,
    isClosed: geometry.isClosed,
    isExact: binding.props.isExact,
    didIntersect: false,
    outline,
  };
}

function getArrowTerminalsInArrowSpace(
  editor: Editor,
  shape: RelationShape,
  bindings: RelationBindings
) {
  const arrowPageTransform = editor.getShapePageTransform(shape)!;

  const boundShapeRelationships = getBoundShapeRelationships(
    editor,
    bindings.start?.toId,
    bindings.end?.toId
  );

  const start = bindings.start
    ? getArrowTerminalInArrowSpace(
        editor,
        arrowPageTransform,
        bindings.start,
        boundShapeRelationships === "double-bound" ||
          boundShapeRelationships === "start-contains-end"
      )
    : Vec.From(shape.props.start);

  const end = bindings.end
    ? getArrowTerminalInArrowSpace(
        editor,
        arrowPageTransform,
        bindings.end,
        boundShapeRelationships === "double-bound" ||
          boundShapeRelationships === "end-contains-start"
      )
    : Vec.From(shape.props.end);

  return { start, end };
}

function updateArrowheadPointWithBoundShape(
  point: Vec,
  opposite: Vec,
  arrowPageTransform: MatModel,
  targetShapeInfo?: BoundShapeInfo
) {
  if (targetShapeInfo === undefined) {
    // No bound shape? The arrowhead point will be at the arrow terminal.
    return;
  }

  if (targetShapeInfo.isExact) {
    // Exact type binding? The arrowhead point will be at the arrow terminal.
    return;
  }

  // From and To in page space
  const pageFrom = Mat.applyToPoint(arrowPageTransform, opposite);
  const pageTo = Mat.applyToPoint(arrowPageTransform, point);

  // From and To in local space of the target shape
  const targetFrom = Mat.applyToPoint(
    Mat.Inverse(targetShapeInfo.transform),
    pageFrom
  );
  const targetTo = Mat.applyToPoint(
    Mat.Inverse(targetShapeInfo.transform),
    pageTo
  );

  const isClosed = targetShapeInfo.isClosed;
  const fn = isClosed
    ? intersectLineSegmentPolygon
    : intersectLineSegmentPolyline;

  const intersection = fn(targetFrom, targetTo, targetShapeInfo.outline);

  let targetInt: VecLike | undefined;

  if (intersection !== null) {
    targetInt =
      intersection.sort(
        (p1, p2) => Vec.Dist2(p1, targetFrom) - Vec.Dist2(p2, targetFrom)
      )[0] ?? (isClosed ? undefined : targetTo);
  }

  if (targetInt === undefined) {
    // No intersection? The arrowhead point will be at the arrow terminal.
    return;
  }

  const pageInt = Mat.applyToPoint(targetShapeInfo.transform, targetInt);
  const arrowInt = Mat.applyToPoint(Mat.Inverse(arrowPageTransform), pageInt);

  point.setTo(arrowInt);

  targetShapeInfo.didIntersect = true;
}

function getArrowTerminalInArrowSpace(
  editor: Editor,
  arrowPageTransform: Mat,
  binding: RelationBinding,
  forceImprecise: boolean
) {
  const boundShape = editor.getShape(binding.toId);

  if (!boundShape) {
    // this can happen in multiplayer contexts where the shape is being deleted
    return new Vec(0, 0);
  } else {
    // Find the actual local point of the normalized terminal on
    // the bound shape and transform it to page space, then transform
    // it to arrow space
    const { point, size } = editor.getShapeGeometry(boundShape).bounds;
    const shapePoint = Vec.Add(
      point,
      Vec.MulV(
        // if the parent is the bound shape, then it's ALWAYS precise
        binding.props.isPrecise || forceImprecise
          ? binding.props.normalizedAnchor
          : { x: 0.5, y: 0.5 },
        size
      )
    );
    const pagePoint = Mat.applyToPoint(
      editor.getShapePageTransform(boundShape)!,
      shapePoint
    );
    const arrowPoint = Mat.applyToPoint(
      Mat.Inverse(arrowPageTransform),
      pagePoint
    );
    return arrowPoint;
  }
}

function getBoundShapeRelationships(
  editor: Editor,
  startShapeId?: TLShapeId,
  endShapeId?: TLShapeId
) {
  if (!startShapeId || !endShapeId) return "safe";
  if (startShapeId === endShapeId) return "double-bound";
  const startBounds = editor.getShapePageBounds(startShapeId);
  const endBounds = editor.getShapePageBounds(endShapeId);
  if (startBounds && endBounds) {
    if (startBounds.contains(endBounds)) return "start-contains-end";
    if (endBounds.contains(startBounds)) return "end-contains-start";
  }
  return "safe";
}

interface ShapeFillProps {
  d: string;
  fill: TLDefaultFillStyle;
  color: TLDefaultColorStyle;
  theme: TLDefaultColorTheme;
  scale: number;
}
const ShapeFill = React.memo(function ShapeFill({
  theme,
  d,
  color,
  fill,
  scale,
}: ShapeFillProps) {
  switch (fill) {
    case "none": {
      return null;
    }
    case "solid": {
      return <path fill={theme[color].semi} d={d} />;
    }
    case "semi": {
      return <path fill={theme.solid} d={d} />;
    }
    case "fill": {
      return <path fill={theme[color].fill} d={d} />;
    }
    case "pattern": {
      return (
        <PatternFill
          theme={theme}
          color={color}
          fill={fill}
          d={d}
          scale={scale}
        />
      );
    }
  }
});
function PatternFill({ d, color, theme }: ShapeFillProps) {
  const editor = useEditor();
  const svgExport = useSvgExportContext();
  const zoomLevel = useValue("zoomLevel", () => editor.getZoomLevel(), [
    editor,
  ]);

  const teenyTiny = editor.getZoomLevel() <= 0.18;

  return (
    <>
      <path fill={theme[color].pattern} d={d} />
      <path
        fill={
          svgExport
            ? `url(#${getHashPatternZoomName(1, theme.id)})`
            : teenyTiny
            ? theme[color].semi
            : `url(#${getHashPatternZoomName(zoomLevel, theme.id)})`
        }
        d={d}
      />
    </>
  );
}
function getHashPatternZoomName(
  zoom: number,
  theme: TLDefaultColorTheme["id"]
) {
  const lod = getPatternLodForZoomLevel(zoom);
  return `tldraw_hash_pattern_${theme}_${lod}`;
}
function getPatternLodForZoomLevel(zoom: number) {
  return Math.ceil(Math.log2(Math.max(1, zoom)));
}
function getArrowheadPathForType(
  info: RelationInfo,
  side: "start" | "end",
  strokeWidth: number
): string | undefined {
  const type = side === "end" ? info.end.arrowhead : info.start.arrowhead;
  if (type === "none") return;

  const points = getArrowPoints(info, side, strokeWidth);
  if (!points) return;

  switch (type) {
    case "bar":
    // return getBarHead(points)
    case "square":
    // return getSquareHead(points)
    case "diamond":
    // return getDiamondHead(points)
    case "dot":
    // return getDotHead(points)
    case "inverted":
    // return getInvertedTriangleHead(points)
    case "arrow":
      return getArrowhead(points);
    case "triangle":
    // return getTriangleHead(points)
  }

  return "";
}
interface RelationArrowPointsInfo {
  point: VecLike;
  int: VecLike;
}
function getArrowPoints(
  info: RelationInfo,
  side: "start" | "end",
  strokeWidth: number
): RelationArrowPointsInfo {
  const PT = side === "end" ? info.end.point : info.start.point;
  const PB = side === "end" ? info.start.point : info.end.point;

  const compareLength = info.isStraight
    ? Vec.Dist(PB, PT)
    : Math.abs(info.bodyArc.length); // todo: arc length for curved arrows

  const length = Math.max(
    Math.min(compareLength / 5, strokeWidth * 3),
    strokeWidth
  );

  let P0: VecLike;

  if (info.isStraight) {
    P0 = Vec.Nudge(PT, PB, length);
  } else {
    const ints = intersectCircleCircle(
      PT,
      length,
      info.handleArc.center,
      info.handleArc.radius
    );
    P0 =
      side === "end"
        ? info.handleArc.sweepFlag
          ? ints[0]
          : ints[1]
        : info.handleArc.sweepFlag
        ? ints[1]
        : ints[0];
  }

  if (Vec.IsNaN(P0)) {
    P0 = info.start.point;
  }

  return {
    point: PT,
    int: P0,
  };
}
function getStraightArrowHandlePath(info: RelationInfo & { isStraight: true }) {
  return getArrowPath(info.start.handle, info.end.handle);
}
function getArrowPath(start: VecLike, end: VecLike) {
  return `M${start.x},${start.y}L${end.x},${end.y}`;
}
function getSolidStraightArrowPath(info: RelationInfo & { isStraight: true }) {
  return getArrowPath(info.start.point, info.end.point);
}

function getArrowhead({ point, int }: RelationArrowPointsInfo) {
  const PL = Vec.RotWith(int, point, PI / 6);
  const PR = Vec.RotWith(int, point, -PI / 6);

  return `M ${PL.x} ${PL.y} L ${point.x} ${point.y} L ${PR.x} ${PR.y}`;
}
function getLength(editor: Editor, shape: RelationShape): number {
  const info = getArrowInfo(editor, shape)!;

  return info.isStraight
    ? Vec.Dist(info.start.handle, info.end.handle)
    : Math.abs(info.handleArc.length);
}
function getArrowLabelSize(editor: Editor, shape: RelationShape) {
  const cachedSize = labelSizeCache.get(shape);
  if (cachedSize) return cachedSize;

  const info = getArrowInfo(editor, shape)!;
  let width = 0;
  let height = 0;

  const bodyGeom = info.isStraight
    ? new Edge2d({
        start: Vec.From(info.start.point),
        end: Vec.From(info.end.point),
      })
    : new Arc2d({
        center: Vec.Cast(info.handleArc.center),
        start: Vec.Cast(info.start.point),
        end: Vec.Cast(info.end.point),
        sweepFlag: info.bodyArc.sweepFlag,
        largeArcFlag: info.bodyArc.largeArcFlag,
      });

  if (shape.props.text.trim()) {
    const bodyBounds = bodyGeom.bounds;

    const fontSize = getArrowLabelFontSize(shape);

    const { w, h } = editor.textMeasure.measureText(shape.props.text, {
      ...TEXT_PROPS,
      fontFamily: FONT_FAMILIES[shape.props.font],
      fontSize,
      maxWidth: null,
    });

    width = w;
    height = h;

    if (bodyBounds.width > bodyBounds.height) {
      width = Math.max(Math.min(w, 64), Math.min(bodyBounds.width - 64, w));

      const { w: squishedWidth, h: squishedHeight } =
        editor.textMeasure.measureText(shape.props.text, {
          ...TEXT_PROPS,
          fontFamily: FONT_FAMILIES[shape.props.font],
          fontSize,
          maxWidth: width,
        });

      width = squishedWidth;
      height = squishedHeight;
    }

    if (width > 16 * fontSize) {
      width = 16 * fontSize;

      const { w: squishedWidth, h: squishedHeight } =
        editor.textMeasure.measureText(shape.props.text, {
          ...TEXT_PROPS,
          fontFamily: FONT_FAMILIES[shape.props.font],
          fontSize,
          maxWidth: width,
        });

      width = squishedWidth;
      height = squishedHeight;
    }
  }

  const size = new Vec(width, height).addScalar(
    ARROW_LABEL_PADDING * 2 * shape.props.scale
  );
  labelSizeCache.set(shape, size);
  return size;
}
function getStraightArrowLabelRange(
  editor: Editor,
  shape: RelationShape,
  info: Extract<RelationInfo, { isStraight: true }>
): { start: number; end: number } {
  const labelSize = getArrowLabelSize(editor, shape);
  const labelToArrowPadding = getLabelToArrowPadding(shape);

  // take the start and end points of the arrow, and nudge them in a bit to give some spare space:
  const startOffset = Vec.Nudge(
    info.start.point,
    info.end.point,
    labelToArrowPadding
  );
  const endOffset = Vec.Nudge(
    info.end.point,
    info.start.point,
    labelToArrowPadding
  );

  // assuming we just stick the label in the middle of the shape, where does the arrow intersect the label?
  const intersectionPoints = intersectLineSegmentPolygon(
    startOffset,
    endOffset,
    Box.FromCenter(info.middle, labelSize).corners
  );
  if (!intersectionPoints || intersectionPoints.length !== 2) {
    return { start: 0.5, end: 0.5 };
  }

  // there should be two intersection points - one near the start, and one near the end
  let [startIntersect, endIntersect] = intersectionPoints;
  if (
    Vec.Dist2(startIntersect, startOffset) >
    Vec.Dist2(endIntersect, startOffset)
  ) {
    [endIntersect, startIntersect] = intersectionPoints;
  }

  // take our nudged start and end points and scooch them in even further to give us the possible
  // range for the position of the _center_ of the label
  const startConstrained = startOffset.add(
    Vec.Sub(info.middle, startIntersect)
  );
  const endConstrained = endOffset.add(Vec.Sub(info.middle, endIntersect));

  // now we can work out the range of possible label positions
  const start = Vec.Dist(info.start.point, startConstrained) / info.length;
  const end = Vec.Dist(info.start.point, endConstrained) / info.length;
  return { start, end };
}
function getSolidCurvedArrowPath(info: RelationInfo & { isStraight: false }) {
  const {
    start,
    end,
    bodyArc: { radius, largeArcFlag, sweepFlag },
  } = info;
  return `M${start.point.x},${start.point.y} A${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.point.x},${end.point.y}`;
}
function getArrowLabelPosition(editor: Editor, shape: RelationShape) {
  let labelCenter;
  const debugGeom: Geometry2d[] = [];
  const info = getArrowInfo(editor, shape)!;

  const hasStartBinding = !!info.bindings.start;
  const hasEndBinding = !!info.bindings.end;
  const hasStartArrowhead = info.start.arrowhead !== "none";
  const hasEndArrowhead = info.end.arrowhead !== "none";
  if (info.isStraight) {
    const range = getStraightArrowLabelRange(editor, shape, info);
    let clampedPosition = clamp(
      shape.props.labelPosition,
      hasStartArrowhead || hasStartBinding ? range.start : 0,
      hasEndArrowhead || hasEndBinding ? range.end : 1
    );
    // This makes the position snap in the middle.
    clampedPosition =
      clampedPosition >= 0.48 && clampedPosition <= 0.52
        ? 0.5
        : clampedPosition;
    labelCenter = Vec.Lrp(info.start.point, info.end.point, clampedPosition);
  } else {
    const range = getCurvedArrowLabelRange(editor, shape, info);
    if (range.dbg) debugGeom.push(...range.dbg);
    let clampedPosition = clamp(
      shape.props.labelPosition,
      hasStartArrowhead || hasStartBinding ? range.start : 0,
      hasEndArrowhead || hasEndBinding ? range.end : 1
    );
    // This makes the position snap in the middle.
    clampedPosition =
      clampedPosition >= 0.48 && clampedPosition <= 0.52
        ? 0.5
        : clampedPosition;
    const labelAngle = interpolateArcAngles(
      Vec.Angle(info.bodyArc.center, info.start.point),
      Vec.Angle(info.bodyArc.center, info.end.point),
      Math.sign(shape.props.bend),
      clampedPosition
    );
    labelCenter = getPointOnCircle(
      info.bodyArc.center,
      info.bodyArc.radius,
      labelAngle
    );
  }

  const labelSize = getArrowLabelSize(editor, shape);

  return { box: Box.FromCenter(labelCenter, labelSize), debugGeom };
}
function getArrowLabelFontSize(shape: RelationShape) {
  return ARROW_LABEL_FONT_SIZES[shape.props.size] * shape.props.scale;
}
function getLabelToArrowPadding(shape: RelationShape) {
  const strokeWidth = STROKE_SIZES[shape.props.size];
  const labelToArrowPadding =
    (LABEL_TO_ARROW_PADDING +
      (strokeWidth - STROKE_SIZES.s) * 2 +
      (strokeWidth === STROKE_SIZES.xl ? 20 : 0)) *
    shape.props.scale;

  return labelToArrowPadding;
}
function getCurvedArrowLabelRange(
  editor: Editor,
  shape: RelationShape,
  info: Extract<RelationInfo, { isStraight: false }>
): { start: number; end: number; dbg?: Geometry2d[] } {
  const labelSize = getArrowLabelSize(editor, shape);
  const labelToArrowPadding = getLabelToArrowPadding(shape);
  const direction = Math.sign(shape.props.bend);

  // take the start and end points of the arrow, and nudge them in a bit to give some spare space:
  const labelToArrowPaddingRad =
    (labelToArrowPadding / info.handleArc.radius) * direction;
  const startOffsetAngle =
    Vec.Angle(info.bodyArc.center, info.start.point) - labelToArrowPaddingRad;
  const endOffsetAngle =
    Vec.Angle(info.bodyArc.center, info.end.point) + labelToArrowPaddingRad;
  const startOffset = getPointOnCircle(
    info.bodyArc.center,
    info.bodyArc.radius,
    startOffsetAngle
  );
  const endOffset = getPointOnCircle(
    info.bodyArc.center,
    info.bodyArc.radius,
    endOffsetAngle
  );

  const dbg: Geometry2d[] = [];

  // unlike the straight arrow, we can't just stick the label in the middle of the shape when
  // we're working out the range. this is because as the label moves along the curve, the place
  // where the arrow intersects with label changes. instead, we have to stick the label center on
  // the `startOffset` (the start-most place where it can go), then find where it intersects with
  // the arc. because of the symmetry of the label rectangle, we can move the label to that new
  // center and take that as the start-most possible point.
  const startIntersections = intersectArcPolygon(
    info.bodyArc.center,
    info.bodyArc.radius,
    startOffsetAngle,
    endOffsetAngle,
    direction,
    Box.FromCenter(startOffset, labelSize).corners
  );

  dbg.push(
    new Polygon2d({
      points: Box.FromCenter(startOffset, labelSize).corners,
      debugColor: "lime",
      isFilled: false,
      ignore: true,
    })
  );

  const endIntersections = intersectArcPolygon(
    info.bodyArc.center,
    info.bodyArc.radius,
    startOffsetAngle,
    endOffsetAngle,
    direction,
    Box.FromCenter(endOffset, labelSize).corners
  );

  dbg.push(
    new Polygon2d({
      points: Box.FromCenter(endOffset, labelSize).corners,
      debugColor: "lime",
      isFilled: false,
      ignore: true,
    })
  );
  for (const pt of [
    ...(startIntersections ?? []),
    ...(endIntersections ?? []),
    startOffset,
    endOffset,
  ]) {
    dbg.push(
      new Circle2d({
        x: pt.x - 3,
        y: pt.y - 3,
        radius: 3,
        isFilled: false,
        debugColor: "magenta",
        ignore: true,
      })
    );
  }

  // if we have one or more intersections (we shouldn't have more than two) then the one we need
  // is the one furthest from the arrow terminal
  const startConstrained =
    (startIntersections && furthest(info.start.point, startIntersections)) ??
    info.middle;
  const endConstrained =
    (endIntersections && furthest(info.end.point, endIntersections)) ??
    info.middle;

  const startAngle = Vec.Angle(info.bodyArc.center, info.start.point);
  const endAngle = Vec.Angle(info.bodyArc.center, info.end.point);
  const constrainedStartAngle = Vec.Angle(
    info.bodyArc.center,
    startConstrained
  );
  const constrainedEndAngle = Vec.Angle(info.bodyArc.center, endConstrained);

  // if the arc is small enough that there's no room for the label to move, we constrain it to the middle.
  if (
    angleDistance(startAngle, constrainedStartAngle, direction) >
    angleDistance(startAngle, constrainedEndAngle, direction)
  ) {
    return { start: 0.5, end: 0.5, dbg };
  }

  // now we can work out the range of possible label positions
  const fullDistance = angleDistance(startAngle, endAngle, direction);
  const start =
    angleDistance(startAngle, constrainedStartAngle, direction) / fullDistance;
  const end =
    angleDistance(startAngle, constrainedEndAngle, direction) / fullDistance;
  return { start, end, dbg };
}
function furthest(from: VecLike, candidates: VecLike[]): VecLike | null {
  let furthest: VecLike | null = null;
  let furthestDist = -Infinity;

  for (const candidate of candidates) {
    const dist = Vec.Dist2(from, candidate);
    if (dist > furthestDist) {
      furthest = candidate;
      furthestDist = dist;
    }
  }

  return furthest;
}
function interpolateArcAngles(
  angleStart: number,
  angleEnd: number,
  direction: number,
  t: number
) {
  const dist = angleDistance(angleStart, angleEnd, direction);
  return angleStart + dist * t * direction * -1;
}
function intersectArcPolygon(
  center: VecLike,
  radius: number,
  angleStart: number,
  angleEnd: number,
  direction: number,
  polygon: VecLike[]
) {
  const intersections = intersectCirclePolygon(center, radius, polygon);

  // filter the circle intersections to just the ones from the arc
  const fullArcDistance = angleDistance(angleStart, angleEnd, direction);
  return intersections?.filter((pt) => {
    const pDistance = angleDistance(
      angleStart,
      Vec.Angle(center, pt),
      direction
    );
    return pDistance >= 0 && pDistance <= fullArcDistance;
  });
}
function getFillDefForExport(fill: TLDefaultFillStyle): SvgExportDef {
  return {
    key: `${DefaultFontStyle.id}:${fill}`,
    getElement: async () => {
      if (fill !== "pattern") return null;

      return <HashPatternForExport />;
    },
  };
}
export function SvgTextLabel({
  fontSize,
  font,
  align,
  verticalAlign,
  text,
  labelColor,
  bounds,
  padding = 16,
  stroke = true,
}: {
  fontSize: number;
  font: TLDefaultFontStyle;
  // fill?: TLDefaultFillStyle
  align: TLDefaultHorizontalAlignStyle;
  verticalAlign: TLDefaultVerticalAlignStyle;
  wrap?: boolean;
  text: string;
  labelColor: string;
  bounds: Box;
  padding?: number;
  stroke?: boolean;
}) {
  const editor = useEditor();
  const theme = useDefaultColorTheme();

  const opts = {
    fontSize,
    fontFamily: DefaultFontFamilies[font],
    textAlign: align,
    verticalTextAlign: verticalAlign,
    width: Math.ceil(bounds.width),
    height: Math.ceil(bounds.height),
    padding,
    lineHeight: TEXT_PROPS.lineHeight,
    fontStyle: "normal",
    fontWeight: "normal",
    overflow: "wrap" as const,
    offsetX: 0,
    offsetY: 0,
    fill: labelColor,
    stroke: undefined as string | undefined,
    strokeWidth: undefined as number | undefined,
  };

  const spans = editor.textMeasure.measureTextSpans(text, opts);
  const offsetX = getLegacyOffsetX(align, padding, spans, bounds.width);
  if (offsetX) {
    opts.offsetX = offsetX;
  }

  opts.offsetX += bounds.x;
  opts.offsetY += bounds.y;

  const mainSpans = createTextJsxFromSpans(editor, spans, opts);

  let outlineSpans = null;
  if (stroke) {
    opts.fill = theme.background;
    opts.stroke = theme.background;
    opts.strokeWidth = 2;
    outlineSpans = createTextJsxFromSpans(editor, spans, opts);
  }

  return (
    <>
      {outlineSpans}
      {mainSpans}
    </>
  );
}
function getLegacyOffsetX(
  align: TLDefaultHorizontalAlignStyle | string,
  padding: number,
  spans: { text: string; box: BoxModel }[],
  totalWidth: number
): number | undefined {
  if (
    (align === "start-legacy" || align === "end-legacy") &&
    spans.length !== 0
  ) {
    const spansBounds = Box.From(spans[0].box);
    for (const { box } of spans) {
      spansBounds.union(box);
    }
    if (align === "start-legacy") {
      return (totalWidth - 2 * padding - spansBounds.width) / 2;
    } else if (align === "end-legacy") {
      return -(totalWidth - 2 * padding - spansBounds.width) / 2;
    }
  }
}
function createTextJsxFromSpans(
  editor: Editor,
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
  function correctSpacesToNbsp(input: string) {
    return input.replace(/\s/g, "\xa0");
  }
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
function getFontDefForExport(fontStyle: TLDefaultFontStyle): SvgExportDef {
  return {
    key: `${DefaultFontStyle.id}:${fontStyle}`,
    getElement: async () => {
      const font = findFont(fontStyle);
      if (!font) return null;

      const url: string = (font as any).$$_url;
      const fontFaceRule: string = (font as any).$$_fontface;
      if (!url || !fontFaceRule) return null;

      const fontFile = await (await fetch(url)).blob();
      const base64FontFile = await FileHelpers.blobToDataUrl(fontFile);

      const newFontFaceRule = fontFaceRule.replace(url, base64FontFile);
      return <style>{newFontFaceRule}</style>;
    },
  };
}
function findFont(name: TLDefaultFontStyle): FontFace | null {
  const fontFamily = DefaultFontFamilies[name];
  for (const font of document.fonts) {
    if (fontFamily.includes(font.family)) {
      return font;
    }
  }
  return null;
}
function getFillDefForCanvas(): TLShapeUtilCanvasSvgDef {
  return {
    key: `${DefaultFontStyle.id}:pattern`,
    component: PatternFillDefForCanvas,
  };
}
function findHtmlLayerParent(element: Element): HTMLElement | null {
  if (element.classList.contains("tl-html-layer"))
    return element as HTMLElement;
  if (element.parentElement) return findHtmlLayerParent(element.parentElement);
  return null;
}
const canvasBlob = (
  size: [number, number],
  fn: (ctx: CanvasRenderingContext2D) => void
) => {
  const canvas = document.createElement("canvas");
  canvas.width = size[0];
  canvas.height = size[1];
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  fn(ctx);
  return canvas.toDataURL();
};
const TILE_PATTERN_SIZE = 8;
const DefaultColorThemePalette: {
  lightMode: TLDefaultColorTheme;
  darkMode: TLDefaultColorTheme;
} = {
  lightMode: {
    id: "light",
    text: "#000000",
    background: "rgb(249, 250, 251)",
    solid: "#fcfffe",
    black: {
      solid: "#1d1d1d",
      fill: "#1d1d1d",
      note: {
        fill: "#FCE19C",
        text: "#000000",
      },
      semi: "#e8e8e8",
      pattern: "#494949",
      highlight: {
        srgb: "#fddd00",
        p3: "color(display-p3 0.972 0.8705 0.05)",
      },
    },
    blue: {
      solid: "#4465e9",
      fill: "#4465e9",
      note: {
        fill: "#8AA3FF",
        text: "#000000",
      },
      semi: "#dce1f8",
      pattern: "#6681ee",
      highlight: {
        srgb: "#10acff",
        p3: "color(display-p3 0.308 0.6632 0.9996)",
      },
    },
    green: {
      solid: "#099268",
      fill: "#099268",
      note: {
        fill: "#6FC896",
        text: "#000000",
      },
      semi: "#d3e9e3",
      pattern: "#39a785",
      highlight: {
        srgb: "#00ffc8",
        p3: "color(display-p3 0.2536 0.984 0.7981)",
      },
    },
    grey: {
      solid: "#9fa8b2",
      fill: "#9fa8b2",
      note: {
        fill: "#C0CAD3",
        text: "#000000",
      },
      semi: "#eceef0",
      pattern: "#bcc3c9",
      highlight: {
        srgb: "#cbe7f1",
        p3: "color(display-p3 0.8163 0.9023 0.9416)",
      },
    },
    "light-blue": {
      solid: "#4ba1f1",
      fill: "#4ba1f1",
      note: {
        fill: "#9BC4FD",
        text: "#000000",
      },
      semi: "#ddedfa",
      pattern: "#6fbbf8",
      highlight: {
        srgb: "#00f4ff",
        p3: "color(display-p3 0.1512 0.9414 0.9996)",
      },
    },
    "light-green": {
      solid: "#4cb05e",
      fill: "#4cb05e",
      note: {
        fill: "#98D08A",
        text: "#000000",
      },
      semi: "#dbf0e0",
      pattern: "#65cb78",
      highlight: {
        srgb: "#65f641",
        p3: "color(display-p3 0.563 0.9495 0.3857)",
      },
    },
    "light-red": {
      solid: "#f87777",
      fill: "#f87777",
      note: {
        fill: "#F7A5A1",
        text: "#000000",
      },
      semi: "#f4dadb",
      pattern: "#fe9e9e",
      highlight: {
        srgb: "#ff7fa3",
        p3: "color(display-p3 0.9988 0.5301 0.6397)",
      },
    },
    "light-violet": {
      solid: "#e085f4",
      fill: "#e085f4",
      note: {
        fill: "#DFB0F9",
        text: "#000000",
      },
      semi: "#f5eafa",
      pattern: "#e9acf8",
      highlight: {
        srgb: "#ff88ff",
        p3: "color(display-p3 0.9676 0.5652 0.9999)",
      },
    },
    orange: {
      solid: "#e16919",
      fill: "#e16919",
      note: {
        fill: "#FAA475",
        text: "#000000",
      },
      semi: "#f8e2d4",
      pattern: "#f78438",
      highlight: {
        srgb: "#ffa500",
        p3: "color(display-p3 0.9988 0.6905 0.266)",
      },
    },
    red: {
      solid: "#e03131",
      fill: "#e03131",
      note: {
        fill: "#FC8282",
        text: "#000000",
      },
      semi: "#f4dadb",
      pattern: "#e55959",
      highlight: {
        srgb: "#ff636e",
        p3: "color(display-p3 0.9992 0.4376 0.45)",
      },
    },
    violet: {
      solid: "#ae3ec9",
      fill: "#ae3ec9",
      note: {
        fill: "#DB91FD",
        text: "#000000",
      },
      semi: "#ecdcf2",
      pattern: "#bd63d3",
      highlight: {
        srgb: "#c77cff",
        p3: "color(display-p3 0.7469 0.5089 0.9995)",
      },
    },
    yellow: {
      solid: "#f1ac4b",
      fill: "#f1ac4b",
      note: {
        fill: "#FED49A",
        text: "#000000",
      },
      semi: "#f9f0e6",
      pattern: "#fecb92",
      highlight: {
        srgb: "#fddd00",
        p3: "color(display-p3 0.972 0.8705 0.05)",
      },
    },
    white: {
      solid: "#FFFFFF",
      fill: "#FFFFFF",
      semi: "#f5f5f5",
      pattern: "#f9f9f9",
      note: {
        fill: "#FFFFFF",
        text: "#000000",
      },
      highlight: {
        srgb: "#ffffff",
        p3: "color(display-p3 1 1 1)",
      },
    },
  },
  darkMode: {
    id: "dark",
    text: "hsl(210, 17%, 98%)",
    background: "hsl(240, 5%, 6.5%)",
    solid: "#010403",

    black: {
      solid: "#f2f2f2",
      fill: "#f2f2f2",
      note: {
        fill: "#2c2c2c",
        text: "#f2f2f2",
      },
      semi: "#2c3036",
      pattern: "#989898",
      highlight: {
        srgb: "#d2b700",
        p3: "color(display-p3 0.8078 0.7225 0.0312)",
      },
    },
    blue: {
      solid: "#4f72fc", // 3c60f0
      fill: "#4f72fc",
      note: {
        fill: "#2A3F98",
        text: "#f2f2f2",
      },
      semi: "#262d40",
      pattern: "#3a4b9e",
      highlight: {
        srgb: "#0079d2",
        p3: "color(display-p3 0.0032 0.4655 0.7991)",
      },
    },
    green: {
      solid: "#099268",
      fill: "#099268",
      note: {
        fill: "#014429",
        text: "#f2f2f2",
      },
      semi: "#253231",
      pattern: "#366a53",
      highlight: {
        srgb: "#009774",
        p3: "color(display-p3 0.0085 0.582 0.4604)",
      },
    },
    grey: {
      solid: "#9398b0",
      fill: "#9398b0",
      note: {
        fill: "#56595F",
        text: "#f2f2f2",
      },
      semi: "#33373c",
      pattern: "#7c8187",
      highlight: {
        srgb: "#9cb4cb",
        p3: "color(display-p3 0.6299 0.7012 0.7856)",
      },
    },
    "light-blue": {
      solid: "#4dabf7",
      fill: "#4dabf7",
      note: {
        fill: "#1F5495",
        text: "#f2f2f2",
      },
      semi: "#2a3642",
      pattern: "#4d7aa9",
      highlight: {
        srgb: "#00bdc8",
        p3: "color(display-p3 0.0023 0.7259 0.7735)",
      },
    },
    "light-green": {
      solid: "#40c057",
      fill: "#40c057",
      note: {
        fill: "#21581D",
        text: "#f2f2f2",
      },
      semi: "#2a3830",
      pattern: "#4e874e",
      highlight: {
        srgb: "#00a000",
        p3: "color(display-p3 0.2711 0.6172 0.0195)",
      },
    },
    "light-red": {
      solid: "#ff8787",
      fill: "#ff8787",
      note: {
        fill: "#923632",
        text: "#f2f2f2",
      },
      semi: "#3b3235",
      pattern: "#a56767",
      highlight: {
        srgb: "#db005b",
        p3: "color(display-p3 0.7849 0.0585 0.3589)",
      },
    },
    "light-violet": {
      solid: "#e599f7",
      fill: "#e599f7",
      note: {
        fill: "#762F8E",
        text: "#f2f2f2",
      },
      semi: "#383442",
      pattern: "#9770a9",
      highlight: {
        srgb: "#c400c7",
        p3: "color(display-p3 0.7024 0.0403 0.753)",
      },
    },
    orange: {
      solid: "#f76707",
      fill: "#f76707",
      note: {
        fill: "#843906",
        text: "#f2f2f2",
      },
      semi: "#3a2e2a",
      pattern: "#9f552d",
      highlight: {
        srgb: "#d07a00",
        p3: "color(display-p3 0.7699 0.4937 0.0085)",
      },
    },
    red: {
      solid: "#e03131",
      fill: "#e03131",
      note: {
        fill: "#89231A",
        text: "#f2f2f2",
      },
      semi: "#36292b",
      pattern: "#8f3734",
      highlight: {
        srgb: "#de002c",
        p3: "color(display-p3 0.7978 0.0509 0.2035)",
      },
    },
    violet: {
      solid: "#ae3ec9",
      fill: "#ae3ec9",
      note: {
        fill: "#681683",
        text: "#f2f2f2",
      },
      semi: "#31293c",
      pattern: "#763a8b",
      highlight: {
        srgb: "#9e00ee",
        p3: "color(display-p3 0.5651 0.0079 0.8986)",
      },
    },
    yellow: {
      solid: "#ffc034",
      fill: "#ffc034",
      note: {
        fill: "#98571B",
        text: "#f2f2f2",
      },
      semi: "#3c3934",
      pattern: "#fecb92",
      highlight: {
        srgb: "#d2b700",
        p3: "color(display-p3 0.8078 0.7225 0.0312)",
      },
    },
    white: {
      solid: "#f3f3f3",
      fill: "#f3f3f3",
      semi: "#f5f5f5",
      pattern: "#f9f9f9",
      note: {
        fill: "#eaeaea",
        text: "#1d1d1d",
      },
      highlight: {
        srgb: "#ffffff",
        p3: "color(display-p3 1 1 1)",
      },
    },
  },
};

const generateImage = (dpr: number, currentZoom: number, darkMode: boolean) => {
  return new Promise<Blob>((resolve, reject) => {
    const size = TILE_PATTERN_SIZE * currentZoom * dpr;

    const canvasEl = document.createElement("canvas");
    canvasEl.width = size;
    canvasEl.height = size;

    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = darkMode
      ? DefaultColorThemePalette.darkMode.solid
      : DefaultColorThemePalette.lightMode.solid;
    ctx.fillRect(0, 0, size, size);

    // This essentially generates an inverse of the pattern we're drawing.
    ctx.globalCompositeOperation = "destination-out";

    ctx.lineCap = "round";
    ctx.lineWidth = 1.25 * currentZoom * dpr;

    const t = 8 / 12;
    const s = (v: number) => v * currentZoom * dpr;

    ctx.beginPath();
    ctx.moveTo(s(t * 1), s(t * 3));
    ctx.lineTo(s(t * 3), s(t * 1));

    ctx.moveTo(s(t * 5), s(t * 7));
    ctx.lineTo(s(t * 7), s(t * 5));

    ctx.moveTo(s(t * 9), s(t * 11));
    ctx.lineTo(s(t * 11), s(t * 9));
    ctx.stroke();

    canvasEl.toBlob((blob) => {
      if (
        !blob
        // || debugFlags.throwToBlob.get()
      ) {
        reject();
      } else {
        resolve(blob);
      }
    });
  });
};
let defaultPixels: { white: string; black: string } | null = null;
function getDefaultPixels() {
  if (!defaultPixels) {
    defaultPixels = {
      white: canvasBlob([1, 1], (ctx) => {
        ctx.fillStyle = "#f8f9fa";
        ctx.fillRect(0, 0, 1, 1);
      }),
      black: canvasBlob([1, 1], (ctx) => {
        ctx.fillStyle = "#212529";
        ctx.fillRect(0, 0, 1, 1);
      }),
    };
  }
  return defaultPixels;
}
function getPatternLodsToGenerate(maxZoom: number) {
  const levels = [];
  const minLod = 0;
  const maxLod = getPatternLodForZoomLevel(maxZoom);
  for (let i = minLod; i <= maxLod; i++) {
    levels.push(Math.pow(2, i));
  }
  return levels;
}
function getDefaultPatterns(maxZoom: number): PatternDef[] {
  const defaultPixels = getDefaultPixels();
  return getPatternLodsToGenerate(maxZoom).flatMap((zoom) => [
    { zoom, url: defaultPixels.white, theme: "light" },
    { zoom, url: defaultPixels.black, theme: "dark" },
  ]);
}
interface PatternDef {
  zoom: number;
  url: string;
  theme: "light" | "dark";
}
function PatternFillDefForCanvas() {
  const editor = useEditor();
  const containerRef = useRef<SVGGElement>(null);
  const { defs, isReady } = usePattern();

  useEffect(() => {
    if (isReady && editor.environment.isSafari) {
      const htmlLayer = findHtmlLayerParent(containerRef.current!);
      if (htmlLayer) {
        // Wait for `patternContext` to be picked up
        editor.timers.requestAnimationFrame(() => {
          htmlLayer.style.display = "none";

          // Wait for 'display = "none"' to take effect
          editor.timers.requestAnimationFrame(() => {
            htmlLayer.style.display = "";
          });
        });
      }
    }
  }, [editor, isReady]);

  return (
    <g
      ref={containerRef}
      data-testid={isReady ? "ready-pattern-fill-defs" : undefined}
    >
      {defs}
    </g>
  );
}
function usePattern() {
  const editor = useEditor();
  const dpr = useValue(
    "devicePixelRatio",
    () => editor.getInstanceState().devicePixelRatio,
    [editor]
  );
  const maxZoom = useValue(
    "maxZoom",
    () => Math.ceil(last(editor.getCameraOptions().zoomSteps)!),
    [editor]
  );
  const [isReady, setIsReady] = useState(false);
  const [backgroundUrls, setBackgroundUrls] = useState<PatternDef[]>(() =>
    getDefaultPatterns(maxZoom)
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      setIsReady(true);
      return;
    }

    const promise = Promise.all(
      getPatternLodsToGenerate(maxZoom).flatMap<Promise<PatternDef>>((zoom) => [
        generateImage(dpr, zoom, false).then((blob) => ({
          zoom,
          theme: "light",
          url: URL.createObjectURL(blob),
        })),
        generateImage(dpr, zoom, true).then((blob) => ({
          zoom,
          theme: "dark",
          url: URL.createObjectURL(blob),
        })),
      ])
    );

    let isCancelled = false;
    promise.then((urls) => {
      if (isCancelled) return;
      setBackgroundUrls(urls);
      setIsReady(true);
    });
    return () => {
      isCancelled = true;
      setIsReady(false);
      promise.then((patterns) => {
        for (const { url } of patterns) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [dpr, maxZoom]);

  const defs = (
    <>
      {backgroundUrls.map((item) => {
        const id = getHashPatternZoomName(item.zoom, item.theme);
        return (
          <pattern
            key={id}
            id={id}
            width={TILE_PATTERN_SIZE}
            height={TILE_PATTERN_SIZE}
            patternUnits="userSpaceOnUse"
          >
            <image
              href={item.url}
              width={TILE_PATTERN_SIZE}
              height={TILE_PATTERN_SIZE}
            />
          </pattern>
        );
      })}
    </>
  );

  return { defs, isReady };
}
function last<T>(arr: readonly T[]): T | undefined {
  return arr[arr.length - 1];
}
function ArrowheadDotDef() {
  return (
    <marker
      id="arrowhead-dot"
      className="tl-arrow-hint"
      refX="3.0"
      refY="3.0"
      orient="0"
    >
      <circle cx="3" cy="3" r="2" strokeDasharray="100%" />
    </marker>
  );
}

function ArrowheadCrossDef() {
  return (
    <marker
      id="arrowhead-cross"
      className="tl-arrow-hint"
      refX="3.0"
      refY="3.0"
      orient="auto"
    >
      <line x1="1.5" y1="1.5" x2="4.5" y2="4.5" strokeDasharray="100%" />
      <line x1="1.5" y1="4.5" x2="4.5" y2="1.5" strokeDasharray="100%" />
    </marker>
  );
}
function getCurvedArrowHandlePath(info: RelationInfo & { isStraight: false }) {
  const {
    start,
    end,
    handleArc: { radius, largeArcFlag, sweepFlag },
  } = info;
  return `M${start.handle.x},${start.handle.y} A${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.handle.x},${end.handle.y}`;
}

// sneaky TLDefaultHorizontalAlignStyle for legacies
export function isLegacyAlign(
  align: TLDefaultHorizontalAlignStyle | string
): boolean {
  return (
    align === "start-legacy" ||
    align === "middle-legacy" ||
    align === "end-legacy"
  );
}

function HashPatternForExport() {
  const theme = useDefaultColorTheme();
  const t = 8 / 12;
  return (
    <>
      <mask id="hash_pattern_mask">
        <rect x="0" y="0" width="8" height="8" fill="white" />
        <g strokeLinecap="round" stroke="black">
          <line x1={t * 1} y1={t * 3} x2={t * 3} y2={t * 1} />
          <line x1={t * 5} y1={t * 7} x2={t * 7} y2={t * 5} />
          <line x1={t * 9} y1={t * 11} x2={t * 11} y2={t * 9} />
        </g>
      </mask>
      <pattern
        id={getHashPatternZoomName(1, theme.id)}
        width="8"
        height="8"
        patternUnits="userSpaceOnUse"
      >
        <rect
          x="0"
          y="0"
          width="8"
          height="8"
          fill={theme.solid}
          mask="url(#hash_pattern_mask)"
        />
      </pattern>
    </>
  );
}

export class BaseDiscourseRelationUtil extends ShapeUtil<RelationShape> {
  static override type = "relation" as const;
  static override props = arrowShapeProps;
  // static override migrations = arrowShapeMigrations

  override canEdit = () => true;
  override canBind({
    toShapeType,
  }: TLShapeUtilCanBindOpts<RelationShape>): boolean {
    // bindings can go from arrows to shapes, but not from shapes to arrows
    return toShapeType !== "relation";
  }
  override canSnap = () => false;
  override hideResizeHandles: TLShapeUtilFlag<RelationShape> = () => true;
  override hideRotateHandle: TLShapeUtilFlag<RelationShape> = () => true;
  override hideSelectionBoundsBg: TLShapeUtilFlag<RelationShape> = () => true;
  override hideSelectionBoundsFg: TLShapeUtilFlag<RelationShape> = () => true;

  override canBeLaidOut: TLShapeUtilFlag<RelationShape> = (shape) => {
    return false;
  };

  override getDefaultProps(): RelationShape["props"] {
    return {
      dash: "draw",
      size: "m",
      fill: "none",
      color: "black",
      labelColor: "black",
      bend: 0,
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 },
      arrowheadStart: "none",
      arrowheadEnd: "arrow",
      text: "654",
      labelPosition: 0.5,
      font: "draw",
      scale: 1,
    };
  }

  getGeometry(shape: RelationShape) {
    const info = getArrowInfo(this.editor, shape)!;

    const debugGeom: Geometry2d[] = [];

    const bodyGeom = info.isStraight
      ? new Edge2d({
          start: Vec.From(info.start.point),
          end: Vec.From(info.end.point),
        })
      : new Arc2d({
          center: Vec.Cast(info.handleArc.center),
          start: Vec.Cast(info.start.point),
          end: Vec.Cast(info.end.point),
          sweepFlag: info.bodyArc.sweepFlag,
          largeArcFlag: info.bodyArc.largeArcFlag,
        });

    let labelGeom;
    if (shape.props.text.trim()) {
      const labelPosition = getArrowLabelPosition(this.editor, shape);
      debugGeom.push(...labelPosition.debugGeom);
      labelGeom = new Rectangle2d({
        x: labelPosition.box.x,
        y: labelPosition.box.y,
        width: labelPosition.box.w,
        height: labelPosition.box.h,
        isFilled: true,
        isLabel: true,
      });
    }

    return new Group2d({
      children: [
        ...(labelGeom ? [bodyGeom, labelGeom] : [bodyGeom]),
        ...debugGeom,
      ],
    });
  }

  override getHandles(shape: RelationShape): TLHandle[] {
    const info = getArrowInfo(this.editor, shape)!;

    return [
      {
        id: ARROW_HANDLES.START,
        type: "vertex",
        index: "a0",
        x: info.start.handle.x,
        y: info.start.handle.y,
      },
      {
        id: ARROW_HANDLES.MIDDLE,
        type: "virtual",
        index: "a2",
        x: info.middle.x,
        y: info.middle.y,
      },
      {
        id: ARROW_HANDLES.END,
        type: "vertex",
        index: "a3",
        x: info.end.handle.x,
        y: info.end.handle.y,
      },
    ].filter(Boolean) as TLHandle[];
  }

  component(shape: RelationShape) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const theme = useDefaultColorTheme();
    const onlySelectedShape = this.editor.getOnlySelectedShape();
    const shouldDisplayHandles =
      this.editor.isInAny(
        "select.idle",
        "select.pointing_handle",
        "select.dragging_handle",
        "select.translating",
        "arrow.dragging"
      ) && !this.editor.getInstanceState().isReadonly;

    const info = getArrowInfo(this.editor, shape);
    if (!info?.isValid) return null;

    const labelPosition = getArrowLabelPosition(this.editor, shape);
    const isSelected = shape.id === this.editor.getOnlySelectedShapeId();
    const isEditing = this.editor.getEditingShapeId() === shape.id;
    const showArrowLabel = isEditing || shape.props.text;

    return (
      <>
        <SVGContainer id={shape.id} style={{ minWidth: 50, minHeight: 50 }}>
          <ArrowSvg
            shape={shape}
            shouldDisplayHandles={
              shouldDisplayHandles && onlySelectedShape?.id === shape.id
            }
          />
        </SVGContainer>
        {showArrowLabel && (
          <TextLabel
            id={shape.id}
            classNamePrefix="tl-arrow"
            type="relation"
            font={shape.props.font}
            fontSize={getArrowLabelFontSize(shape)}
            lineHeight={TEXT_PROPS.lineHeight}
            align="middle"
            verticalAlign="middle"
            text={shape.props.text}
            labelColor={theme[shape.props.labelColor].solid}
            textWidth={labelPosition.box.w}
            isSelected={isSelected}
            padding={0}
            style={{
              transform: `translate(${labelPosition.box.center.x}px, ${labelPosition.box.center.y}px)`,
              // transform: `translate(${100}px, ${100}px)`,
            }}
          />
        )}
      </>
    );
  }

  indicator(shape: RelationShape) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isEditing = useIsEditing(shape.id);

    const info = getArrowInfo(this.editor, shape);
    if (!info) return null;

    const { start, end } = getArrowTerminalsInArrowSpace(
      this.editor,
      shape,
      info?.bindings
    );
    const geometry = this.editor.getShapeGeometry<Group2d>(shape);
    const bounds = geometry.bounds;

    const labelGeometry = shape.props.text.trim()
      ? (geometry.children[1] as Rectangle2d)
      : null;

    if (Vec.Equals(start, end)) return null;

    const strokeWidth = STROKE_SIZES[shape.props.size] * shape.props.scale;

    const as =
      info.start.arrowhead &&
      getArrowheadPathForType(info, "start", strokeWidth);
    const ae =
      info.end.arrowhead && getArrowheadPathForType(info, "end", strokeWidth);

    const path = info.isStraight
      ? getSolidStraightArrowPath(info)
      : getSolidCurvedArrowPath(info);

    const includeMask =
      (as && info.start.arrowhead !== "arrow") ||
      (ae && info.end.arrowhead !== "arrow") ||
      !!labelGeometry;

    const maskId = (shape.id + "_clip").replace(":", "_");

    if (isEditing && labelGeometry) {
      return (
        <rect
          x={toDomPrecision(labelGeometry.x)}
          y={toDomPrecision(labelGeometry.y)}
          width={labelGeometry.w}
          height={labelGeometry.h}
          rx={3.5 * shape.props.scale}
          ry={3.5 * shape.props.scale}
        />
      );
    }

    return (
      <g>
        {includeMask && (
          <defs>
            <mask id={maskId}>
              <rect
                x={bounds.minX - 100}
                y={bounds.minY - 100}
                width={bounds.w + 200}
                height={bounds.h + 200}
                fill="white"
              />
              {labelGeometry && (
                <rect
                  x={toDomPrecision(labelGeometry.x)}
                  y={toDomPrecision(labelGeometry.y)}
                  width={labelGeometry.w}
                  height={labelGeometry.h}
                  fill="black"
                  rx={3.5 * shape.props.scale}
                  ry={3.5 * shape.props.scale}
                />
              )}
              {as && (
                <path
                  d={as}
                  fill={info.start.arrowhead === "arrow" ? "none" : "black"}
                  stroke="none"
                />
              )}
              {ae && (
                <path
                  d={ae}
                  fill={info.end.arrowhead === "arrow" ? "none" : "black"}
                  stroke="none"
                />
              )}
            </mask>
          </defs>
        )}
        {/* firefox will clip if you provide a maskURL even if there is no mask matching that URL in the DOM */}
        <g {...(includeMask ? { mask: `url(#${maskId})` } : undefined)}>
          {/* This rect needs to be here if we're creating a mask due to an svg quirk on Chrome */}
          {includeMask && (
            <rect
              x={bounds.minX - 100}
              y={bounds.minY - 100}
              width={bounds.width + 200}
              height={bounds.height + 200}
              opacity={0}
            />
          )}

          <path d={path} />
        </g>
        {as && <path d={as} />}
        {ae && <path d={ae} />}
        {labelGeometry && (
          <rect
            x={toDomPrecision(labelGeometry.x)}
            y={toDomPrecision(labelGeometry.y)}
            width={labelGeometry.w}
            height={labelGeometry.h}
            rx={3.5}
            ry={3.5}
          />
        )}
      </g>
    );
  }

  override onEditEnd: TLOnEditEndHandler<RelationShape> = (shape) => {
    const {
      id,
      type,
      props: { text },
    } = shape;

    if (text.trimEnd() !== shape.props.text) {
      this.editor.updateShapes<RelationShape>([
        {
          id,
          type,
          props: {
            text: text.trimEnd(),
          },
        },
      ]);
    }
  };

  override toSvg(shape: RelationShape, ctx: SvgExportContext) {
    ctx.addExportDef(getFillDefForExport(shape.props.fill));
    if (shape.props.text)
      ctx.addExportDef(getFontDefForExport(shape.props.font));
    const theme = getDefaultColorTheme(ctx);
    const scaleFactor = 1 / shape.props.scale;

    return (
      <g transform={`scale(${scaleFactor})`}>
        <ArrowSvg shape={shape} shouldDisplayHandles={false} />
        <SvgTextLabel
          fontSize={getArrowLabelFontSize(shape)}
          font={shape.props.font}
          align="middle"
          verticalAlign="middle"
          text={shape.props.text}
          labelColor={theme[shape.props.labelColor].solid}
          bounds={getArrowLabelPosition(this.editor, shape).box}
          padding={4 * shape.props.scale}
        />
      </g>
    );
  }

  override getCanvasSvgDefs(): TLShapeUtilCanvasSvgDef[] {
    return [
      getFillDefForCanvas(),
      {
        key: `arrow:dot`,
        component: ArrowheadDotDef,
      },
      {
        key: `arrow:cross`,
        component: ArrowheadCrossDef,
      },
    ];
  }
}

const ArrowSvg = track(function ArrowSvg({
  shape,
  shouldDisplayHandles,
}: {
  shape: RelationShape;
  shouldDisplayHandles: boolean;
}) {
  const editor = useEditor();
  const theme = useDefaultColorTheme();
  const info = getArrowInfo(editor, shape);
  const bounds = Box.ZeroFix(editor.getShapeGeometry(shape).bounds);
  const bindings = getArrowBindings(editor, shape);

  const changeIndex = React.useMemo<number>(() => {
    return editor.environment.isSafari ? (globalRenderIndex += 1) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape]);

  if (!info?.isValid) return null;

  const strokeWidth = STROKE_SIZES[shape.props.size] * shape.props.scale;

  const as =
    info.start.arrowhead && getArrowheadPathForType(info, "start", strokeWidth);
  const ae =
    info.end.arrowhead && getArrowheadPathForType(info, "end", strokeWidth);

  const path = info.isStraight
    ? getSolidStraightArrowPath(info)
    : getSolidCurvedArrowPath(info);

  let handlePath: null | React.ReactNode = null;

  if (shouldDisplayHandles) {
    const sw = 2 / editor.getZoomLevel();
    const { strokeDasharray, strokeDashoffset } = getPerfectDashProps(
      getLength(editor, shape),
      sw,
      {
        end: "skip",
        start: "skip",
        lengthRatio: 2.5,
      }
    );

    handlePath =
      bindings.start || bindings.end ? (
        <path
          className="tl-arrow-hint"
          d={
            info.isStraight
              ? getStraightArrowHandlePath(info)
              : getCurvedArrowHandlePath(info)
          }
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeWidth={sw}
          markerStart={
            bindings.start
              ? bindings.start.props.isExact
                ? ""
                : bindings.start.props.isPrecise
                ? "url(#arrowhead-cross)"
                : "url(#arrowhead-dot)"
              : ""
          }
          markerEnd={
            bindings.end
              ? bindings.end.props.isExact
                ? ""
                : bindings.end.props.isPrecise
                ? "url(#arrowhead-cross)"
                : "url(#arrowhead-dot)"
              : ""
          }
          opacity={0.16}
        />
      ) : null;
  }

  const { strokeDasharray, strokeDashoffset } = getPerfectDashProps(
    info.isStraight ? info.length : Math.abs(info.bodyArc.length),
    strokeWidth,
    {
      style: shape.props.dash,
    }
  );

  const labelPosition = getArrowLabelPosition(editor, shape);

  const maskStartArrowhead = !(
    info.start.arrowhead === "none" || info.start.arrowhead === "arrow"
  );
  const maskEndArrowhead = !(
    info.end.arrowhead === "none" || info.end.arrowhead === "arrow"
  );

  // NOTE: I know right setting `changeIndex` hacky-as right! But we need this because otherwise safari loses
  // the mask, see <https://linear.app/tldraw/issue/TLD-1500/changing-arrow-color-makes-line-pass-through-text>
  const maskId = (shape.id + "_clip_" + changeIndex).replace(":", "_");

  return (
    <>
      {/* Yep */}
      <defs>
        <mask id={maskId}>
          <rect
            x={toDomPrecision(-100 + bounds.minX)}
            y={toDomPrecision(-100 + bounds.minY)}
            width={toDomPrecision(bounds.width + 200)}
            height={toDomPrecision(bounds.height + 200)}
            fill="white"
          />
          {shape.props.text.trim() && (
            <rect
              x={labelPosition.box.x}
              y={labelPosition.box.y}
              width={labelPosition.box.w}
              height={labelPosition.box.h}
              fill="black"
              rx={4}
              ry={4}
            />
          )}
          {as && maskStartArrowhead && (
            <path
              d={as}
              fill={info.start.arrowhead === "arrow" ? "none" : "black"}
              stroke="none"
            />
          )}
          {ae && maskEndArrowhead && (
            <path
              d={ae}
              fill={info.end.arrowhead === "arrow" ? "none" : "black"}
              stroke="none"
            />
          )}
        </mask>
      </defs>
      <g
        fill="none"
        stroke={theme[shape.props.color].solid}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        pointerEvents="none"
      >
        {handlePath}
        {/* firefox will clip if you provide a maskURL even if there is no mask matching that URL in the DOM */}
        <g mask={`url(#${maskId})`}>
          <rect
            x={toDomPrecision(bounds.minX - 100)}
            y={toDomPrecision(bounds.minY - 100)}
            width={toDomPrecision(bounds.width + 200)}
            height={toDomPrecision(bounds.height + 200)}
            opacity={0}
          />
          <path
            d={path}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
          />
        </g>
        {as && maskStartArrowhead && shape.props.fill !== "none" && (
          <ShapeFill
            theme={theme}
            d={as}
            color={shape.props.color}
            fill={shape.props.fill}
            scale={shape.props.scale}
          />
        )}
        {ae && maskEndArrowhead && shape.props.fill !== "none" && (
          <ShapeFill
            theme={theme}
            d={ae}
            color={shape.props.color}
            fill={shape.props.fill}
            scale={shape.props.scale}
          />
        )}
        {as && <path d={as} />}
        {ae && <path d={ae} />}
      </g>
    </>
  );
});
