import {
  TLBaseBinding,
  TLArrowBindingProps,
  BindingUtil,
  arrowBindingProps,
  arrowBindingMigrations,
  BindingOnCreateOptions,
  BindingOnChangeOptions,
  BindingOnShapeChangeOptions,
  BindingOnShapeIsolateOptions,
  Editor,
  TLArcInfo,
  TLArrowPoint,
  VecLike,
  IndexKey,
  TLArrowShape,
  TLParentId,
  TLShape,
  TLShapeId,
  getIndexAbove,
  getIndexBetween,
} from "tldraw";
import { RelationShape, getArrowBindings } from "./DiscourseRelationUtil";

export type RelationBindings = {
  start: RelationBinding | undefined;
  end: RelationBinding | undefined;
};

export type RelationInfo =
  | {
      bindings: RelationBindings;
      isStraight: false;
      start: TLArrowPoint;
      end: TLArrowPoint;
      middle: VecLike;
      handleArc: TLArcInfo;
      bodyArc: TLArcInfo;
      isValid: boolean;
    }
  | {
      bindings: RelationBindings;
      isStraight: true;
      start: TLArrowPoint;
      end: TLArrowPoint;
      middle: VecLike;
      isValid: boolean;
      length: number;
    };

export type RelationBinding = TLBaseBinding<"relation", TLArrowBindingProps>;
export class ArrowBindingUtil extends BindingUtil<RelationBinding> {
  static override type = "relation";

  static override props = arrowBindingProps;
  static override migrations = arrowBindingMigrations;

  override getDefaultProps(): Partial<TLArrowBindingProps> {
    return {
      isPrecise: false,
      isExact: false,
      normalizedAnchor: { x: 0.5, y: 0.5 },
    };
  }

  // when the binding itself changes
  override onAfterCreate({
    binding,
  }: BindingOnCreateOptions<RelationBinding>): void {
    arrowDidUpdate(
      this.editor,
      this.editor.getShape(binding.fromId) as RelationShape
    );
  }

  // when the binding itself changes
  override onAfterChange({
    bindingAfter,
  }: BindingOnChangeOptions<RelationBinding>): void {
    arrowDidUpdate(
      this.editor,
      this.editor.getShape(bindingAfter.fromId) as RelationShape
    );
  }

  // when the arrow itself changes
  override onAfterChangeFromShape({
    shapeAfter,
  }: BindingOnShapeChangeOptions<RelationBinding>): void {
    arrowDidUpdate(this.editor, shapeAfter as RelationShape);
  }

  // when the shape an arrow is bound to changes
  // override onAfterChangeToShape({ binding }: BindingOnShapeChangeOptions<RelationBinding>): void {
  // reparentArrow(this.editor, binding.fromId)
  // }

  // when the arrow is isolated we need to update it's x,y positions
  override onBeforeIsolateFromShape({
    binding,
  }: BindingOnShapeIsolateOptions<RelationBinding>): void {
    const arrow = this.editor.getShape<RelationShape>(binding.fromId);
    if (!arrow) return;
    console.log("deleted arrow");
    this.editor.deleteShape(arrow.id); // we don't want to keep the arrow

    // updateArrowTerminal({
    // editor: this.editor,
    // arrow,
    // terminal: binding.props.terminal,
    // })
  }
}

