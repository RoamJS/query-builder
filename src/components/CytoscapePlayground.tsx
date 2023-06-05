import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type cytoscape from "cytoscape";
import {
  Button,
  Classes,
  Dialog,
  Icon,
  InputGroup,
  Intent,
  Position,
  Tooltip,
} from "@blueprintjs/core";
import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import type { InputTextNode, RoamBasicNode } from "roamjs-components/types";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import updateBlock from "roamjs-components/writes/updateBlock";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import { render as renderToast } from "roamjs-components/components/Toast";
import setInputSetting from "roamjs-components/util/setInputSetting";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import LivePreview, { Props as LivePreviewProps } from "./LivePreview";
import { render as exportRender } from "./ExportDialog";
import triplesToBlocks from "../utils/triplesToBlocks";
import { renderLoading } from "roamjs-components/components/Loading";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import getSubTree from "roamjs-components/util/getSubTree";
import navigator from "cytoscape-navigator";
import Filter, { Filters } from "roamjs-components/components/Filter";
import DiscourseContextOverlay from "./DiscourseContextOverlay";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import isControl from "roamjs-components/util/isControl";
import PageInput from "roamjs-components/components/PageInput";
import getDiscourseContextResults from "../utils/getDiscourseContextResults";
import getDiscourseNodes from "../utils/getDiscourseNodes";
import getDiscourseRelations from "../utils/getDiscourseRelations";
import matchDiscourseNode from "../utils/matchDiscourseNode";
import getDiscourseRelationTriples from "../utils/getDiscourseRelationTriples";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import extractRef from "roamjs-components/util/extractRef";
import fireQuery from "../utils/fireQuery";
import { QBGlobalRefs } from "../utils/types";

if (window.RoamLazy) window.RoamLazy.Cytoscape().then(navigator);
const editCursor =
  "https://raw.githubusercontent.com/dvargas92495/roamjs-discourse-graph/main/src/cursors/edit.png";
const trashCursor =
  "https://raw.githubusercontent.com/dvargas92495/roamjs-discourse-graph/main/src/cursors/trash.png";

type NodeDialogProps = {
  node: cytoscape.NodeSingular;
  nodeType: string;
};

type EdgeDialogProps = {
  edge: cytoscape.EdgeSingular;
  nodeTypeByColor: Record<string, string>;
};

const maxZoom = 5;
const minZoom = 0.25;

const AliasDialog = ({
  onClose,
  node,
}: {
  onClose: () => void;
} & NodeDialogProps) => {
  const defaultValue = useMemo(() => node.data("alias"), [node]);
  const [alias, setAlias] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const onSubmit = () => {
    setLoading(false);
    const blockUid = node.data("id");
    if (alias) {
      node.data("alias", alias);
      setInputSetting({ blockUid, value: alias, key: "alias" }).then(onClose);
    } else {
      node.data("alias", node.data("label"));
      deleteBlock(getSubTree({ key: "alias", parentUid: blockUid }).uid).then(
        onClose
      );
    }
  };
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.altKey &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        onSubmit();
      }
      e.stopPropagation();
    },
    [onSubmit, onClose, alias]
  );
  return (
    <>
      <Dialog
        isOpen={true}
        title={"Alias Playground Node"}
        onClose={onClose}
        canOutsideClickClose
        canEscapeKeyClose
        autoFocus={false}
        className={"roamjs-discourse-playground-dialog"}
      >
        <div className={Classes.DIALOG_BODY} onKeyDown={onKeyDown}>
          <InputGroup
            defaultValue={defaultValue}
            onChange={(e) => setAlias(e.target.value)}
          />
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button text={"Cancel"} onClick={onClose} disabled={loading} />
            <Button
              text={"Set"}
              intent={Intent.PRIMARY}
              onClick={onSubmit}
              disabled={loading}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
};

const editLabel = async (node: cytoscape.NodeSingular, value: string) => {
  const blockUid = node.id();
  if (node.data("label") === node.data("alias")) {
    node.data("alias", value);
    setInputSetting({ blockUid, key: "alias", value });
  }
  node.data("label", value);
};

const LabelDialog = ({
  onClose,
  node,
  nodeType,
}: {
  onClose: () => void;
} & NodeDialogProps) => {
  const [label, setLabel] = useState(node.data("label"));
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const onSubmit = () => {
    setLoading(false);
    editLabel(node, label);
    updateBlock({ uid: node.id(), text: label }).then(onClose);
  };
  useEffect(() => {
    if (nodeType !== TEXT_TYPE) {
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
      }).then((results) => setOptions(results.map((r) => r.text)));
    }
  }, [nodeType]);
  return (
    <>
      <Dialog
        isOpen={true}
        title={"Edit Playground Node Label"}
        onClose={onClose}
        canOutsideClickClose
        canEscapeKeyClose
        autoFocus={false}
        className={"roamjs-discourse-playground-dialog"}
      >
        <div className={Classes.DIALOG_BODY}>
          {nodeType !== TEXT_TYPE ? (
            <AutocompleteInput
              value={label}
              setValue={setLabel}
              onConfirm={onSubmit}
              options={options}
              multiline
            />
          ) : (
            <PageInput
              value={label}
              setValue={setLabel}
              onConfirm={onSubmit}
              multiline
            />
          )}
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button text={"Cancel"} onClick={onClose} disabled={loading} />
            <Button
              text={"Set"}
              intent={Intent.PRIMARY}
              onClick={onSubmit}
              disabled={loading}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
};

