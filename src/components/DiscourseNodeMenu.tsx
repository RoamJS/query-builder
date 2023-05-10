import { Menu, MenuItem, Popover, Position } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getUids from "roamjs-components/dom/getUids";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import updateBlock from "roamjs-components/writes/updateBlock";
import { getCoordsFromTextarea } from "roamjs-components/components/CursorMenu";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import compileDatalog from "../utils/compileDatalog";
import getSubTree from "roamjs-components/util/getSubTree";
import {
  InputTextNode,
  PullBlock,
  RoamBasicNode,
} from "roamjs-components/types/native";
import getDiscourseNodes from "../utils/getDiscourseNodes";
import discourseNodeFormatToDatalog from "../utils/discourseNodeFormatToDatalog";

type Props = {
  textarea: HTMLTextAreaElement;
};

const NodeMenu = ({ onClose, textarea }: { onClose: () => void } & Props) => {
  const discourseNodes = useMemo(
    () => getDiscourseNodes().filter((n) => !n.isRelationBacked),
    []
  );
  const indexBySC = useMemo(
    () => Object.fromEntries(discourseNodes.map((mi, i) => [mi.shortcut, i])),
    [discourseNodes]
  );
  const indexedByType = useMemo(
    () => Object.fromEntries(discourseNodes.map((mi, i) => [mi.type, mi])),
    [discourseNodes]
  );
  const shortcuts = useMemo(() => new Set(Object.keys(indexBySC)), [indexBySC]);
  const blockUid = useMemo(() => getUids(textarea).blockUid, [textarea]);
  const menuRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const onSelect = useCallback(
    (index) => {
      const menuItem =
        menuRef.current?.children[index].querySelector(".bp3-menu-item");
      if (!menuItem) return;
      const nodeUid = menuItem.getAttribute("data-node") || "";
      const highlighted = textarea.value.substring(
        textarea.selectionStart,
        textarea.selectionEnd
      );
      setTimeout(() => {
        const text = getTextByBlockUid(blockUid);
        const format = indexedByType[nodeUid]?.format || "";
        const pagename = format.replace(/{([\w\d-]*)}/g, (_, val) => {
          if (/content/i.test(val)) return highlighted;
          const referencedNode = discourseNodes.find(({ text }) =>
            new RegExp(text, "i").test(val)
          );
          if (referencedNode) {
            const referenced = window.roamAlphaAPI.data.fast.q(
              `[:find (pull ?r [:node/title :block/string]) :where [?b :block/uid "${blockUid}"] (or-join [?b ?r] (and [?b :block/parents ?p] [?p :block/refs ?r]) (and [?b :block/page ?r])) ${discourseNodeFormatToDatalog(
                {
                  freeVar: "r",
                  ...referencedNode,
                }
              )
                .map((c) => compileDatalog(c, 0))
                .join(" ")}]`
            )?.[0]?.[0] as PullBlock;
            return referenced?.[":node/title"]
              ? `[[${referenced?.[":node/title"]}]]`
              : referenced?.[":block/string"] || "";
          }
          return "";
        });
        const newText = `${text.substring(
          0,
          textarea.selectionStart
        )}[[${pagename}]]${text.substring(textarea.selectionEnd)}`;
        updateBlock({ text: newText, uid: blockUid })
          .then(
            () =>
              getPageUidByPageTitle(pagename) || createPage({ title: pagename })
          )
          .then((pageUid) => {
            const nodeTree = getFullTreeByParentUid(nodeUid).children;
            const nodes = getSubTree({
              tree: nodeTree,
              key: "template",
            }).children;
            const stripUid = (n: RoamBasicNode[]): InputTextNode[] =>
              n.map(({ uid, children, ...c }) => ({
                ...c,
                children: stripUid(children),
              }));
            return Promise.all(
              stripUid(nodes).map(({ uid, ...node }, order) =>
                createBlock({
                  node,
                  order,
                  parentUid: pageUid,
                })
              )
            )
              .then(() => openBlockInSidebar(pageUid))
              .then(() => {
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
              });
          });
      });
      onClose();
    },
    [menuRef, blockUid, onClose]
  );
  const keydownListener = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        const index = Number(
          menuRef.current?.getAttribute("data-active-index")
        );
        const count = menuRef.current?.childElementCount || 0;
        setActiveIndex((index + 1) % count);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        const index = Number(
          menuRef.current?.getAttribute("data-active-index")
        );
        const count = menuRef.current?.childElementCount || 0;
        setActiveIndex((index - 1 + count) % count);
      } else if (e.key === "Enter") {
        const index = Number(
          menuRef.current?.getAttribute("data-active-index")
        );
        onSelect(index);
      } else if (shortcuts.has(e.key.toUpperCase())) {
        onSelect(indexBySC[e.key.toUpperCase()]);
      } else {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
    },
    [menuRef, setActiveIndex]
  );
  useEffect(() => {
    textarea.addEventListener("keydown", keydownListener);
    textarea.addEventListener("input", onClose);
    return () => {
      textarea.removeEventListener("keydown", keydownListener);
      textarea.removeEventListener("input", onClose);
    };
  }, [keydownListener, onClose]);
  return (
    <Popover
      onClose={onClose}
      isOpen={true}
      canEscapeKeyClose
      minimal
      target={<span />}
      position={Position.BOTTOM_LEFT}
      modifiers={{
        flip: { enabled: false },
        preventOverflow: { enabled: false },
      }}
      autoFocus={false}
      enforceFocus={false}
      content={
        <Menu ulRef={menuRef} data-active-index={activeIndex}>
          {discourseNodes.map((item, i) => {
            return (
              <MenuItem
                key={item.text}
                data-node={item.type}
                text={`${item.text} - (${item.shortcut})`}
                active={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => onSelect(i)}
              />
            );
          })}
        </Menu>
      }
    />
  );
};

export const render = (props: Props) => {
  const parent = document.createElement("span");
  const coords = getCoordsFromTextarea(props.textarea);
  parent.style.position = "absolute";
  parent.style.left = `${coords.left}px`;
  parent.style.top = `${coords.top}px`;
  props.textarea.parentElement?.insertBefore(parent, props.textarea);
  ReactDOM.render(
    <NodeMenu
      {...props}
      onClose={() => {
        ReactDOM.unmountComponentAtNode(parent);
        parent.remove();
      }}
    />,
    parent
  );
};

export default NodeMenu;