function arrowDidUpdate(editor: Editor, arrow: RelationShape) {
  const bindings = getArrowBindings(editor, arrow);
  // if the shape is an arrow and its bound shape is on another page
  // or was deleted, unbind it
  for (const handle of ["start", "end"] as const) {
    const binding = bindings[handle];
    if (!binding) continue;
    const boundShape = editor.getShape(binding.toId);
    const isShapeInSamePageAsArrow =
      editor.getAncestorPageId(arrow) === editor.getAncestorPageId(boundShape);
    if (!boundShape || !isShapeInSamePageAsArrow) {
      console.log("deleted arrow");
      editor.deleteShape(arrow.id); // we don't want to keep the arrow
      // updateArrowTerminal({ editor, arrow, terminal: handle, unbind: true });
    }
  }

  // always check the arrow parents
  reparentArrow(editor, arrow.id);
}
function reparentArrow(editor: Editor, arrowId: TLShapeId) {
  const arrow = editor.getShape<RelationShape>(arrowId);
  if (!arrow) return;
  const bindings = getArrowBindings(editor, arrow);
  const { start, end } = bindings;
  const startShape = start ? editor.getShape(start.toId) : undefined;
  const endShape = end ? editor.getShape(end.toId) : undefined;

  const parentPageId = editor.getAncestorPageId(arrow);
  if (!parentPageId) return;

  let nextParentId: TLParentId;
  if (startShape && endShape) {
    // if arrow has two bindings, always parent arrow to closest common ancestor of the bindings
    nextParentId =
      editor.findCommonAncestor([startShape, endShape]) ?? parentPageId;
  } else if (startShape || endShape) {
    const bindingParentId = (startShape || endShape)?.parentId;
    // If the arrow and the shape that it is bound to have the same parent, then keep that parent
    if (bindingParentId && bindingParentId === arrow.parentId) {
      nextParentId = arrow.parentId;
    } else {
      // if arrow has one binding, keep arrow on its own page
      nextParentId = parentPageId;
    }
  } else {
    return;
  }

  if (nextParentId && nextParentId !== arrow.parentId) {
    editor.reparentShapes([arrowId], nextParentId);
  }

  const reparentedArrow = editor.getShape<TLArrowShape>(arrowId);
  if (!reparentedArrow) throw Error("no reparented arrow");

  const startSibling = getShapeNearestSibling(
    editor,
    reparentedArrow,
    startShape
  );
  const endSibling = getShapeNearestSibling(editor, reparentedArrow, endShape);

  let highestSibling: TLShape | undefined;

  if (startSibling && endSibling) {
    highestSibling =
      startSibling.index > endSibling.index ? startSibling : endSibling;
  } else if (startSibling && !endSibling) {
    highestSibling = startSibling;
  } else if (endSibling && !startSibling) {
    highestSibling = endSibling;
  } else {
    return;
  }

  let finalIndex: IndexKey;

  const higherSiblings = editor
    .getSortedChildIdsForParent(highestSibling.parentId)
    .map((id) => editor.getShape(id)!)
    .filter((sibling) => sibling.index > highestSibling!.index);

  if (higherSiblings.length) {
    // there are siblings above the highest bound sibling, we need to
    // insert between them.

    // if the next sibling is also a bound arrow though, we can end up
    // all fighting for the same indexes. so lets find the next
    // non-arrow sibling...
    const nextHighestNonArrowSibling = higherSiblings.find(
      (sibling) => sibling.type !== "arrow"
    );

    if (
      // ...then, if we're above the last shape we want to be above...
      reparentedArrow.index > highestSibling.index &&
      // ...but below the next non-arrow sibling...
      (!nextHighestNonArrowSibling ||
        reparentedArrow.index < nextHighestNonArrowSibling.index)
    ) {
      // ...then we're already in the right place. no need to update!
      return;
    }

    // otherwise, we need to find the index between the highest sibling
    // we want to be above, and the next highest sibling we want to be
    // below:
    finalIndex = getIndexBetween(highestSibling.index, higherSiblings[0].index);
  } else {
    // if there are no siblings above us, we can just get the next index:
    finalIndex = getIndexAbove(highestSibling.index);
  }

  if (finalIndex !== reparentedArrow.index) {
    editor.updateShapes<TLArrowShape>([
      { id: arrowId, type: "arrow", index: finalIndex },
    ]);
  }
}

function getShapeNearestSibling(
  editor: Editor,
  siblingShape: TLShape,
  targetShape: TLShape | undefined
): TLShape | undefined {
  if (!targetShape) {
    return undefined;
  }
  if (targetShape.parentId === siblingShape.parentId) {
    return targetShape;
  }

  const ancestor = editor.findShapeAncestor(
    targetShape,
    (ancestor) => ancestor.parentId === siblingShape.parentId
  );

  return ancestor;
}
