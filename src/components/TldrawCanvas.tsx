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
} from "@tldraw/tldraw";
import {
  Button,
  Classes,
  Dialog,
  // Icon,
  // InputGroup,
  Intent,
  // Position,
  Spinner,
  SpinnerSize,
  TextArea,
  // Tooltip,
} from "@blueprintjs/core";
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
  RoamBasicNode,
} from "roamjs-components/types";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import createPage from "roamjs-components/writes/createPage";
import fireQuery from "../utils/fireQuery";
import getDiscourseNodes, { DiscourseNode } from "../utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "../utils/getDiscourseRelations";
import fuzzy from "fuzzy";
import { useValue } from "signia-react";
import { RoamOverlayProps } from "roamjs-components/util/renderOverlay";
import findDiscourseNode from "../utils/findDiscourseNode";
import getBlockProps, { json, normalizeProps } from "../utils/getBlockProps";
import { QBClause, Result } from "../utils/types";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import renderToast from "roamjs-components/components/Toast";
import triplesToBlocks from "../utils/triplesToBlocks";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getDiscourseContextResults from "../utils/getDiscourseContextResults";
import { StoreSnapshot } from "@tldraw/tlstore";
import setInputSetting from "roamjs-components/util/setInputSetting";
import ContrastColor from "contrast-color";

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

const discourseContext: {
  nodes: Record<string, DiscourseNode & { index: number }>;
  relations: DiscourseRelation[];
} = { nodes: {}, relations: [] };

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

// TODO: consolidate with DiscourseNodeMenu and replace with Smartblocks
const createDiscourseNode = async ({
  type,
  uid,
  text,
  nodes = Object.values(discourseContext.nodes),
}: {
  type: string;
  uid?: string;
  text: string;
  nodes?: DiscourseNode[];
}) => {
  const nodeTree = getFullTreeByParentUid(type).children;
  const template = getSubTree({
    tree: nodeTree,
    key: "template",
  }).children;
  const stripUid = (n: RoamBasicNode[]): InputTextNode[] =>
    n.map(({ uid, children, ...c }) => ({
      ...c,
      children: stripUid(children),
    }));
  const tree = template.length ? stripUid(template) : [{ text: "" }];
  const specification = nodes.find((n) => n.type === type)?.specification;
  if (
    specification?.find(
      (spec) => spec.type === "clause" && spec.relation === "is in page"
    )
  ) {
    return await createBlock({
      parentUid: window.roamAlphaAPI.util.dateToPageUid(new Date()),
      node: { text, uid },
    });
  } else {
    return await createPage({
      title: text,
      uid,
      tree,
    });
  }
};

type NodeDialogProps = {
  label: string;
  onSuccess: (a: Result) => Promise<void>;
  onCancel: () => void;
  nodeType: string;
  initialUid: string;
};

