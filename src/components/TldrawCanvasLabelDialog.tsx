import React, { useRef, useState, useMemo, useEffect } from "react";
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
} from "@blueprintjs/core";
import fireQuery from "../utils/fireQuery";
import fuzzy from "fuzzy";
import { RoamOverlayProps } from "roamjs-components/util/renderOverlay";
import { Result } from "../utils/types";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import { DiscourseContextType } from "./TldrawCanvas";
import { getPlainTitleFromSpecification } from "../discourseGraphsMode";

const LabelDialogAutocomplete = ({
  setLabel,
  setUid,
  nodeType,
  initialUid,
  initialValue,
  onSubmit,
}: {
  setLabel: (text: string) => void;
  setUid: (uid: string) => void;
  nodeType: string;
  initialUid: string;
  initialValue: { text: string; uid: string };
  onSubmit: () => void;
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
        title={"Edit Discourse Node Label"}
        onClose={onCancelClick}
        canOutsideClickClose
        // Escape isn't working?
        canEscapeKeyClose
        autoFocus={false}
        className={"roamjs-discourse-playground-dialog"}
      >
        <div className={Classes.DIALOG_BODY} ref={containerRef}>
          <LabelDialogAutocomplete
            setLabel={setLabel}
            setUid={setUid}
            nodeType={nodeType}
            initialUid={initialUid}
            initialValue={initialValue}
            onSubmit={onSubmit}
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

export default LabelDialog;
