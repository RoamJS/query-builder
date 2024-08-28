import React, { useState, useRef, useMemo, useCallback } from "react";
import {
  Button,
  H6,
  InputGroup,
  Label,
  Switch,
  Dialog,
  Classes,
  FormGroup,
} from "@blueprintjs/core";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import getSubTree from "roamjs-components/util/getSubTree";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import { defaultNanopubTemplate } from "../../data/defaultNanopubTemplates";
import { DiscourseNode } from "../../utils/getDiscourseNodes";
import { OnloadArgs } from "roamjs-components/types";
import useSingleChildValue from "roamjs-components/components/ConfigPanels/useSingleChildValue";
import getFirstChildTextByBlockUid from "roamjs-components/queries/getFirstChildTextByBlockUid";

const placeholders = {
  nodeType: "Type of Discourse Node",
  title: "Page Title",
  body: "Page Body",
  url: "Current page URL",
  myORCID: "Your ORCID identifier",
  createdBy: "Creator of the page",
};
const defaultPredicates = [
  "is a",
  "has the label",
  "has the description",
  "has more info at",
  "is attributed to",
  "is created by",
];

export type NanopubTriple = {
  uid: string;
  predicate: string;
  object: string;
};

const TripleInput = React.memo(
  ({
    triple,
    onChange,
    onDelete,
    enabled,
    node,
  }: {
    triple: NanopubTriple;
    onChange: (field: keyof NanopubTriple, value: string) => void;
    onDelete: () => void;
    enabled: boolean;
    node: DiscourseNode;
  }) => {
    // console.log("did render", triple);
    const { uid, predicate, object } = triple;
    const timeoutRef = useRef(0);

    // TODO: onChange this causes a loop.  but is not required?
    // TODO: there is still some aggressive updating going via on setValue when adding/deleting
    // deleting sometimes results in "Uncaught (in promise) Error: Assert failed: `uid` argument was not passed or invalid."
    // I split these into two functions to try and understand/address the aggressive updating
    const handlePredicateUpdate = useCallback(
      (value: string, timeout: boolean = true) => {
        // console.log("predicate", value, uid);
        clearTimeout(timeoutRef.current);
        // onChange(field, value);
        timeoutRef.current = window.setTimeout(
          () => {
            updateBlock({ text: value, uid });
          },
          timeout ? 1000 : 0
        );
      },
      [onChange, uid]
    );
    const handleObjectUpdate = useCallback(
      (value: string, timeout: boolean = true) => {
        // console.log("object", value, uid);
        clearTimeout(timeoutRef.current);
        // onChange(field, value);
        timeoutRef.current = window.setTimeout(
          () => {
            updateBlock({ text: value, uid: getFirstChildUidByBlockUid(uid) });
          },
          timeout ? 1000 : 0
        );
      },
      [onChange, uid]
    );

    return (
      <div className="flex space-x-2 items-center">
        <InputGroup placeholder="Subject" value={node.text} disabled={true} />
        <AutocompleteInput
          placeholder="Predicate"
          value={predicate}
          setValue={handlePredicateUpdate}
          onBlur={(v) => handlePredicateUpdate(v, false)}
          id={`${uid}-predicate`}
          disabled={!enabled}
          options={defaultPredicates}
        />
        <AutocompleteInput
          placeholder="Object"
          value={object}
          setValue={handleObjectUpdate}
          onBlur={(v) => handleObjectUpdate(v, false)}
          id={`${uid}-object`}
          options={Object.keys(placeholders).map((key) => `{${key}}`)}
          disabled={!enabled}
        />
        <Button icon="trash" minimal onClick={onDelete} disabled={!enabled} />
      </div>
    );
  }
);