const LabelDialog = ({
  isOpen,
  onClose,
  label: _label,
  onSuccess,
  onCancel,
  nodeType,
  initialUid,
}: RoamOverlayProps<NodeDialogProps>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [options, setOptions] = useState<Result[]>([]);
  const initialLabel = useMemo(() => {
    if (_label) return _label;
    const { specification, text } = discourseContext.nodes[nodeType];
    if (!specification.length) return "";
    // CURRENT ASSUMPTIONS:
    // - conditions are properly ordered
    // - there is a has title condition somewhere
    const titleCondition = specification.find(
      (s): s is QBClause =>
        s.type === "clause" && s.relation === "has title" && s.source === text
    );
    if (!titleCondition) return "";
    return titleCondition.target
      .replace(/^\/(\^)?/, "")
      .replace(/(\$)?\/$/, "")
      .replace(/\\\[/g, "[")
      .replace(/\\\]/g, "]")
      .replace(/\(\.[\*\+](\?)?\)/g, "");
  }, [_label, nodeType]);
  const initialValue = useMemo(() => {
    return { text: initialLabel, uid: initialUid };
  }, [initialLabel, initialUid]);
  const [label, setLabel] = useState(initialValue.text);
  const [uid, setUid] = useState(initialValue.uid);
  const [loading, setLoading] = useState(false);
  const onSubmit = () => {
    setLoading(true);
    onSuccess({ text: label, uid })
      .then(onClose)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  const onCancelClick = () => {
    onCancel();
    onClose();
  };
  useEffect(() => {
    const conditionUid = window.roamAlphaAPI.util.generateUID();
    fireQuery({
      returnNode: "node",
      selections: [],
      conditions: [
        {
          source: "node",
          relation: "is a",
          target: nodeType,
          uid: conditionUid,
          type: "clause",
        },
      ],
    }).then((results) => setOptions(results));
  }, [nodeType, setOptions]);
  const touchRef = useRef<EventTarget | null>();
  useEffect(() => {
    const { current } = containerRef;
    if (!current) return;
    const touchStartListener = (e: TouchEvent) => {
      if (!!(e.target as HTMLElement)?.closest(".roamjs-autocomplete-input"))
        return;
      touchRef.current = e.target;
    };
    const touchEndListener = (e: TouchEvent) => {
      if (
        touchRef.current === e.target &&
        e.target !== null &&
        !current.contains(e.target as HTMLElement)
      ) {
        onCancelClick();
      }
    };
    document.body.addEventListener("touchstart", touchStartListener);
    document.body.addEventListener("touchend", touchEndListener);
    return () => {
      document.body.removeEventListener("touchstart", touchStartListener);
      document.body.removeEventListener("touchend", touchEndListener);
    };
  }, [containerRef, onCancelClick, touchRef]);
  const setValue = React.useCallback(
    (r: Result) => {
      setLabel(r.text);
      setUid(r.uid);
    },
    [setLabel, setUid]
  );
  const onNewItem = React.useCallback(
    (text: string) => ({ text, uid: initialUid }),
    [initialUid]
  );
  const itemToQuery = React.useCallback(
    (result?: Result) => result?.text || "",
    []
  );
  const filterOptions = React.useCallback(
    (o: Result[], q: string) =>
      fuzzy
        .filter(q, o, { extract: itemToQuery })
        .map((f) => f.original)
        .filter((f): f is Result => !!f),
    [itemToQuery]
  );
  return (
    <>
      <Dialog
        isOpen={isOpen}
        title={"Edit Discourse Node Label"}
        onClose={onCancelClick}
        canOutsideClickClose
        canEscapeKeyClose
        autoFocus={false}
        className={"roamjs-discourse-playground-dialog"}
      >
        <div
          className={Classes.DIALOG_BODY}
          ref={containerRef}
          // TODO - this was an attempt to fix a bug related to the dialog reappearing after
          // closing by pressing enter. Still doesn't fix it however - document keyup handler
          // is still being called which then sets the editing id to the current shape, reopening
          // the dialog
          onKeyDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            e.nativeEvent.stopPropagation();
          }}
          onKeyUp={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            e.nativeEvent.stopPropagation();
          }}
        >
          <AutocompleteInput
            value={initialValue}
            setValue={setValue}
            onConfirm={onSubmit}
            options={options}
            multiline
            autoFocus
            onNewItem={onNewItem}
            itemToQuery={itemToQuery}
            filterOptions={filterOptions}
          />
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div
            className={`${Classes.DIALOG_FOOTER_ACTIONS} items-center flex-row-reverse`}
          >
            <Button
              text={"Set"}
              intent={Intent.PRIMARY}
              onClick={onSubmit}
              onTouchEnd={onSubmit}
              disabled={loading}
              className="flex-shrink-0"
            />
            <Button
              text={"Cancel"}
              onClick={onCancelClick}
              onTouchEnd={onCancelClick}
              disabled={loading}
              className="flex-shrink-0"
            />
            <span className={"text-red-800 flex-grow"}>{error}</span>
            {loading && <Spinner size={SpinnerSize.SMALL} />}
          </div>
        </div>
      </Dialog>
    </>
  );
};

