import React, { useRef, useState, useMemo, useEffect } from "react";
import {
  Button,
  Callout,
  Classes,
  Dialog,
  // Icon,
  // InputGroup,
  Intent,
  // Position,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import { IconName, IconNames } from "@blueprintjs/icons";
import fireQuery from "../utils/fireQuery";
import fuzzy from "fuzzy";
import { RoamOverlayProps } from "roamjs-components/util/renderOverlay";
import { Result } from "../utils/types";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import { DiscourseContextType } from "./TldrawCanvas";
import { getPlainTitleFromSpecification } from "../discourseGraphsMode";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";

const LabelDialogAutocomplete = ({
  setLabel,
  setUid,
  nodeType,
  initialUid,
  initialValue,
  onSubmit,
  isCreateCanvasNode,
  initialLabel,
}: {
  setLabel: (text: string) => void;
  setUid: (uid: string) => void;
  nodeType: string;
  initialUid: string;
  initialValue: { text: string; uid: string };
  onSubmit: () => void;
  isCreateCanvasNode: boolean;
  initialLabel: string;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<Result[]>([]);
  useEffect(() => {
    setIsLoading(true);
    const conditionUid = window.roamAlphaAPI.util.generateUID();
    setTimeout(() => {
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
        setIsLoading(false);
      });
    }, 100);
  }, [nodeType, setOptions]);

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
      <div>
        {!isCreateCanvasNode ? (
          <div className="my-4">
            <div className="font-semibold mb-1">Current Title</div>
            <div>{initialLabel}</div>
          </div>
        ) : (
          ""
        )}
      </div>
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
        disabled={isLoading}
        placeholder={isLoading ? "Loading ..." : "Enter a label ..."}
        maxItemsDisplayed={100}
      />
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const initialLabel = useMemo(() => {
    if (_label) return _label;
    const { specification, text } = discourseContext.nodes[nodeType];
    if (!specification.length) return "";
    return getPlainTitleFromSpecification({ specification, text });
  }, [_label, nodeType]);
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
      } else {
        title = "Change to existing discourse node";
        icon = IconNames.EXCHANGE;
      }
    } else {
      if (uid === initialUid) {
        title = "Create new discourse node";
        icon = IconNames.NEW_OBJECT;
      } else {
        title = "Set to existing discourse node";
        icon = IconNames.LINK;
      }
    }

    return { title, icon, action };
  };
  const calloutText = renderCalloutText();

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

  // Listens for touch outside container to trigger close
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
          />
          <LabelDialogAutocomplete
            setLabel={setLabel}
            setUid={setUid}
            nodeType={nodeType}
            initialUid={initialUid}
            initialValue={initialValue}
            onSubmit={onSubmit}
            isCreateCanvasNode={isCreateCanvasNode}
            initialLabel={initialLabel}
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
