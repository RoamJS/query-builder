import React, {
  useRef,
  useState,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import {
  Button,
  Callout,
  Checkbox,
  Classes,
  Dialog,
  IconName,
  Intent,
  Label,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import fireQuery from "../utils/fireQuery";
import fuzzy from "fuzzy";
import { RoamOverlayProps } from "roamjs-components/util/renderOverlay";
import { QBClause, Result } from "../utils/types";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import { DiscourseContextType } from "./TldrawCanvas";
import { IconNames } from "@blueprintjs/icons";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import { set } from "date-fns";

const LabelDialogAutocomplete = ({
  setLabel,
  setUid,
  nodeType,
  initialUid,
  initialValue,
  onSubmit,
  referencedNode,
  isCreateCanvasNode,
  action,
  format,
  label,
}: {
  setLabel: (text: string) => void;
  setUid: (uid: string) => void;
  nodeType: string;
  initialUid: string;
  initialValue: { text: string; uid: string };
  onSubmit: () => void;
  referencedNode: { name: string; nodeType: string } | null;
  isCreateCanvasNode: boolean;
  action: string;
  format: string;
  label: string;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<Result[]>([]);

  const [referencedNodeOptions, setReferencedNodeOptions] = useState<Result[]>(
    []
  );
  const [referencedNodeValue, setReferencedNodeValue] = useState("");
  const [isAddReferencedNode, setAddReferencedNode] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const conditionUid = window.roamAlphaAPI.util.generateUID();

    setTimeout(() => {
      if (nodeType) {
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
        }).then((results) => {
          setOptions(results);
        });
      }
      if (referencedNode) {
        fireQuery({
          returnNode: "node",
          selections: [],
          conditions: [
            {
              source: "node",
              relation: "is a",
              target: referencedNode.nodeType,
              uid: conditionUid,
              type: "clause",
            },
          ],
        }).then((results) => {
          setReferencedNodeOptions(results);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    }, 100);
  }, [
    nodeType,
    referencedNode?.nodeType,
    setOptions,
    setReferencedNodeOptions,
  ]);

  const [content, setContent] = useState(initialValue.text);

  const setValue = useCallback(
    (r: Result) => {
      if (action === "creating" && r.uid === initialUid) {
        const pageName = format.replace(/{([\w\d-]*)}/g, (_, val) => {
          if (/content/i.test(val)) return r.text;
          if (
            referencedNode &&
            new RegExp(referencedNode.name, "i").test(val) &&
            isAddReferencedNode
          )
            return referencedNodeValue;
          return "";
        });
        setLabel(pageName);
      } else {
        setLabel(r.text);
      }
      setUid(r.uid);
      setContent(r.text);
    },
    [setLabel, setUid, isAddReferencedNode, referencedNode]
  );

  const setValueFromReferencedNode = useCallback(
    (r: Result) => {
      if (!referencedNode) return;
      if (action === "editing") {
        // TODO: make this deterministic via specification
        setLabel(`${content} - [[${r.text}]]`);
      } else {
        const pageName = format.replace(/{([\w\d-]*)}/g, (_, val) => {
          if (/content/i.test(val)) return content;
          if (new RegExp(referencedNode.name, "i").test(val))
            return `[[${r.text}]]`;
          return "";
        });
        setLabel(pageName);
      }
      setReferencedNodeValue(r.text);
    },
    [setLabel, referencedNode, content, referencedNodeValue]
  );

  const onNewItem = useCallback(
    (text: string) => ({ text, uid: initialUid }),
    [initialUid]
  );
  const itemToQuery = useCallback((result?: Result) => result?.text || "", []);
  const filterOptions = useCallback(
    (o: Result[], q: string) =>
      fuzzy
        .filter(q, o, { extract: itemToQuery })
        .map((f) => f.original)
        .filter((f): f is Result => !!f),
    [itemToQuery]
  );

  const [isEditExistingLabel, setIsEditExistingLabel] = useState(false);

  return (
    <>
      <div className={referencedNode ? "mb-8" : ""}>
        {(isAddReferencedNode || isEditExistingLabel || isCreateCanvasNode) && (
          <div className="m-6">{label}</div>
        )}

        {referencedNode && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {action === "editing" ? (
              <Checkbox
                label={`Edit Label`}
                checked={isEditExistingLabel}
                onChange={(e) => {
                  const checked = e.target as HTMLInputElement;
                  setIsEditExistingLabel(checked.checked);
                }}
                disabled={isAddReferencedNode}
                indeterminate={isAddReferencedNode}
                className={isAddReferencedNode ? "flex-grow" : ""}
              />
            ) : isAddReferencedNode ? (
              <Label className={"flex-grow"}>Title</Label>
            ) : (
              <div className={"flex-grow"}></div>
            )}

            <Checkbox
              label={`Set ${referencedNode?.name}`}
              checked={isAddReferencedNode}
              onChange={(e) => {
                const checked = e.target as HTMLInputElement;
                setAddReferencedNode(checked.checked);
              }}
              disabled={action === "setting" || isEditExistingLabel}
              indeterminate={action === "setting" || isEditExistingLabel}
            />
          </div>
        )}
        <AutocompleteInput
          value={isCreateCanvasNode ? { text: "", uid: "" } : initialValue}
          setValue={setValue}
          onConfirm={onSubmit}
          options={options}
          multiline
          autoFocus
          onNewItem={onNewItem}
          itemToQuery={itemToQuery}
          filterOptions={filterOptions}
          disabled={
            isLoading ||
            (action === "editing" && !!referencedNode && !isEditExistingLabel)
          }
          placeholder={isLoading ? "Loading ..." : "Enter a label ..."}
          maxItemsDisplayed={100}
        />
      </div>
      {isAddReferencedNode &&
        (action === "creating" || action === "editing") && (
          <div>
            <Label>{referencedNode?.name}</Label>
            <AutocompleteInput
              value={
                referencedNodeValue
                  ? { text: referencedNodeValue, uid: "" }
                  : { text: "", uid: "" }
              }
              setValue={setValueFromReferencedNode}
              options={referencedNodeOptions}
              multiline
              onNewItem={onNewItem}
              itemToQuery={itemToQuery}
              filterOptions={filterOptions}
              placeholder={
                isLoading ? "..." : `Enter a ${referencedNode?.name} ...`
              }
              maxItemsDisplayed={100}
            />
          </div>
        )}
    </>
  );
};

type NodeDialogProps = {
  label: string;
  onSuccess: (a: Result) => Promise<void>;
  onCancel: () => void;
  nodeType: string;
  initialUid: string;
  discourseContext: DiscourseContextType;
};

const LabelDialog = ({
  isOpen,
  onClose,
  label: _label,
  onSuccess,
  onCancel,
  nodeType,
  initialUid,
  discourseContext,
}: RoamOverlayProps<NodeDialogProps>) => {
  const { format } = discourseContext.nodes[nodeType];

  const getReferencedNodeInFormat = () => {
    const regex = /{([\w\d-]*)}/g;
    const matches = [...format.matchAll(regex)];

    for (const match of matches) {
      const val = match[1];
      if (val.toLowerCase() === "context") continue;

      const referencedNode = Object.values(discourseContext.nodes).find(
        ({ text }) => new RegExp(text, "i").test(val)
      );

      if (referencedNode) {
        return {
          name: referencedNode.text,
          nodeType: referencedNode.type,
        };
      }
    }

    return null;
  };

  const referencedNode = getReferencedNodeInFormat();

  const [error, setError] = useState("");
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
  // Need useMemo ?
  const initialValue = useMemo(() => {
    return { text: initialLabel, uid: initialUid };
  }, [initialLabel, initialUid]);
  const [label, setLabel] = useState(initialValue.text);
  const [uid, setUid] = useState(initialValue.uid);
  const [loading, setLoading] = useState(false);
  const isCreateCanvasNode = !isLiveBlock(initialUid);

  const renderCalloutText = () => {
    let title = "Please provide a label";
    let icon = IconNames.INFO_SIGN;
    let action = "initial";

    if (!label) return { title, icon, action };

    if (!isCreateCanvasNode) {
      if (uid === initialUid) {
        title = "Edit title of current discourse node";
        icon = IconNames.EDIT;
        action = "editing";
      } else {
        title = "Change to existing discourse node";
        icon = IconNames.EXCHANGE;
        action = "changing";
      }
    } else {
      if (uid === initialUid) {
        title = "Create new discourse node";
        icon = IconNames.NEW_OBJECT;
        action = "creating";
      } else {
        title = "Set to existing discourse node";
        icon = IconNames.LINK;
        action = "setting";
      }
    }

    return { title, icon, action };
  };
  const calloutText = renderCalloutText();

  const onSubmit = () => {
    setLoading(true);
    onSuccess({ text: label, uid, action: calloutText.action })
      .then(onClose)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  const onCancelClick = () => {
    onCancel();
    onClose();
  };

  // Listens for touch outside container to trigger close
  const containerRef = useRef<HTMLDivElement>(null);
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

  return (
    <>
      <Dialog
        isOpen={isOpen}
        title={!isCreateCanvasNode ? "Edit Canvas Node" : "Create Canvas Node"}
        onClose={onCancelClick}
        canOutsideClickClose
        // Escape isn't working?
        canEscapeKeyClose
        autoFocus={false}
        className={"roamjs-discourse-playground-dialog"}
      >
        <div className={Classes.DIALOG_BODY} ref={containerRef}>
          <Callout
            intent="primary"
            className="mb-4"
            title={calloutText.title}
            icon={calloutText.icon as IconName}
          >
            <div>
              {!isCreateCanvasNode ? (
                <div className="mt-5">
                  <span className="font-semibold">Current Title</span>
                  <span className="block">{initialLabel}</span>
                </div>
              ) : (
                ""
              )}
            </div>
          </Callout>
          <LabelDialogAutocomplete
            action={calloutText.action || ""}
            isCreateCanvasNode={isCreateCanvasNode}
            referencedNode={referencedNode}
            setLabel={setLabel}
            label={label}
            setUid={setUid}
            nodeType={nodeType}
            initialUid={initialUid}
            initialValue={initialValue}
            onSubmit={onSubmit}
            format={format}
          />
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div
            className={`${Classes.DIALOG_FOOTER_ACTIONS} items-center flex-row-reverse`}
          >
            <Button
              text={"Confirm"}
              intent={Intent.PRIMARY}
              onClick={onSubmit}
              onTouchEnd={onSubmit}
              disabled={loading || !label}
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

export default LabelDialog;