type DiscourseNodeShape = TLBaseShape<
  string,
  {
    w: number;
    h: number;
    opacity: TLOpacityType;
    uid: string;
    title: string;
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
const COLOR_ARRAY = Array.from(TL_COLOR_TYPES);
const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 64;

const DEFAULT_STYLE_PROPS = {
  ...TEXT_PROPS,
  fontSize: FONT_SIZES.m,
  fontFamily: FONT_FAMILIES.sans,
  width: "fit-content",
  maxWidth: "400px",
  padding: "16px",
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
      opacity: "1",
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
      relationIds = new Set(discourseContext.relations.map((r) => r.id)),
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
      relationIds = new Set(discourseContext.relations.map((r) => r.id)),
      finalUid = shape.props.uid,
    }: {
      allRecords?: TLRecord[];
      relationIds?: Set<string>;
      finalUid?: string;
    } = {}
  ) {
    const nodes = Object.values(discourseContext.nodes);
    const nodeIds = new Set(nodes.map((n) => n.type));
    const nodesInView = Object.fromEntries(
      allRecords
        .filter((r): r is DiscourseNodeShape => {
          return r.typeName === "shape" && nodeIds.has(r.type);
        })
        .map((r) => [r.props.uid, r] as const)
    );
    const results = await getDiscourseContextResults({
      uid: finalUid,
      nodes: Object.values(discourseContext.nodes),
      relations: discourseContext.relations,
    });
    const toCreate = results
      .flatMap((r) =>
        Object.entries(r.results)
          .filter(([k, v]) => nodesInView[k] && v.id && relationIds.has(v.id))
          .map(([k, v]) => ({
            relationId: v.id!,
            complement: v.complement,
            nodeId: k,
          }))
      )
      .map(({ relationId, complement, nodeId }) => {
        return {
          id: createShapeId(),
          type: relationId,
          props: complement
            ? {
                start: {
                  type: "binding",
                  boundShapeId: nodesInView[nodeId].id,
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
                  boundShapeId: nodesInView[nodeId].id,
                  normalizedAnchor: { x: 0.5, y: 0.5 },
                  isExact: false,
                },
              },
        };
      });
    this.app.createShapes(toCreate);
  }

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
    const backgroundInfo = backgroundColor
      ? { backgroundColor, backgroundCss: backgroundColor }
      : {
          backgroundColor: COLOR_PALETTE[paletteColor],
          backgroundCss: `var(--palette-${paletteColor})`,
        };
    const textColor = ContrastColor.contrastColor({ bgColor: backgroundColor });
    return { ...backgroundInfo, textColor };
  }

  render(shape: DiscourseNodeShape) {
    const { canvasSettings: { alias = "" } = {} } =
      discourseContext.nodes[this.type] || {};
    const isEditing = useValue(
      "isEditing",
      () => this.app.editingId === shape.id,
      [this.app, shape.id]
    );
    useEffect(() => {
      if (!shape.props.title) {
        this.app.setEditingId(shape.id);
      }
    }, [shape.props.title, shape.id]);
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
        setLoaded(shape.props.uid);
      }
    }, [setLoaded, loaded, contentRef, shape.props.uid]);
    const { backgroundCss, textColor } = this.getColors();
    return (
      <HTMLContainer
        id={shape.id}
        className="flex items-center justify-center pointer-events-auto rounded-2xl roamjs-tldraw-node"
        style={{
          background: backgroundCss,
          color: textColor,
        }}
      >
        <div className="px-8 py-2" style={{ pointerEvents: "all" }}>
          <div ref={contentRef} style={DEFAULT_STYLE_PROPS}>
            {alias
              ? new RegExp(alias).exec(shape.props.title)?.[1] ||
                shape.props.title
              : shape.props.title}
          </div>
          {isEditing && (
            <LabelDialog
              initialUid={shape.props.uid}
              isOpen={true}
              onClose={() => {
                this.app.setEditingId(null);
              }}
              label={shape.props.title}
              nodeType={this.type}
              onSuccess={async ({ text, uid }) => {
                // If we get a new uid, all the necessary updates happen below
                if (shape.props.uid === uid) {
                  if (shape.props.title) {
                    if (shape.props.title === text) {
                      // nothing to update I think
                      return;
                    } else {
                      if (isPageUid(shape.props.uid))
                        await window.roamAlphaAPI.updatePage({
                          page: {
                            uid: shape.props.uid,
                            title: text,
                          },
                        });
                      else await updateBlock({ uid: shape.props.uid, text });
                    }
                  } else if (!getPageUidByPageTitle(text)) {
                    createDiscourseNode({
                      type: shape.type,
                      text,
                      uid,
                    });
                  }
                }

                const allRecords = this.app.store.allRecords();
                const relationIds = new Set(
                  discourseContext.relations.map((r) => r.id)
                );
                this.deleteRelationsInCanvas(shape, {
                  allRecords,
                  relationIds,
                });
                const { w, h } = this.app.textMeasure.measureText({
                  ...DEFAULT_STYLE_PROPS,
                  text,
                });
                this.updateProps(shape.id, {
                  title: text,
                  uid,
                  w,
                  h,
                });
                await this.createExistingRelations(shape, {
                  allRecords,
                  relationIds,
                  finalUid: uid,
                });
              }}
              onCancel={() => {
                if (!isLiveBlock(shape.props.uid)) {
                  this.app.deleteShapes([shape.id]);
                }
              }}
            />
          )}
        </div>
      </HTMLContainer>
    );
  }

  toSvg(shape: DiscourseNodeShape) {
    const { backgroundColor, textColor } = this.getColors();
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", shape.props.w.toString());
    rect.setAttribute("height", shape.props.h.toString());
    rect.setAttribute("fill", backgroundColor);
    rect.setAttribute("opacity", shape.props.opacity);
    rect.setAttribute("rx", "16");
    rect.setAttribute("ry", "16");
    g.appendChild(rect);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const padding = Number(DEFAULT_STYLE_PROPS.padding.replace("px", ""));
    const textWidth = Math.min(
      shape.props.w - padding * 2,
      Number(DEFAULT_STYLE_PROPS.maxWidth.replace("px", ""))
    );
    const textX = (shape.props.w / 2 - textWidth / 2).toString();
    text.setAttribute("x", textX.toString());
    text.setAttribute("font-family", "sans-serif");
    text.setAttribute("font-size", DEFAULT_STYLE_PROPS.fontSize + "px");
    text.setAttribute("font-weight", DEFAULT_STYLE_PROPS.fontWeight);
    text.setAttribute("stroke", textColor);
    text.setAttribute("stroke-width", "1");
    const words = shape.props.title.split(/\s/g);
    let line = "";
    let lineCount = 0;
    const lineHeight =
      DEFAULT_STYLE_PROPS.lineHeight * DEFAULT_STYLE_PROPS.fontSize;
    const addTspan = () => {
      const tspan = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "tspan"
      );
      tspan.setAttribute("x", textX);
      tspan.setAttribute("dy", lineHeight.toString());
      tspan.textContent = line;
      text.appendChild(tspan);
      lineCount++;
    };
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = line + word + " ";
      const testWidth = this.app.textMeasure.measureText({
        ...DEFAULT_STYLE_PROPS,
        text: testLine,
      }).w;
      if (testWidth > textWidth) {
        addTspan();
        line = word + " ";
      } else {
        line = testLine;
      }
    }
    if (line) {
      addTspan();
    }
    text.setAttribute(
      "y",
      (shape.props.h / 2 - (lineHeight * lineCount) / 2).toString()
    );
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

