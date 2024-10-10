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
  Tooltip,
  Icon,
  Card,
} from "@blueprintjs/core";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import getSubTree from "roamjs-components/util/getSubTree";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import {
  defaultNanopubTemplate,
  nodeTypes,
} from "../../data/defaultNanopubTemplates";
import { DiscourseNode } from "../../utils/getDiscourseNodes";
import useSingleChildValue from "roamjs-components/components/ConfigPanels/useSingleChildValue";
import getFirstChildTextByBlockUid from "roamjs-components/queries/getFirstChildTextByBlockUid";
import NanopubBodySpecification from "./NanopubBodySpecification";

const placeholders = {
  nodeType: {
    text: "Type of Discourse Node",
    tooltip: "Defined in these settings",
  },
  // update this when cutover to specification
  // https://github.com/RoamJS/query-builder/issues/189
  title: {
    text: "Page Title",
    tooltip: "This will extract the {content} from the Format specification",
  },
  body: {
    text: "Page Body",
    tooltip: "The main content of the current Roam page",
  },
  url: {
    text: "Current page URL",
    tooltip: "The URL of the current Roam page",
  },
  myORCID: {
    text: "Your ORCID identifier",
    tooltip: "Defined in [[roam/js/discourse-graph]]",
  },
  createdBy: {
    text: "Creator of the page",
    tooltip: "The user who created the current Roam page",
  },
};

export const defaultPredicates = {
  "is a": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  "has the label": "http://www.w3.org/2000/01/rdf-schema#label",
  "has the description": "http://purl.org/dc/terms/description",
  "has more info at": "http://xmlns.com/foaf/0.1/page",
  "is attributed to": "http://www.w3.org/ns/prov#wasAttributedTo",
  "is created by": "http://purl.org/dc/terms/creator",
} as const;

export type PredicateKey = keyof typeof defaultPredicates;

export type TripleType = "assertion" | "provenance" | "publication info";

export type NanopubTripleType = {
  uid: string;
  predicate: PredicateKey | "";
  object: string;
  type: TripleType;
};

type GraphNode = {
  "@id": string;
  "@graph": Array<{
    "@id": string;
    [key: string]: any;
  }>;
};

type RDFStructure = {
  "@context": Record<string, string>;
  "@id": string;
  "@graph": {
    "@id": string;
    "@type": string;
    "np:hasPublicationInfo": GraphNode;
    "np:hasAssertion": GraphNode;
    "np:hasProvenance": GraphNode;
  };
};

export const baseRdf: RDFStructure = {
  "@context": {
    "@base": "http://purl.org/nanopub/temp/mynanopub#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    dc: "http://purl.org/dc/terms/",
    np: "http://www.nanopub.org/nschema#",
    foaf: "http://xmlns.com/foaf/0.1/",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    credit: "https://credit.niso.org/contributor-roles/",
  },
  "@id": "#Head",
  "@graph": {
    "@id": "#",
    "@type": "np:Nanopublication",
    "np:hasAssertion": {
      "@id": "#assertion",
      "@graph": [],
    },
    "np:hasProvenance": {
      "@id": "#provenance",
      "@graph": [],
    },
    "np:hasPublicationInfo": {
      "@id": "#pubinfo",
      "@graph": [],
    },
  },
};

