import { Menu, MenuItem, Popover, Position } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getUids from "roamjs-components/dom/getUids";
import updateBlock from "roamjs-components/writes/updateBlock";
import { getCoordsFromTextarea } from "roamjs-components/components/CursorMenu";
import compileDatalog from "../utils/compileDatalog";
import { PullBlock } from "roamjs-components/types/native";
import getDiscourseNodes from "../utils/getDiscourseNodes";
import discourseNodeFormatToDatalog from "../utils/discourseNodeFormatToDatalog";
import createDiscourseNodePage from "../utils/createDiscourseNodePage";

type Props = {
  textarea: HTMLTextAreaElement;
};

const NodeMenu = ({ onClose, textarea }: { onClose: () => void } & Props) => {
  const discourseNodes = useMemo(
    () => getDiscourseNodes().filter((n) => n.backedBy === "user"),
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
        const pageName = format.replace(/{([\w\d-]*)}/g, (_, val) => {
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
        )}[[${pageName}]]${text.substring(textarea.selectionEnd)}`;

        updateBlock({ text: newText, uid: blockUid });
        createDiscourseNodePage({
          pageName,
          configPageUid: nodeUid,
          openInSidebar: true,
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