class DiscourseRelationUtil extends TLArrowUtil<DiscourseRelationShape> {
  constructor(app: TldrawApp, type: string) {
    super(app, type);
  }
  override canBind = () => true;
  override canEdit = () => false;
  defaultProps() {
    // TODO - add canvas settings to relations config and turn
    // discourseContext.relations into a map
    const relationIndex = discourseContext.relations.findIndex(
      (r) => r.id === this.type
    );
    const isValid =
      relationIndex >= 0 && relationIndex < discourseContext.relations.length;
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
      text: isValid ? discourseContext.relations[relationIndex].label : "",
      font: "mono" as const,
    };
  }
  override onBeforeCreate = (shape: DiscourseRelationShape) => {
    // TODO - propsForNextShape is clobbering our choice of color
    const relationIndex = discourseContext.relations.findIndex(
      (r) => r.id === this.type
    );
    const isValid =
      relationIndex >= 0 && relationIndex < discourseContext.relations.length;
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
  const allRelations = useMemo(
    () => (discourseContext.relations = getDiscourseRelations()),
    []
  );
  // TODO: We need to stop splitting a single relation into multiple. Supporting OR solves this.
  const allRelationsById = useMemo(
    () => Object.fromEntries(allRelations.map((r) => [r.id, r])),
    [allRelations]
  );
  const allRelationIds = useMemo(() => {
    return Object.keys(allRelationsById);
  }, [allRelations]);
  const allNodes = useMemo(() => {
    const allNodes = getDiscourseNodes(allRelations);
    discourseContext.nodes = Object.fromEntries(
      allNodes.map((n, index) => [n.type, { ...n, index }])
    );
    return allNodes;
  }, [allRelations]);
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
            allRelationIds.map(
              (id) =>
                class extends TLArrowTool {
                  static id = id;
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
                          const { source } = allRelationsById[id];
                          if (source !== info.shape.type) {
                            const sourceLabel =
                              discourseContext.nodes[source].text;
                            return cancelAndWarn(
                              `Starting node must be of type ${sourceLabel}`
                            );
                          }
                          this.parent.transition("pointing", info);
                        };
                      },
                      Pointing,
                    ];
                  };
                  shapeType = id;
                  override styles = ["opacity" as const];
                }
            )
          )
          .concat([
            class extends TLSelectTool {
              // @ts-ignore
              static children: typeof TLSelectTool.children = () => {
                return TLSelectTool.children().map((c) => {
                  if (c.id === "dragging_handle") {
                    const Handle = c as unknown as typeof DraggingHandle;
                    return class extends Handle {
                      override onPointerUp: TLPointerEvent = (info) => {
                        this.onComplete({
                          type: "misc",
                          name: "complete",
                        });
                        const arrow = this.app.getShapeById(this.shapeId);
                        if (!arrow) return;
                        const relation = discourseContext.relations.find(
                          (r) => r.id === arrow.type
                        );
                        if (!relation) return;
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
                        );
                        if (!source) {
                          return deleteAndWarn("Failed to find source node.");
                        }
                        const target = this.app.getShapeById(end.boundShapeId);
                        if (!target) {
                          return deleteAndWarn("Failed to find target node.");
                        }
                        const sourceLabel =
                          discourseContext.nodes[relation.source].text;
                        if (source.type !== relation.source) {
                          return deleteAndWarn(
                            `Source node must be of type ${sourceLabel}`
                          );
                        }
                        const targetLabel =
                          discourseContext.nodes[relation.destination].text;
                        if (target.type !== relation.destination) {
                          return deleteAndWarn(
                            `Target node must be of type ${targetLabel}`
                          );
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
        ],
        allowUnknownShapes: true,
      }),
    [allNodes, allRelationIds, allRelationsById]
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
        // we need this bc Roam doesn't update edit/user or edit/time when we just edit block/props
        await setInputSetting({
          blockUid: pageUid,
          key: "timestamp",
          value: new Date().valueOf().toString(),
        });
        window.roamAlphaAPI.updateBlock({
          block: {
            uid: pageUid,
            props: {
              ...props,
              ["roamjs-query-builder"]: {
                ...rjsqb,
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
        const newState = rjsqb?.tldraw as Parameters<
          typeof store.deserialize
        >[0];
        const editingUser = (after?.[":block/children"] || []).find(
          (b) => b[":block/string"] === "timestamp"
        )?.[":block/children"]?.[0]?.[":edit/user"]?.[":db/id"];
        if (!newState || !editingUser) return;
        const editingUserUid = window.roamAlphaAPI.pull(
          "[:user/uid]",
          editingUser
        )?.[":user/uid"];
        if (
          !editingUserUid ||
          TLUser.createCustomId(editingUserUid) === initialState.userId
        )
          return;
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
  useEffect(() => {
    const actionListener = ((
      e: CustomEvent<{
        action: string;
        uid: string;
        val: string;
        onRefresh: () => void;
      }>
    ) => {
      if (!/canvas/i.test(e.detail.action)) return;
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
      const nodeType = findDiscourseNode(e.detail.uid, allNodes);
      if (nodeType) {
        app.createShapes([
          {
            type: nodeType.type,
            id: createShapeId(),
            props: {
              uid: e.detail.uid,
              title: e.detail.val,
            },
            ...position,
          },
        ]);
        lastInsertRef.current = position;
        e.detail.onRefresh();
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
  return (
    <div
      className={`border border-gray-300 rounded-md bg-white h-full w-full z-10 overflow-hidden ${
        maximized ? "absolute inset-0" : "relative"
      }`}
      id={`roamjs-tldraw-canvas-container`}
      ref={containerRef}
      tabIndex={-1}
    >
      <style>{`.roam-article .rm-block-children {
  display: none;
}${
        maximized
          ? "div.roam-body div.roam-app div.roam-main div.roam-article { position: inherit; }"
          : ""
      }`}</style>
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
            if (
              e.shiftKey &&
              e.shape &&
              e.shape.props?.uid &&
              e.name === "pointer_up"
            ) {
              if (!isLiveBlock(e.shape.props.uid)) {
                // TODO - it shouldn't be possible to shift click a discourse node that isn't a live block - turn into a warning instead
                if (!e.shape.props.title) {
                  return;
                }
                createDiscourseNode({
                  uid: e.shape.props.uid,
                  text: e.shape.props.title,
                  type: e.shape.type,
                });
              }
              openBlockInSidebar(e.shape.props.uid);
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
                  allRelationIds.map((id) => [
                    `shape.relation.${id}`,
                    allRelationsById[id].label,
                  ])
                ),
                "action.toggle-full-screen": "Toggle Full Screen",
                "action.convert-to-block": "Convert to Block",
              },
            },
            contextMenu(app, schema, helpers) {
              if (helpers.oneSelected) {
                const shape = app.getShapeById(app.selectedIds[0]);
                if (!shape) return schema;
                const convertToBlock = async (text: string) => {
                  const uid = await createDiscourseNode({
                    type: "blck-node",
                    text,
                  });
                  const { x, y } = shape;
                  app.deleteShapes([shape.id]);
                  app.createShapes([
                    {
                      type: "blck-node",
                      id: createShapeId(),
                      props: {
                        uid,
                        title: text,
                      },
                      x,
                      y,
                    },
                  ]);
                };
                const onSelect =
                  shape?.type === "image"
                    ? async () => {
                        const { assetId } = (shape as TLImageShape).props;
                        if (!assetId) return;
                        const asset = app.getAssetById(assetId);
                        if (!asset || !asset.props.src) return;
                        const file = await fetch(asset.props.src)
                          .then((r) => r.arrayBuffer())
                          .then((buf) => new File([buf], shape.id));
                        // @ts-ignore
                        const src = await window.roamAlphaAPI.util.uploadFile({
                          // @ts-ignore
                          file,
                        });
                        console.log(src);
                        convertToBlock(`![](${src})`);
                      }
                    : shape?.type === "text"
                    ? () => {
                        const { text } = (shape as TLTextShape).props;
                        convertToBlock(text);
                      }
                    : null;
                if (onSelect)
                  schema.push({
                    id: "convert-to-block",
                    type: "item",
                    actionItem: {
                      label: "action.convert-to-block" as TLTranslationKey,
                      id: "convert-to-block",
                      onSelect,
                      readonlyOk: true,
                    },
                    checked: false,
                    disabled: false,
                    readonlyOk: true,
                  });
              }
              return schema;
            },
            actions(_app, actions) {
              actions["toggle-full-screen"] = {
                id: "toggle-full-screen",
                label: "action.toggle-full-screen" as TLTranslationKey,
                kbd: "!3",
                onSelect: () => {
                  setMaximized(!maximized);
                },
                readonlyOk: true,
              };
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
                      node.canvasSettings.color ||
                      `var(--palette-${COLOR_ARRAY[index]})`,
                  },
                };
              });
              allRelationIds.forEach((relation, index) => {
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
              return tools;
            },
            toolbar(_app, toolbar, { tools }) {
              toolbar.push(
                ...allNodes.map((n) => toolbarItem(tools[n.type])),
                ...allRelationIds.map((id) => toolbarItem(tools[id]))
              );
              return toolbar;
            },
            keyboardShortcutsMenu(_app, keyboardShortcutsMenu, { tools }) {
              const toolsGroup = keyboardShortcutsMenu.find(
                (group) => group.id === "shortcuts-dialog.tools"
              ) as MenuGroup;
              toolsGroup.children.push(
                ...allNodes.map((n) => menuItem(tools[n.type]))
              );
              return keyboardShortcutsMenu;
            },
            menu(_app, menu) {
              const mainMenu = menu.find(
                (m): m is MenuGroup => m.type === "group" && m.id === "menu"
              );
              if (mainMenu) {
                const viewSubMenu = mainMenu.children.find(
                  (m): m is SubMenu => m.type === "submenu" && m.id === "view"
                );
                if (viewSubMenu) {
                  const viewActionsGroup = viewSubMenu.children.find(
                    (m): m is MenuGroup =>
                      m.type === "group" && m.id === "view-actions"
                  );
                  if (viewActionsGroup) {
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
                  }
                }
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

export const renderTldrawCanvas = (title: string) => {
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
      <TldrawCanvas title={title} previewEnabled={isFlagEnabled("preview")} />,
      parent
    );
  }
};

export default TldrawCanvas;