const EdgeDialog = ({
  onClose,
  edge,
  nodeTypeByColor,
}: {
  onClose: () => void;
} & EdgeDialogProps) => {
  const allRelationTriples = useMemo(getDiscourseRelationTriples, []);
  const filteredRelations = useMemo(() => {
    const sourceColor = edge.source().data("color");
    const targetColor = edge.target().data("color");
    return allRelationTriples
      .filter((k) => {
        if (sourceColor === TEXT_COLOR || targetColor === TEXT_COLOR) {
          return true;
        }
        return (
          k.source === nodeTypeByColor[sourceColor] &&
          k.target === nodeTypeByColor[targetColor]
        );
      })
      .map((r) => r.relation);
  }, [allRelationTriples, edge, nodeTypeByColor]);
  const [label, setLabel] = useState(edge.data("label"));
  const [loading, setLoading] = useState(false);
  const onSubmit = () => {
    setLoading(false);
    edge.data("label", label);
    updateBlock({ uid: edge.id(), text: label }).then(onClose);
  };
  return (
    <>
      <Dialog
        isOpen={true}
        title={"Edit Playground Node Label"}
        onClose={onClose}
        canOutsideClickClose
        canEscapeKeyClose
      >
        <div className={Classes.DIALOG_BODY}>
          <AutocompleteInput
            value={label}
            setValue={setLabel}
            onConfirm={onSubmit}
            options={filteredRelations}
          />
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button text={"Cancel"} onClick={onClose} disabled={loading} />
            <Button
              text={"Set"}
              intent={Intent.PRIMARY}
              onClick={onSubmit}
              disabled={loading}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
};

const NodeIcon = ({
  shortcut,
  color,
  onClick,
}: {
  shortcut: string;
  color: string;
  onClick?: () => void;
}) => (
  <Button
    minimal
    onClick={onClick}
    style={{ maxWidth: 30 }}
    icon={
      <span
        style={{
          height: 16,
          width: 16,
          borderRadius: "50%",
          backgroundColor: `#${color}`,
          color: "#EEEEEE",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          margin: "0 2px",
        }}
        onClick={onClick}
      >
        {shortcut}
      </span>
    }
  />
);

type Props = {
  title: string;
  previewEnabled: boolean;
  globalRefs: QBGlobalRefs;
};

const useTreeFieldUid = ({
  tree,
  parentUid,
  field,
}: {
  parentUid: string;
  field: string;
  tree: RoamBasicNode[];
}) =>
  useMemo(() => {
    const node = tree.find((t) => toFlexRegex(field).test(t.text));
    const children = node?.children || [];
    if (node?.uid) {
      return [node?.uid, children] as const;
    }
    const newUid = window.roamAlphaAPI.util.generateUID();
    createBlock({ node: { text: field, uid: newUid }, parentUid });
    return [newUid, children] as const;
  }, [tree, field, parentUid]);

const COLORS = [
  "8b0000",
  "9b870c",
  "008b8b",
  "00008b",
  "8b008b",
  "85200c",
  "ee7600",
  "008b00",
  "26428B",
  "2f062f",
  "b80000",
  "b978c0",
  "00b8b8",
  "0000b8",
  "b800b8",
  "5802c0",
  "ee6700",
  "00b800",
  "6224B8",
  "f260f2",
];
const TEXT_COLOR = "888888";
const TEXT_TYPE = "&TEX-node";
const SELECTION_MODES = [
  { id: "EDIT", tooltip: "Edit", icon: "edit", shortcut: "e" },
  { id: "CONNECT", tooltip: "Draw Edge", icon: "git-branch", shortcut: "c" },
  { id: "DELETE", tooltip: "Delete", icon: "delete", shortcut: "d" },
  { id: "ALIAS", tooltip: "Alias", icon: "application", shortcut: "a" },
] as const;
type SelectionMode = typeof SELECTION_MODES[number]["id"];

const getCyElementFromRoamNode = async ({
  text,
  uid,
  children = [],
}: RoamBasicNode) => {
  const {
    position,
    x: legacyX = "0",
    y: legacyY = "0",
    color = TEXT_COLOR,
    alias,
    source,
    target,
    ...data
  } = Object.fromEntries(
    children.map(({ text, children = [] }) => [text, children[0]?.text])
  );
  const isEdge = !!(source && target);
  const label = text || "Click to edit text";
  const pos = isEdge
    ? ""
    : position ||
      (await Promise.resolve(`${legacyX},${legacyY}`).then((value) =>
        setInputSetting({ blockUid: uid, key: "position", value }).then(
          () => value
        )
      ));
  const [x, y] = pos.split(",").map((c) => Number(c.trim()));
  return isEdge
    ? {
        data: {
          id: uid,
          source,
          target,
          label,
          ...data,
        },
      }
    : {
        data: {
          alias: alias || label,
          label,
          color,
          id: uid,
          ...data,
        },
        position: { x, y },
      };
};

const CytoscapePlayground = ({
  title,
  previewEnabled,
  globalRefs,
  ...exportRenderProps
}: Props) => {
  const watches = useRef(
    new Set<{
      pullPattern: string;
      entityId: string;
      onWatch: Parameters<typeof window.roamAlphaAPI.data.addPullWatch>[2];
    }>()
  );
  const registerPullWatch = useCallback<
    typeof window.roamAlphaAPI.data.addPullWatch
  >(
    (pullPattern, entityId, onWatch) => {
      window.roamAlphaAPI.data.addPullWatch(pullPattern, entityId, onWatch);
      watches.current.add({
        pullPattern,
        entityId,
        onWatch,
      });
      return true;
    },
    [watches]
  );
  const addUidWatch = useCallback(
    (uid: string, callback: (s: string) => void) => {
      const onWatch: Parameters<
        typeof window.roamAlphaAPI.data.addPullWatch
      >[2] = (_, a) => {
        callback(a?.[":block/string"] || "");
      };
      const pullPattern = `[:block/string]`;
      const entityId = `[:block/uid "${uid}"]`;
      registerPullWatch(pullPattern, entityId, onWatch);
    },
    [registerPullWatch]
  );
  const pageUid = useMemo(() => getPageUidByPageTitle(title), [title]);
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowInputRef = useRef<HTMLInputElement>(null);
  const cyRef = useRef<cytoscape.Core>();
  const sourceRef = useRef<cytoscape.NodeSingular>();
  const allRelations = useMemo(getDiscourseRelations, []);
  const allNodes = useMemo(
    () => getDiscourseNodes(allRelations),
    [allRelations]
  );
  const coloredNodes = useMemo(
    () =>
      allNodes
        .map((n, i) => ({
          color: COLORS[i % COLORS.length],
          ...n,
        }))
        .concat({
          color: TEXT_COLOR,
          text: "Text",
          shortcut: "T",
          type: TEXT_TYPE,
          format: "{content}",
          specification: [],
          backedBy: "default",
          canvasSettings: {},
        }),
    []
  );
  const nodeTypeByColor = useMemo(
    () => Object.fromEntries(coloredNodes.map((cn) => [cn.color, cn.type])),
    [coloredNodes]
  );
  const nodeTextByColor = useMemo(
    () => Object.fromEntries(coloredNodes.map((cn) => [cn.color, cn.text])),
    [coloredNodes]
  );
  const nodeFormatTextByType = useMemo(
    () =>
      Object.fromEntries(
        coloredNodes.map((cn) => [cn.type, cn.format.replace("{content}", "")])
      ),
    [coloredNodes]
  );
  const [selectedNode, setSelectedNode] = useState(
    coloredNodes[coloredNodes.length - 1]
  );
  const [filters, setFilters] = useState<Filters>({
    includes: { nodes: new Set(), edges: new Set() },
    excludes: { nodes: new Set(), edges: new Set() },
  });
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const nodeColorRef = useRef(selectedNode.color);
  const clearSourceRef = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.style("border-width", 0);
      sourceRef.current.unlock();
      sourceRef.current = undefined;
    }
  }, [sourceRef]);
  const allRelationTriples = useMemo(getDiscourseRelationTriples, []);
  const tree = useMemo(() => getBasicTreeByParentUid(pageUid), [pageUid]);
  const [elementsUid, elementsChildren] = useTreeFieldUid({
    tree,
    parentUid: pageUid,
    field: "elements",
  });
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(
    SELECTION_MODES[0].id
  );
  const selectionModeRef = useRef(selectionMode);
  const edgeCallback = useCallback(
    (edge: cytoscape.EdgeSingular) => {
      edge.on("click", (e) => {
        if ((e.originalEvent.target as HTMLElement).tagName !== "CANVAS") {
          return;
        }
        clearSourceRef();
        if (selectionModeRef.current === "DELETE") {
          deleteBlock(edge.id());
          cyRef.current?.remove(edge);
        } else {
          createOverlayRender<EdgeDialogProps>(
            "playground-edge",
            EdgeDialog
          )({
            edge,
            nodeTypeByColor,
          });
        }
      });
      addUidWatch(edge.id(), (text) =>
        typeof text === "undefined" ? edge.remove() : edge.data("label", text)
      );
    },
    [clearSourceRef, nodeTypeByColor, cyRef, selectionModeRef]
  );
  const [livePreviewTag, setLivePreviewTag] = useState("");
  const registerMouseEvents = useCallback<
    LivePreviewProps["registerMouseEvents"]
  >(
    ({ open, close, span }) => {
      const register = (cy: cytoscape.Core) => {
        if (!span) return;
        const root = span.closest<HTMLSpanElement>(".bp3-popover-wrapper");
        if (root) root.style.position = "absolute";
        cy.on("mousemove", (e) => {
          if (e.target === cy && cy.scratch("roamjs_preview_tag")) {
            cy.scratch("roamjs_preview_tag", "");
          }
          const tag = cy.scratch("roamjs_preview_tag");
          const isOpen = cy.scratch("roamjs_preview");

          if (isOpen && !tag) {
            cy.scratch("roamjs_preview", false);
            close();
          } else if (tag) {
            const { x1, y1 } = cy.extent();
            const zoom = cy.zoom();
            if (root) {
              root.style.top = `${(e.position.y - y1) * zoom}px`;
              root.style.left = `${(e.position.x - x1) * zoom}px`;
            }
            setLivePreviewTag(tag);
            if (!isOpen) {
              cy.scratch("roamjs_preview", true);
              open(e.originalEvent.ctrlKey);
            }
          }
        });
      };
      if (cyRef.current) register(cyRef.current);
      else if (containerRef.current)
        containerRef.current.addEventListener("cytoscape:loaded", () =>
          register(cyRef.current!)
        );
    },
    [cyRef, containerRef]
  );
  const drawEdge = useCallback(
    ({ text, ...rest }: { text: string; source: string; target: string }) =>
      createBlock({
        node: {
          text,
          children: Object.entries(rest).map(([k, v]) => ({
            text: k,
            children: [{ text: v }],
          })),
        },
        parentUid: elementsUid,
      }).then((id) => {
        const edge = cyRef.current?.add({
          data: { id, label: text, ...rest },
        })!;
        edgeCallback(edge);
      }),
    [edgeCallback, cyRef]
  );
  const [overlaysShown, setOverlaysShown] = useState(false);
  const overlaysShownRef = useRef(false);
  const [nodeOverlays, setNodeOverlays] = useState<
    Record<string, { top: number; left: number; label: string }>
  >({});
  const refreshNodeOverlays = useCallback(() => {
    if (cyRef.current)
      setNodeOverlays(
        Object.fromEntries(
          cyRef.current
            .nodes()
            .filter((t) => t.data("color") !== TEXT_COLOR)
            .filter((t) => t.style("display") === "element")
            .map((n) => [
              `roamjs-cytoscape-node-overlay-${n.id()}`,
              {
                label: n.data("label"),
                ...getStyle(n as cytoscape.NodeSingular),
              },
            ])
        )
      );
  }, [setNodeOverlays, cyRef]);
  useEffect(() => {
    overlaysShownRef.current = overlaysShown;
    if (overlaysShown) refreshNodeOverlays();
    else setNodeOverlays({});
  }, [overlaysShown, refreshNodeOverlays, setNodeOverlays, overlaysShownRef]);
  const nodeInitCallback = useCallback(
    (n: cytoscape.NodeSingular) => {
      n.style("background-color", `#${n.data("color")}`);
      n.on("click", (e) => {
        if ((e.originalEvent.target as HTMLElement).tagName !== "CANVAS") {
          return;
        }
        if (e.originalEvent.shiftKey) {
          const title = n.data("label");
          const uid = getPageUidByPageTitle(title);
          (uid ? Promise.resolve(uid) : createPage({ title })).then((uid) =>
            openBlockInSidebar(uid)
          );
        } else if (selectionModeRef.current === "ALIAS") {
          clearSourceRef();
          createOverlayRender<NodeDialogProps>(
            "playground-alias",
            AliasDialog
          )({
            node: n,
            nodeType: nodeTypeByColor[n.data("color")],
          });
        } else if (selectionModeRef.current === "DELETE") {
          clearSourceRef();
          deleteBlock(n.id());
          n.connectedEdges().forEach((edge) => {
            deleteBlock(edge.id());
          });
          cyRef.current?.remove(n);
          if (overlaysShownRef.current) refreshNodeOverlays();
        } else if (selectionModeRef.current === "CONNECT") {
          if (sourceRef.current) {
            const source = sourceRef.current.id();
            const target = n.id();
            if (source !== target) {
              const sourceType =
                nodeTypeByColor[sourceRef.current.data("color")];
              const targetType = nodeTypeByColor[n.data("color")];
              const text =
                allRelationTriples.find(
                  (r) => r.source === sourceType && r.target === targetType
                )?.relation ||
                (sourceType === TEXT_TYPE || targetType === TEXT_TYPE
                  ? allRelationTriples[0].relation
                  : "");
              if (text) {
                drawEdge({ text, source, target });
              } else {
                renderToast({
                  id: "roamjs-discourse-relation-error",
                  intent: Intent.DANGER,
                  content:
                    "There are no relations defined between these two node types",
                });
              }
            }
            clearSourceRef();
          } else {
            n.style("border-width", 4);
            n.lock();
            sourceRef.current = n;
          }
        } else if (selectionModeRef.current === "EDIT") {
          clearSourceRef();
          if (!["source", "destination"].includes(n.id())) {
            createOverlayRender<NodeDialogProps>(
              "playground-alias",
              LabelDialog
            )({
              node: n,
              nodeType: nodeTypeByColor[n.data("color")],
            });
          }
        }
      });
      n.on("dragfree", () => {
        const uid = n.data("id");
        const { x, y } = n.position();
        setInputSetting({ blockUid: uid, value: `${x},${y}`, key: "position" });
      });
      n.on("mousemove", () => {
        if (containerRef.current) {
          if (selectionModeRef.current === "ALIAS") {
            containerRef.current.style.cursor = "alias";
          } else if (selectionModeRef.current === "DELETE") {
            containerRef.current.style.cursor = `url(${trashCursor}), auto`;
          } else if (selectionModeRef.current === "EDIT") {
            containerRef.current.style.cursor = `url(${editCursor}), auto`;
          } else if (selectionModeRef.current === "CONNECT") {
            containerRef.current.style.cursor = "cell";
          }
        }
      });
      n.on("mouseover", () => {
        const tag = n.data("label");
        cyRef.current?.scratch("roamjs_preview_tag", tag);
      });
      n.on("mouseout", () => {
        cyRef.current?.scratch("roamjs_preview_tag", "");
        n.style("color", "#EEEEEE");
        if (containerRef.current) containerRef.current.style.cursor = "unset";
      });
      n.on("drag", () => {
        if (overlaysShownRef.current) refreshNodeOverlays();
      });
      const tree = getBasicTreeByParentUid(n.id());
      const positionTree = getSubTree({ tree, key: "position" });
      const colorTree = getSubTree({ tree, key: "color" });
      const aliasTree = getSubTree({ tree, key: "alias" });
      addUidWatch(n.id(), (text) =>
        typeof text === "undefined" ? n.remove() : editLabel(n, text)
      );
      addUidWatch(positionTree.children[0]?.uid, (text) => {
        if (typeof text === "undefined") return;
        const [x, y] = text.split(",").map((c) => Number(c.trim()));
        n.position({ x, y });
      });
      addUidWatch(colorTree.children[0]?.uid, (color) => {
        if (typeof color === "undefined") return;
        n.style("background-color", color);
      });
      addUidWatch(aliasTree.children[0]?.uid, (alias) => {
        if (typeof alias === "undefined") return;
        n.data("alias", alias);
      });
    },
    [
      elementsUid,
      sourceRef,
      cyRef,
      allRelationTriples,
      shadowInputRef,
      containerRef,
      overlaysShownRef,
      clearSourceRef,
      drawEdge,
      refreshNodeOverlays,
      addUidWatch,
    ]
  );
  const createNode = useCallback(
    (text: string, position: { x: number; y: number }, color: string) => {
      createBlock({
        node: {
          text,
          children: [
            {
              text: "position",
              children: [{ text: `${position.x},${position.y}` }],
            },
            { text: "color", children: [{ text: color }] },
            { text: "alias", children: [{ text: text }] },
          ],
        },
        parentUid: elementsUid,
      }).then((uid) => {
        const node = cyRef.current?.add({
          data: { id: uid, label: text, color, alias: text },
          position,
        })[0]!;
        nodeInitCallback(node);
      });
    },
    [nodeInitCallback, cyRef, elementsUid, nodeColorRef]
  );

  useEffect(() => {
    const oldClearOnClick = globalRefs.clearOnClick;
    Promise.all(elementsChildren.map(getCyElementFromRoamNode)).then(
      async (elements) => {
        const cytoscape = await window.RoamLazy?.Cytoscape();
        if (!cytoscape || !containerRef.current) return;
        const cy = cytoscape({
          container: containerRef.current,
          elements,

          style: [
            {
              selector: "node",
              style: {
                "background-color": `#${TEXT_COLOR}`,
                label: "data(alias)",
                shape: "round-rectangle",
                color: "#EEEEEE",
                "text-wrap": "wrap",
                "text-halign": "center",
                "text-valign": "center",
                "text-max-width": "320",
                width: "label",
                "padding-left": "16",
                "padding-right": "16",
                "padding-bottom": "8",
                "padding-top": "8",
                height: "label",
              },
            },
            {
              selector: "edge",
              style: {
                width: 10,
                "line-color": "#ccc",
                "target-arrow-color": "#ccc",
                "target-arrow-shape": "triangle",
                "curve-style": "bezier",
                label: "data(label)",
              },
            },
          ],

          layout: {
            name: "preset",
          },
          maxZoom,
          minZoom,
        });
        cyRef.current = cy;
        cy.on("click", (e) => {
          if (
            e.target !== cyRef.current ||
            (e.originalEvent.target as HTMLElement).tagName !== "CANVAS"
          ) {
            return;
          }
          if (!sourceRef.current) {
            const nodeType = nodeTypeByColor[nodeColorRef.current];
            createNode(
              nodeFormatTextByType[nodeType] || "Click to edit text",
              e.position,
              nodeColorRef.current
            );
          } else {
            clearSourceRef();
          }
        });
        cy.nodes().forEach(nodeInitCallback);
        cy.edges().forEach(edgeCallback);
        globalRefs.clearOnClick = ({ text }) => {
          const { x1, x2, y1, y2 } = cy.extent();
          const lastTime = cy.scratch("last_insert") as {
            x: number;
            y: number;
          } | null;
          const position = lastTime
            ? {
                x: lastTime.x + (x2 - x1) * 0.025,
                y: lastTime.y + (y2 - y1) * 0.05,
              }
            : { x: (x2 + x1) / 2, y: (y2 + y1) / 2 };
          const s = extractRef(text);
          createNode(
            s,
            position,
            coloredNodes.find((c) =>
              matchDiscourseNode({
                title: s,
                ...c,
              })
            )?.color || TEXT_COLOR
          );
          cy.scratch("last_insert", position);
        };
        // @ts-ignore
        cyRef.current.navigator({
          container: `.cytoscape-navigator`,
        });

        cy.on("zoom", () => {
          if (overlaysShownRef.current) refreshNodeOverlays();
          cy.scratch("last_insert", null);
        });

        cy.on("pan", () => {
          if (overlaysShownRef.current) refreshNodeOverlays();
          cy.scratch("last_insert", null);
        });

        containerRef.current.dispatchEvent(new Event("cytoscape:loaded"));
        registerPullWatch(
          "[:block/children]",
          `[:block/uid "${elementsUid}"]`,
          (b, a) => {
            const before = new Set(
              (b?.[":block/children"] || []).map((c) => c[":db/id"])
            );
            const after = (a?.[":block/children"] || []).map(
              (c) => c[":db/id"] || 0
            );
            const newNodes = after
              .filter((c) => !before.has(c))
              .map((n) =>
                window.roamAlphaAPI.pull("[:block/uid :block/string]", n)
              )
              .filter(
                (n) => !!n && !cy.hasElementWithId(n?.[":block/uid"] || "")
              );
            newNodes.forEach((n) => {
              getCyElementFromRoamNode({
                uid: n[":block/uid"] || "",
                text: n[":block/string"] || "",
                children: getBasicTreeByParentUid(n[":block/uid"] || ""),
              }).then((element) => {
                const cyNode = cy.add(element);
                if (element.position) {
                  nodeInitCallback(cyNode);
                } else {
                  edgeCallback(cyNode);
                }
              });
            });
          }
        );
      }
    );

    return () => {
      globalRefs.clearOnClick = oldClearOnClick;
      watches.current.forEach((args) =>
        window.roamAlphaAPI.data.removePullWatch(
          args.pullPattern,
          args.entityId,
          args.onWatch
        )
      );
    };
  }, [
    elementsUid,
    cyRef,
    containerRef,
    clearSourceRef,
    edgeCallback,
    nodeInitCallback,
    createNode,
    nodeTypeByColor,
    nodeColorRef,
    refreshNodeOverlays,
    registerPullWatch,
    overlaysShownRef,
    watches,
  ]);
  const [maximized, setMaximized] = useState(false);
  const maximize = useCallback(() => setMaximized(true), [setMaximized]);
  const minimize = useCallback(() => setMaximized(false), [setMaximized]);
  const [mapOpen, setMapOpen] = useState(false);
  const searchRef = useRef<HTMLSpanElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchOptions = useMemo(
    () =>
      searchOpen && cyRef.current
        ? cyRef.current.nodes().map((n) => n.data("alias"))
        : [],
    [searchOpen, cyRef]
  );
  const getStyle = useCallback(
    (e: cytoscape.NodeSingular) => {
      if (!cyRef.current) return { top: 0, left: 0, transform: "scale(1)" };
      const { x1, y1 } = cyRef.current.extent();
      const zoom = cyRef.current.zoom();
      const { x, y } = e.position();
      return {
        top: (y - y1 + e.height() / 2) * zoom,
        left: (x - x1 - e.width() / 2) * zoom,
        transform: `scale(${zoom})`,
      };
    },
    [cyRef]
  );

  useEffect(() => {
    if (cyRef.current) {
      const isNodeValid = (other: cytoscape.CollectionArgument) => {
        const otherText = nodeTextByColor[other.data("color")];
        return (
          (filters.includes.nodes.size === 0 &&
            filters.includes.edges.size === 0 &&
            !filters.excludes.nodes.has(otherText)) ||
          filters.includes.nodes.has(otherText)
        );
      };

      const isEdgeValid = (other: cytoscape.CollectionArgument) =>
        (filters.includes.edges.size === 0 &&
          filters.includes.nodes.size === 0 &&
          !filters.excludes.edges.has(other.data("label"))) ||
        filters.includes.edges.has(other.data("label"));

      cyRef.current.nodes().forEach((other) => {
        if (
          isNodeValid(other) ||
          other.connectedEdges().some(isEdgeValid) ||
          other.connectedEdges().some((e) =>
            (e as cytoscape.EdgeSingular)
              .connectedNodes()
              .filter((n) => n !== other)
              .some(isNodeValid)
          )
        ) {
          other.style("display", "element");
        } else {
          other.style("display", "none");
        }
        other.edges();
      });

      cyRef.current.edges().forEach((other) => {
        if (isEdgeValid(other) || other.connectedNodes().some(isNodeValid)) {
          other.style("display", "element");
        } else {
          other.style("display", "none");
        }
      });
    }
  }, [cyRef, nodeTextByColor, filters]);
  const [showModifiers, setShowModifiers] = useState(false);
  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      if (isControl(e)) {
        setShowModifiers(true);
        const mode = SELECTION_MODES.find(
          (m) =>
            m.shortcut === e.key || `Key${m.shortcut.toUpperCase()}` === e.code
        );
        if (mode) {
          setSelectionMode(mode.id);
          selectionModeRef.current = mode.id;
          e.stopPropagation();
          e.preventDefault();
        }
      }
    };
    const keyUp = (e: KeyboardEvent) => {
      setShowModifiers(isControl(e));
    };
    document.body.addEventListener("keydown", keyDown);
    document.body.addEventListener("keyup", keyUp);
    return () => {
      document.body.addEventListener("keydown", keyDown);
      document.body.addEventListener("keyup", keyUp);
    };
  }, [setShowModifiers, setSelectionMode, selectionModeRef]);
  return (
    <div
      className={`border border-gray-300 rounded-md bg-white h-full w-full z-10 overflow-hidden ${
        maximized ? "absolute inset-0" : "relative"
      }`}
      id={`roamjs-cytoscape-playground-container`}
      ref={containerRef}
      tabIndex={-1}
    >
      <style>{`.roam-article .rm-block-children {
  display: none;
}

.cytoscape-navigator{
	position: absolute;
	background: #fff;
	z-index: 99999;
	width: 200px;
	height: 200px;
	bottom: 0;
	right: 0;
	overflow: hidden;
  display: none;
}

.cytoscape-navigator > img{
	max-width: 100%;
	max-height: 100%;
}

.cytoscape-navigator > canvas{
	position: absolute;
	top: 0;
	left: 0;
	z-index: 101;
}

.cytoscape-navigatorView{
	position: absolute;
	top: 0;
	left: 0;
	cursor: move;
	background: #B7E1ED;
	-moz-opacity: 0.50;
	opacity: 0.50;
	-ms-filter:"progid:DXImageTransform.Microsoft.Alpha"(Opacity=50);
	z-index: 102;
}

.cytoscape-navigatorOverlay{
	position: absolute;
	top: 0;
	right: 0;
	bottom: 0;
	left: 0;
	z-index: 103;
}`}</style>
      <div
        className={
          "z-20 absolute flex w-full justify-between shadow-md bg-gray-100 rounded-md px-4 py-2"
        }
      >
        <div className="flex gap-2">
          {SELECTION_MODES.map((m) => (
            <Tooltip
              content={m.tooltip}
              key={m.id}
              position={Position.BOTTOM_LEFT}
            >
              <Button
                onClick={() => {
                  setSelectionMode(m.id);
                  selectionModeRef.current = m.id;
                }}
                minimal
                active={selectionMode === m.id}
                icon={
                  <span className={"relative"}>
                    <Icon icon={m.icon} />
                    <span
                      className={`absolute -bottom-2 -right-2 ${
                        showModifiers ? "inline-flex" : "hidden"
                      } bg-gray-300 w-4 h-4 font-small justify-center items-center rounded-full`}
                    >
                      {m.shortcut}
                    </span>
                  </span>
                }
              />
            </Tooltip>
          ))}
        </div>
        <div className="flex flex-col gap-2 justify-end relative items-end">
          <span>
            <Tooltip content={"Node Picker"} position={Position.BOTTOM_RIGHT}>
              <NodeIcon
                {...selectedNode}
                onClick={() => setColorPickerOpen(!colorPickerOpen)}
              />
            </Tooltip>
            <Filter
              data={{
                nodes: allNodes.map((n) => n.text),
                edges: allRelations.flatMap((r) => [r.label, r.complement]),
              }}
              onChange={setFilters}
            />
            {searchOpen ? (
              <>
                <Tooltip
                  content={"Close Search"}
                  position={Position.BOTTOM_RIGHT}
                >
                  <Button
                    minimal
                    icon={"search"}
                    active
                    onClick={() => setSearchOpen(false)}
                  />
                </Tooltip>
              </>
            ) : (
              <Tooltip content={"Open Search"} position={Position.BOTTOM_RIGHT}>
                <Button
                  minimal
                  icon={"search"}
                  onClick={() => {
                    setSearchOpen(true);
                    const input = searchRef.current?.querySelector("input");
                    if (input) {
                      setTimeout(() => input.focus({ preventScroll: true }), 1);
                    }
                  }}
                />
              </Tooltip>
            )}
            {mapOpen ? (
              <>
                <style>{`#roamjs-cytoscape-playground-container .cytoscape-navigator{ display: block; }`}</style>
                <Tooltip content={"Close Map"} position={Position.BOTTOM_RIGHT}>
                  <Button
                    minimal
                    icon={"map"}
                    active
                    onClick={() => setMapOpen(false)}
                  />
                </Tooltip>
              </>
            ) : (
              <Tooltip content={"Open Map"} position={Position.BOTTOM_RIGHT}>
                <Button minimal icon={"map"} onClick={() => setMapOpen(true)} />
              </Tooltip>
            )}
            {overlaysShown ? (
              <>
                <Tooltip
                  content={"Hide Overlays"}
                  position={Position.BOTTOM_RIGHT}
                >
                  <Button
                    minimal
                    icon={"widget"}
                    active
                    onClick={() => setOverlaysShown(false)}
                  />
                </Tooltip>
              </>
            ) : (
              <Tooltip
                content={"Show Overlays"}
                position={Position.BOTTOM_RIGHT}
              >
                <Button
                  minimal
                  icon={"widget"}
                  onClick={() => setOverlaysShown(true)}
                />
              </Tooltip>
            )}
            <Tooltip
              content={"Draw Existing Edges"}
              position={Position.BOTTOM_RIGHT}
            >
              <Button
                minimal
                icon={"circle-arrow-down"}
                onClick={() => {
                  const closeLoading = renderLoading(getCurrentPageUid());
                  setTimeout(async () => {
                    const elementsTree = getBasicTreeByParentUid(elementsUid);
                    const relationData = getDiscourseRelations();
                    const nodeData = getDiscourseNodes(relationData);
                    const nodes = await Promise.all(
                      elementsTree
                        .map((n) => {
                          const getNodeType = (t: RoamBasicNode) =>
                            nodeTypeByColor[
                              getSettingValueFromTree({
                                tree: t.children,
                                key: "color",
                              })
                            ];
                          return {
                            node: n.text,
                            cyId: n.uid,
                            type: getNodeType(n),
                          };
                        })
                        .filter((e) => !!e.type)
                        .map((e) => {
                          const uid = getPageUidByPageTitle(e.node);
                          return getDiscourseContextResults({
                            uid,
                            nodes: nodeData,
                            relations: relationData,
                          }).then((results) => ({
                            cyId: e.cyId,
                            uid,
                            results,
                          }));
                        })
                    );
                    const validNodes = Object.fromEntries(
                      nodes.map((n) => [n.uid, n.cyId])
                    );
                    const edgeCache = new Set(
                      Array.from(cyRef.current?.edges() || []).map((e) =>
                        JSON.stringify([
                          e.source().id(),
                          e.data("label"),
                          e.target().id(),
                        ])
                      )
                    );
                    const edges = nodes.flatMap((e) =>
                      e.results.flatMap((result) =>
                        Object.entries(result.results)
                          .filter(([k, v]) => !v.complement && !!validNodes[k])
                          .map(([target]) => ({
                            target: validNodes[target],
                            source: e.cyId,
                            text: result.label,
                          }))
                          .filter(
                            (edge) =>
                              !edgeCache.has(
                                JSON.stringify([
                                  edge.source,
                                  edge.text,
                                  edge.target,
                                ])
                              )
                          )
                          .map(drawEdge)
                      )
                    );
                    Promise.all(edges)
                      .catch((e) =>
                        renderToast({
                          id: "playground-error",
                          content: `Failed to render new edges: ${e.message}`,
                        })
                      )
                      .finally(closeLoading);
                  }, 1);
                }}
              />
            </Tooltip>
            {maximized ? (
              <>
                <style>{`div.roam-body div.roam-app div.roam-main div.roam-article {\n  position: static;\n}`}</style>
                <Tooltip content={"Minimize"} position={Position.BOTTOM_RIGHT}>
                  <Button minimal icon={"minimize"} onClick={minimize} />
                </Tooltip>
              </>
            ) : (
              <Tooltip content={"Maximize"} position={Position.BOTTOM_RIGHT}>
                <Button minimal icon={"maximize"} onClick={maximize} />
              </Tooltip>
            )}
            <Tooltip
              content={"Generate Roam Blocks"}
              position={Position.BOTTOM_RIGHT}
            >
              <Button
                minimal
                style={{ maxWidth: 30 }}
                icon={
                  <img
                    src={"https://roamresearch.com/favicon.ico"}
                    height={16}
                    width={16}
                  />
                }
                onClick={() => {
                  const elementsTree = getBasicTreeByParentUid(elementsUid);
                  const relationData = getDiscourseRelations();
                  const recentlyOpened = new Set<string>();
                  const connectedNodeUids = new Set<string>();
                  elementsTree
                    .map((n) => {
                      const sourceUid = n.children.find((c) =>
                        toFlexRegex("source").test(c.text)
                      )?.children?.[0]?.text;
                      const targetUid = n.children.find((c) =>
                        toFlexRegex("target").test(c.text)
                      )?.children?.[0]?.text;
                      const getNodeType = (t?: RoamBasicNode) =>
                        nodeTypeByColor[
                          (t?.children || []).find((s) =>
                            toFlexRegex("color").test(s.text)
                          )?.children?.[0]?.text || ""
                        ];
                      if (sourceUid && targetUid) {
                        const sourceNode = elementsTree.find(
                          (b) => b.uid === sourceUid
                        );
                        const targetNode = elementsTree.find(
                          (b) => b.uid === targetUid
                        );
                        connectedNodeUids.add(sourceUid);
                        connectedNodeUids.add(targetUid);
                        return {
                          source: {
                            text: sourceNode?.text || "",
                            type: getNodeType(sourceNode),
                          },
                          target: {
                            text: targetNode?.text || "",
                            type: getNodeType(targetNode),
                          },
                          relation: n.text,
                        };
                      }
                      return {
                        node: n.text,
                        uid: n.uid,
                        type: getNodeType(n),
                      };
                    })
                    .map((e) => {
                      if (!e.relation)
                        return connectedNodeUids.has(e.uid || "")
                          ? []
                          : e.type === TEXT_TYPE
                          ? [
                              {
                                source: "block",
                                target: e.node,
                                relation: "with text",
                              },
                            ]
                          : [
                              {
                                source: "block",
                                target: "page",
                                relation: "references",
                              },
                              {
                                source: "page",
                                relation: "has title",
                                target: e.node || "",
                              },
                            ];
                      const found = relationData.find(
                        (r) =>
                          (r.label === e.relation &&
                            ([TEXT_TYPE, r.source].includes(e.source.type) ||
                              r.source === "*") &&
                            ([TEXT_TYPE, r.destination].includes(
                              e.target.type
                            ) ||
                              r.destination === "*")) ||
                          (r.complement === e.relation &&
                            ([TEXT_TYPE, r.source].includes(e.target.type) ||
                              r.source === "*") &&
                            ([TEXT_TYPE, r.destination].includes(
                              e.source.type
                            ) ||
                              r.destination === "*"))
                      );
                      if (!found) return [];
                      const { triples, label } = found;
                      const isOriginal = label === e.relation;
                      const newTriples = triples.map((t) => {
                        if (/is a/i.test(t[1])) {
                          const targetNode =
                            (t[2] === "source" && isOriginal) ||
                            (t[2] === "destination" && !isOriginal)
                              ? e.source
                              : e.target;
                          return [
                            t[0],
                            targetNode.type === TEXT_TYPE
                              ? "with text"
                              : "has title",
                            targetNode.text,
                          ];
                        }
                        return t.slice(0);
                      });
                      return newTriples.map(([source, relation, target]) => ({
                        source,
                        relation,
                        target,
                      }));
                    })
                    .map(
                      triplesToBlocks({
                        defaultPageTitle: `Auto generated from ${title}`,
                        toPage: (title: string, blocks: InputTextNode[]) => {
                          const parentUid = getPageUidByPageTitle(title);
                          return Promise.resolve(
                            parentUid ||
                              createPage({
                                title: title,
                              })
                          ).then((parentUid) => {
                            blocks.forEach((node, order) =>
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
                            );
                            if (!recentlyOpened.has(parentUid)) {
                              recentlyOpened.add(parentUid);
                              setTimeout(
                                () => openBlockInSidebar(parentUid),
                                1000
                              );
                            }
                          });
                        },
                      })
                    )
                    .reduce((p, c) => p.then(c), Promise.resolve());
                }}
              />
            </Tooltip>
            <Tooltip content={"Export"} position={Position.BOTTOM_RIGHT}>
              <Button
                minimal
                icon={"export"}
                onClick={() => {
                  const elementsTree = getBasicTreeByParentUid(elementsUid);
                  const elementTextByUid = Object.fromEntries(
                    elementsTree.map(({ uid, text }) => [uid, text])
                  );
                  const nodesOrRelations = elementsTree.map((n) => {
                    const sourceUid = getSettingValueFromTree({
                      tree: n.children,
                      key: "source",
                    });
                    const targetUid = getSettingValueFromTree({
                      tree: n.children,
                      key: "target",
                    });
                    if (sourceUid && targetUid) {
                      return {
                        source: elementTextByUid[sourceUid],
                        target: elementTextByUid[targetUid],
                        relation: n.text,
                      };
                    }
                    return { node: n.text };
                  });
                  const nodes = nodesOrRelations
                    .filter((n) => !!n.node)
                    .map((n) => n.node as string);
                  const nodeUids = Object.fromEntries(
                    nodes.map((n) => [
                      n,
                      getPageUidByPageTitle(n) ||
                        window.roamAlphaAPI.util.generateUID(),
                    ])
                  );
                  exportRender({
                    fromQuery: {
                      nodes: nodes.map((title) => ({
                        text: title,
                        uid: nodeUids[title],
                      })),
                      relations: nodesOrRelations
                        .filter((n) => !n.node)
                        .map((n) => ({
                          source: nodeUids[n.source || ""],
                          target: nodeUids[n.target || ""],
                          label: n.relation || "",
                        })),
                    },
                    ...exportRenderProps,
                  });
                }}
              />
            </Tooltip>
          </span>
          <span
            className={`${colorPickerOpen ? "inline-flex" : "hidden"} absolute`}
            style={{ top: "150%" }}
          >
            {coloredNodes
              .filter((f) => f !== selectedNode)
              .map((n) => (
                <Tooltip
                  content={n.text}
                  key={n.text}
                  position={Position.BOTTOM_RIGHT}
                >
                  <NodeIcon
                    {...n}
                    onClick={() => {
                      nodeColorRef.current = n.color;
                      setSelectedNode(n);
                      setColorPickerOpen(false);
                    }}
                    key={n.text}
                  />
                </Tooltip>
              ))}
          </span>
          <span
            className={`${searchOpen ? "inline-flex" : "hidden"} absolute`}
            style={{ top: "150%" }}
            ref={searchRef}
            // TODO - why is the search input not clickable?!
            onClick={() => {
              const input = searchRef.current?.querySelector("input");
              if (input) {
                setTimeout(() => input.focus({ preventScroll: true }), 1);
              }
            }}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
          >
            <AutocompleteInput
              onConfirm={() => {
                const node = cyRef.current
                  ?.nodes()
                  .filter((n) => n.data("alias") === searchValue);
                if (node && cyRef.current) cyRef.current.center(node);
              }}
              value={searchValue}
              setValue={setSearchValue}
              options={searchOptions}
            />
          </span>
        </div>
      </div>
      {previewEnabled && (
        <LivePreview
          tag={livePreviewTag}
          registerMouseEvents={registerMouseEvents}
        />
      )}
      <div className="cytoscape-navigator border border-gray-300 rounded-tl-md" />
      {Object.entries(nodeOverlays).map(([k, { label, ...style }]) => (
        <div
          className="absolute inline bg-gray-100 origin-top-left"
          style={style}
          id={k}
          key={k}
        >
          <DiscourseContextOverlay tag={label} id={k} />
        </div>
      ))}
    </div>
  );
};

export const render = ({ parent, ...props }: Props & { parent: HTMLElement }) =>
  renderWithUnmount(<CytoscapePlayground {...props} />, parent);

export default CytoscapePlayground;