const TripleInput = React.memo(
  ({
    triple,
    onChange,
    onDelete,
    enabled,
    node,
  }: {
    triple: NanopubTripleType;
    onChange: (field: keyof NanopubTripleType, value: string) => void;
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
            const objectUid = getFirstChildUidByBlockUid(uid);
            if (!objectUid) return;
            updateBlock({ text: value, uid: objectUid });
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
          options={Object.keys(defaultPredicates)}
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
}: {
  uid: string;
  node: DiscourseNode;
}) => {
  const tree = useMemo(() => getBasicTreeByParentUid(uid), [uid]);
  const [isEnabled, setIsEnabled] = useState(
    () => !!getSubTree({ tree, key: "enabled" }).uid
  );
  const triplesTree = useMemo(
    () => getSubTree({ tree, key: "triples" }),
    [tree]
  );
  const [requireContributors, setRequireContributors] = useState(
    () => !!getSubTree({ tree, key: "require-contributors" }).uid
  );

  const [triplesUid, setTriplesUid] = useState<string | null>(
    triplesTree.uid || null
  );
  const children = triplesTree.children;
  const [assertionUid, setAssertionUid] = useState<string | null>(
    () => getSubTree({ tree: children, key: "assertion" }).uid || null
  );
  const [provenanceUid, setProvenanceUid] = useState<string | null>(
    () => getSubTree({ tree: children, key: "provenance" }).uid || null
  );
  const [publicationInfoUid, setPublicationInfoUid] = useState<string | null>(
    () => getSubTree({ tree: children, key: "publication info" }).uid || null
  );
  const [triples, setTriples] = useState<NanopubTripleType[]>(() =>
    triplesTree.children.length
      ? triplesTree.children.flatMap((tripleType) =>
          tripleType.children.map((triple) => ({
            uid: triple.uid,
            predicate: triple.text as PredicateKey,
            object: triple.children[0]?.text || "",
            type: tripleType.text as TripleType,
          }))
        )
      : []
  );
  const nodeTypeUid = useMemo(
    () => tree.find((t) => t.text === "node-type")?.uid,
    [tree]
  );
  const defaultNodeType = useMemo(() => {
    if (!nodeTypeUid) return "";
    return getFirstChildTextByBlockUid(nodeTypeUid);
  }, [nodeTypeUid]);

  const { value: nodeTypeValue, onChange: setNodeType } = useSingleChildValue({
    uid: nodeTypeUid,
    defaultValue: defaultNodeType,
    title: "node-type",
    parentUid: uid,
    order: 0,
    transform: (s) => s,
    toStr: (s) => s,
  });

  const isDefaultTemplate = useMemo(() => {
    if (triples.length !== defaultNanopubTemplate.triples.length) return false;
    return triples.every((triple, index) => {
      const defaultTriple = defaultNanopubTemplate.triples[index];
      return (
        triple.predicate === defaultTriple.predicate &&
        triple.object === defaultTriple.object
      );
    });
  }, [triples]);
  const [isWarningDialogOpen, setIsWarningDialogOpen] = useState(false);
  const [isUseCustomBody, setIsUseCustomBody] = useState(
    () => !!getSubTree({ tree, key: "use-custom-body" }).uid
  );
  const customBodyDefinitionUid = useMemo(
    () =>
      getSubTree({ tree, parentUid: uid, key: "custom-body-definition" }).uid,
    [tree, uid]
  );

  const handleIsEnabled = useCallback(
    (b: boolean) => {
      setIsEnabled(b);
      return b
        ? createBlock({
            parentUid: uid,
            node: { text: "enabled" },
          })
        : deleteBlock(getSubTree({ parentUid: uid, key: "enabled" }).uid);
    },
    [uid]
  );
  const handleRequireContributors = useCallback(
    (b: boolean) => {
      setRequireContributors(b);
      return b
        ? createBlock({
            parentUid: uid,
            node: { text: "require-contributors" },
          })
        : deleteBlock(
            getSubTree({ parentUid: uid, key: "require-contributors" }).uid
          );
    },
    [uid]
  );
  const handleUseCustomBodyDefinition = useCallback(
    (b: boolean) => {
      setIsUseCustomBody(b);
      return b
        ? createBlock({
            parentUid: uid,
            node: { text: "use-custom-body" },
          })
        : deleteBlock(
            getSubTree({ parentUid: uid, key: "use-custom-body" }).uid
          );
    },
    [uid]
  );
  const addTriple = async (type: TripleType) => {
    const effectiveTriplesUid = triplesUid
      ? triplesUid
      : await createBlock({
          parentUid: uid,
          node: { text: "triples" },
        });

    const createTypeBlock = async (type: TripleType) => {
      return await createBlock({
        node: { text: type },
        parentUid: effectiveTriplesUid,
      });
    };
    let typeUid: string;

    // lots of unlikely error handling here
    // should we just create the type blocks on load/enable and expect user no not delete them?
    if (type === "assertion") {
      typeUid = assertionUid || (await createTypeBlock("assertion"));
      if (!assertionUid) setAssertionUid(typeUid);
    } else if (type === "provenance") {
      typeUid = provenanceUid || (await createTypeBlock("provenance"));
      if (!provenanceUid) setProvenanceUid(typeUid);
    } else if (type === "publication info") {
      typeUid =
        publicationInfoUid || (await createTypeBlock("publication info"));
      if (!publicationInfoUid) setPublicationInfoUid(typeUid);
    } else {
      return console.error("Invalid triple type");
    }

    const predicateUid = await createBlock({
      node: { text: "" },
      parentUid: typeUid,
      order: "last",
    });

    await createBlock({
      node: { text: "" },
      parentUid: predicateUid,
    });

    setTriples([
      ...triples,
      { uid: predicateUid, predicate: "", object: "", type },
    ]);
  };
  const updateTriple = useCallback(
    (uid: string, field: keyof NanopubTripleType, value: string) => {
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

  const setDefaultTemplate = async () => {
    if (triplesUid) deleteBlock(triplesUid);

    const template = structuredClone(defaultNanopubTemplate);
    // set uids
    template.triples = template.triples.map((triple) => ({
      ...triple,
      uid: window.roamAlphaAPI.util.generateUID(),
    }));
    // set node type
    const nodeText = node.text.toLowerCase();
    template.nodeType = nodeTypes[nodeText as keyof typeof nodeTypes] || "";

    const assertionUid = window.roamAlphaAPI.util.generateUID();
    const provenanceUid = window.roamAlphaAPI.util.generateUID();
    const publicationInfoUid = window.roamAlphaAPI.util.generateUID();

    const triples = template.triples;

    const newTriplesUid = await createBlock({
      parentUid: uid,
      node: {
        text: "triples",
        children: [
          {
            text: "assertion",
            uid: assertionUid,
            children: triples
              .filter((triple) => triple.type === "assertion")
              .map((triple) => ({
                text: triple.predicate,
                uid: triple.uid,
                children: [
                  {
                    text: triple.object,
                  },
                ],
              })),
          },
          {
            text: "provenance",
            uid: provenanceUid,
            children: triples
              .filter((triple) => triple.type === "provenance")
              .map((triple) => ({
                text: triple.predicate,
                uid: triple.uid,
                children: [
                  {
                    text: triple.object,
                  },
                ],
              })),
          },
          {
            text: "publication info",
            uid: publicationInfoUid,
            children: triples
              .filter((triple) => triple.type === "publication info")
              .map((triple) => ({
                text: triple.predicate,
                uid: triple.uid,
                children: [
                  {
                    text: triple.object,
                  },
                ],
              })),
          },
        ],
      },
    });

    setTriplesUid(newTriplesUid);
    setAssertionUid(assertionUid);
    setProvenanceUid(provenanceUid);
    setPublicationInfoUid(publicationInfoUid);
    handleRequireContributors(template.requireContributors);
    setNodeType(template.nodeType);
    setTriples(
      triples.map((triple) => ({
        uid: triple.uid,
        predicate: triple.predicate as PredicateKey,
        object: triple.object,
        type: triple.type as TripleType,
      }))
    );
    setIsWarningDialogOpen(false);
  };

  const assertions = triples.filter((triple) => triple.type === "assertion");
  const provenances = triples.filter((triple) => triple.type === "provenance");
  const publicationInfos = triples.filter(
    (triple) => triple.type === "publication info"
  );
  return (
    <>
      <div className="space-y-8">
        <Switch
          checked={isEnabled}
          label="Enable Nanopub Publishing"
          onChange={() => {
            handleIsEnabled(!isEnabled);
            if (!isEnabled && !triples.length) setDefaultTemplate();
          }}
        />
        <Switch
          label="Require Contributor Information"
          checked={requireContributors}
          onChange={() => {
            handleRequireContributors(!requireContributors);
          }}
          disabled={!isEnabled}
        />
        <Switch
          label="Use Custom {body} definition"
          checked={isUseCustomBody}
          onChange={() => {
            handleUseCustomBodyDefinition(!isUseCustomBody);
          }}
          disabled={!isEnabled}
        />
        <NanopubBodySpecification
          hidden={!isUseCustomBody}
          parentUid={customBodyDefinitionUid}
        />
        <FormGroup inline={true} label="Node Type" contentClassName="flex-grow">
          <InputGroup
            placeholder="Enter URL to node type definition"
            value={nodeTypeValue}
            onChange={(e) => setNodeType(e.target.value)}
            disabled={!isEnabled}
          />
        </FormGroup>

        {/* TEMPLATE */}
        <div className="relative">
          <Button
            icon="add"
            text="Use Default Template"
            disabled={!isEnabled}
            className={`absolute top-0 right-0 ${
              isDefaultTemplate ? "hidden" : ""
            }`}
            onClick={() => {
              if (triples.length > 0) {
                setIsWarningDialogOpen(true);
              } else {
                setDefaultTemplate();
              }
            }}
          />
          <Label>Template</Label>
          <Card className="space-y-4">
            <div className="space-y-4">
              {assertions.length ? <H6>Assertion</H6> : null}
              {assertions.map((triple) => (
                <TripleInput
                  node={node}
                  key={triple.uid}
                  triple={triple}
                  onChange={(field, value) =>
                    updateTriple(triple.uid, field, value)
                  }
                  onDelete={() => removeTriple(triple.uid)}
                  enabled={isEnabled}
                />
              ))}
              <Button
                icon="plus"
                text="Add Assertion"
                onClick={() => addTriple("assertion")}
                className="block"
                disabled={!isEnabled}
              />
            </div>
            <div className="space-y-4">
              {provenances.length ? <H6>Provenance</H6> : null}
              {provenances.map((triple) => (
                <TripleInput
                  node={node}
                  key={triple.uid}
                  triple={triple}
                  onChange={(field, value) =>
                    updateTriple(triple.uid, field, value)
                  }
                  onDelete={() => removeTriple(triple.uid)}
                  enabled={isEnabled}
                />
              ))}
              <Button
                icon="plus"
                text="Add Provenance"
                onClick={() => addTriple("provenance")}
                className="block"
                disabled={!isEnabled}
              />
            </div>
            <div className="space-y-4">
              {publicationInfos.length ? <H6>Publication info</H6> : null}
              {publicationInfos.map((triple) => (
                <TripleInput
                  node={node}
                  key={triple.uid}
                  triple={triple}
                  onChange={(field, value) =>
                    updateTriple(triple.uid, field, value)
                  }
                  onDelete={() => removeTriple(triple.uid)}
                  enabled={isEnabled}
                />
              ))}
              <Button
                icon="plus"
                text="Add Publication Info"
                onClick={() => addTriple("publication info")}
                className="block"
                disabled={!isEnabled}
              />
            </div>
          </Card>
        </div>

        {/* AVAILABLE PLACEHOLDERS */}
        <div className="mt-4">
          <Label>Available Placeholders</Label>
          <ul className="list-disc pl-5">
            {Object.entries(placeholders).map(([key, value]) => (
              <li key={key}>
                <div className="flex space-x-2">
                  <code>{`{${key}}`}</code>:<span>{value.text}</span>
                  <Tooltip content={value.tooltip}>
                    <Icon
                      icon={"info-sign"}
                      iconSize={12}
                      className="opacity-80"
                    />
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* DEFAULT TEMPLATE WARNING DIALOG */}
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
            <Button intent={"primary"} onClick={setDefaultTemplate}>
              Confirm
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
};

export default NanopubConfigPanel;