const NanopubConfigPanel = ({
  uid,
  node,
  onloadArgs,
}: {
  uid: string;
  node: DiscourseNode;
  onloadArgs: OnloadArgs;
}) => {
  const tree = useMemo(() => getBasicTreeByParentUid(uid), [uid]);
  const [enablePublishing, setEnablePublishing] = useState(
    () => !!getSubTree({ tree, key: "enabled" }).uid
  );

  const [triplesUid, setTriplesUid] = useState<string | null>(
    () => getSubTree({ tree, key: "triples" }).uid || null
  );
  const [triples, setTriples] = useState<NanopubTriple[]>(() =>
    triplesUid
      ? getBasicTreeByParentUid(triplesUid).map((t) => ({
          uid: t.uid,
          predicate: t.text,
          object: t.children[0]?.text || "",
        }))
      : []
  );
  const nodeTypeUid = useMemo(
    () => tree.find((t) => t.text === "nodeType")?.uid,
    [tree]
  );
  const defaultNodeType = useMemo(() => {
    if (!nodeTypeUid) return "";
    return getFirstChildTextByBlockUid(nodeTypeUid);
  }, [nodeTypeUid]);

  const { value: nodeTypeValue, onChange } = useSingleChildValue({
    uid: nodeTypeUid,
    defaultValue: defaultNodeType,
    title: "nodeType",
    parentUid: uid,
    order: 0,
    transform: (s) => s,
    toStr: (s) => s,
  });

  const isDefaultTemplate = useMemo(() => {
    if (triples.length !== defaultNanopubTemplate.length) return false;
    return triples.every((triple, index) => {
      const defaultTriple = defaultNanopubTemplate[index];
      return (
        triple.predicate === defaultTriple.predicate &&
        triple.object === defaultTriple.object
      );
    });
  }, [triples]);
  const [isWarningDialogOpen, setIsWarningDialogOpen] = useState(false);

  const setIsEnabled = useCallback(
    (b: boolean) => {
      setEnablePublishing(b);
      return b
        ? createBlock({
            parentUid: uid,
            node: { text: "enabled" },
          })
        : deleteBlock(getSubTree({ parentUid: uid, key: "enabled" }).uid);
    },
    [uid]
  );

  const addTriple = async () => {
    const effectiveTriplesUid = triplesUid
      ? triplesUid
      : await createBlock({
          parentUid: uid,
          node: { text: "triples" },
        });

    const predicateUid = await createBlock({
      node: { text: "" },
      parentUid: effectiveTriplesUid,
      order: "last",
    });

    await createBlock({
      node: { text: "" },
      parentUid: predicateUid,
    });

    setTriples([...triples, { uid: predicateUid, predicate: "", object: "" }]);
  };
  const updateTriple = useCallback(
    (uid: string, field: keyof NanopubTriple, value: string) => {
      setTriples(
        triples.map((triple) =>
          triple.uid === uid ? { ...triple, [field]: value } : triple
        )
      );
    },
    [triples]
  );
  const removeTriple = useCallback(
    (uid: string) => {
      deleteBlock(uid).then(() => {
        setTriples(triples.filter((triple) => triple.uid !== uid));
      });
    },
    [triples]
  );

  const handleConfirmUseDefault = async () => {
    if (triplesUid) deleteBlock(triplesUid);

    const defaultTriples = defaultNanopubTemplate.map((triple) => ({
      predicate: triple.predicate,
      predicateUid: window.roamAlphaAPI.util.generateUID(),
      object: triple.object,
      objectUid: window.roamAlphaAPI.util.generateUID(),
    }));

    const newTriplesUid = await createBlock({
      parentUid: uid,
      node: {
        text: "triples",
        children: defaultTriples.map((triple) => ({
          text: triple.predicate,
          uid: triple.predicateUid,
          children: [
            {
              text: triple.object,
              uid: triple.objectUid,
            },
          ],
        })),
      },
    });

    setTriplesUid(newTriplesUid);
    setTriples(
      defaultTriples.map((triple) => ({
        uid: triple.predicateUid,
        predicate: triple.predicate,
        object: triple.object,
      }))
    );
    setIsWarningDialogOpen(false);
  };

  return (
    <>
      <div className="space-y-4">
        <Switch
          checked={enablePublishing}
          label="Enable Nanopub Publishing"
          onChange={() => {
            setIsEnabled(!enablePublishing);
          }}
          className="mb-4"
        />
        <FormGroup inline={true} label="Node Type">
          <InputGroup
            placeholder="Enter URL to node type definition"
            value={nodeTypeValue}
            onChange={(e) => onChange(e.target.value)}
            className="mb-4"
            disabled={!enablePublishing}
          />
        </FormGroup>

        <H6>Template</H6>
        {triples.map((triple) => (
          <TripleInput
            node={node}
            key={triple.uid}
            triple={triple}
            onChange={(field, value) => updateTriple(triple.uid, field, value)}
            onDelete={() => removeTriple(triple.uid)}
            enabled={enablePublishing}
          />
        ))}

        <Button
          icon="plus"
          text="Add Triple"
          onClick={addTriple}
          className="mt-2 mr-2"
          disabled={!enablePublishing}
        />
        <Button
          icon="add"
          text="Use Default Template"
          className={isDefaultTemplate ? "hidden" : ""}
          onClick={() => {
            if (triples.length > 0) {
              setIsWarningDialogOpen(true);
            } else {
              handleConfirmUseDefault();
            }
          }}
          disabled={!enablePublishing}
        />
        <div className="mt-4">
          <Label>Available Placeholders</Label>
          <ul className="list-disc pl-5">
            {Object.entries(placeholders).map(([key, value]) => (
              <li key={key}>
                <code>{`{${key}}`}</code>: {value}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Default Template Warning Dialog */}
      <Dialog
        isOpen={isWarningDialogOpen}
        title="Confirm Action"
        onClose={() => setIsWarningDialogOpen(false)}
      >
        <div className={Classes.DIALOG_BODY}>
          <p>Are you Sure?</p>
          <p>
            This will replace the current triples with the default template.
          </p>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button
              intent={"danger"}
              onClick={() => setIsWarningDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button intent={"primary"} onClick={handleConfirmUseDefault}>
              Confirm
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
};

export default NanopubConfigPanel;
