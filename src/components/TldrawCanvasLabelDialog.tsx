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
  Classes,
  Dialog,
  IconName,
  Intent,
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

  const setValue = useCallback(
    (r: Result) => {
      setLabel(r.text);
      setUid(r.uid);
    },
    [setLabel, setUid]
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
      // disabled={isLoading}
      placeholder={isLoading ? "Loading ..." : "Enter a label ..."}
      // maxItemsDisplayed={10}
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

  // TODO: need a better way to determine if editing or creating
  const isEditing = !!initialLabel;
  const renderCalloutText = () => {
    if (!label) {
      return {
        title: "Please provide a label",
        icon: IconNames.INFO_SIGN,
      };
    }

    let title, icon;
    if (isEditing) {
      if (uid === initialUid) {
        title = "Editing Label of Current Discourse Node";
        icon = IconNames.EDIT;
      } else {
        title = "Change to Existing Node";
        icon = IconNames.EXCHANGE;
      }
    } else {
      if (uid === initialUid) {
        title = "Creating New Discourse Node";
        icon = IconNames.NEW_OBJECT;
      } else {
        title = "Setting to Existing Node";
        icon = IconNames.LINK;
      }
    }

    return { title, icon };
  };
  const calloutText = renderCalloutText();

  return (
    <>
      <Dialog
        isOpen={isOpen}
        title={isEditing ? "Edit Canvas Node" : "Create Canvas Node"}
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
            <div className="mt-2">
              <div className="truncate">
                {isEditing ? (
                  <>
                    <span className="font-semibold">Current Label:</span>{" "}
                    {initialLabel}
                  </>
                ) : (
                  ""
                )}
              </div>
            </div>
          </Callout>
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
