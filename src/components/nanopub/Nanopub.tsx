import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Dialog, Button } from "@blueprintjs/core";
import init, { KeyPair, Nanopub, NpProfile, getNpServer } from "@nanopub/sign";
import renderOverlay from "roamjs-components/util/renderOverlay";
import { getNodeEnv } from "roamjs-components/util/env";
import rdfString from "./exampleRdfString";
import { OnloadArgs } from "roamjs-components/types";
import { handleTitleAdditions } from "../../utils/handleTitleAdditions";
import matchDiscourseNode from "../../utils/matchDiscourseNode";
import getDiscourseNode from "../../utils/getDiscourseNode";
import isDiscourseNode from "../../utils/isDiscourseNode";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import getDiscourseContextResults from "../../utils/getDiscourseContextResults";
import { DiscourseContextResults } from "../DiscourseContext";
import ExtensionApiContextProvider, {
  useExtensionAPI,
} from "roamjs-components/components/ExtensionApiContext";
const SERVER_URL =
  getNodeEnv() === "development"
    ? "" // leave blank to publish to test server
    : getNpServer(false);
const PRIVATE_KEY =
  getNodeEnv() === "development"
    ? "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCjY1gsFxmak6SOCouJPuEzHNForkqFhgfHE3aAIAx"
    : "";
const ORCID = "https://orcid.org/0000-0000-0000-0000";
const NAME = "Test User";
const RDF_STR = rdfString;

export const NanoPubTitleButtons = ({
  uid,
  onloadArgs,
}: {
  uid: string;
  onloadArgs: OnloadArgs;
}) => {
  return (
    <div className="github-sync-container flex space-x-2">
      <Button
        text="Nanopub"
        icon="git-push"
        minimal
        outlined
        onClick={() => {
          render({ uid, onloadArgs });
        }}
      />
      {/* <Button
        text={!!issueNumber ? "GitHub Sync Details" : ""}
        icon="cog"
        minimal
        outlined
        onClick={async () => {
          renderOverlay({
            Overlay: IssueDetailsDialog,
            props: { pageUid },
          });
        }}
      /> */}
    </div>
  );
};

const DiscourseContextSection = ({
  discourseContext,
}: {
  discourseContext: DiscourseContextResults;
}) => {
  return (
    <>
      {discourseContext.map((context, index) => {
        const hasResults = Object.entries(context.results).length > 0;

        if (!hasResults) return null;

        return (
          <div key={index} className="sm:flex sm:space-x-4">
            <div className="font-semibold sm:w-1/3">
              {context.label.toLowerCase()}:
            </div>
            <div className="sm:w-2/3">
              {Object.values(context.results).map((value, idx) => (
                <div key={idx}>{value.text}</div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
};

const NanopubTriple = ({
  subject,
  object,
  predicate,
}: {
  subject: string;
  object: string;
  predicate: string;
}) => (
  <div className="grid grid-cols-12 gap-4 border-0 border-b sm:border-b-0 py-2">
    <div className="col-span-12 sm:col-span-2">{subject}</div>
    <div className="col-span-12 sm:col-span-2">{predicate}</div>
    <div className="col-span-12 sm:col-span-8">{object}</div>
  </div>
);

const NanopubDialog = ({
  uid,
  onloadArgs,
}: {
  uid: string;
  onloadArgs: any;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const handleClose = () => setIsOpen(false);
  // const [discourseContext, setDiscourseContext] =
  //   useState<DiscourseContextResults>([]);

  const node = useMemo(() => getDiscourseNode(uid), [uid]);
  if (!node) return <> </>;
  const templateTriples = node?.nanopub?.triples;
  const updateObjectPlaceholders = (object: string) => {
    const OCRID = onloadArgs.extensionAPI.settings.get("orcid") as string;
    const pageUrl = `https://roamresearch.com/${window.roamAlphaAPI.graph.name}/page/${uid}`;

    return object
      .replace(/\{nodeType\}/g, node.text)
      .replace(/\{title\}/g, getPageTitleByPageUid(uid))
      .replace(/\{name\}/g, getCurrentUserDisplayName())
      .replace(/\{url\}/g, pageUrl)
      .replace(/\{myORCID\}/g, OCRID)
      .replace(/\{createdBy\}/g, getCurrentUserDisplayName())
      .replace(/\{body\}/g, ""); // TODO: Add body
  };

  // useEffect(() => {
  //   const fetchDiscourseContext = async () => {
  //     const results = await getDiscourseContextResults({ uid });
  //     setDiscourseContext(results);
  //   };
  //   fetchDiscourseContext();
  // }, [uid]);

  const handlePublishIntro = async () => {
    try {
      const profile = new NpProfile(PRIVATE_KEY, ORCID, NAME, "");
      const np = new Nanopub(RDF_STR);
      const result = await np.publish(profile, SERVER_URL);

      console.log("Nanopub:", np.info());
      console.log("Published:", result.info());

      console.log("Info");
      console.log("-----------------");
      console.log("Private Key:", PRIVATE_KEY);
      console.log("ORCID:", ORCID);
      console.log("Name:", NAME);
      console.log("Server URL:", SERVER_URL);
      // console.log("RDF:", RDF_STR);
      console.log("-----------------");

      // handleClose();
    } catch (error) {
      console.error("Error publishing nanopub:", error);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Nanopub Publication"
      autoFocus={false}
      enforceFocus={false}
      className="w-full sm:w-full md:w-3/4 lg:w-full lg:max-w-5xl"
    >
      {node ? (
        <div className="bp3-dialog-body">
          <div className="space-y-4">
            {templateTriples?.map((triple) => (
              <NanopubTriple
                key={triple.uid}
                subject={node.text}
                predicate={triple.predicate}
                object={updateObjectPlaceholders(triple.object)}
              />
            ))}
          </div>
        </div>
      ) : (
        <p>No node found</p>
      )}
      <div className="bp3-dialog-footer">
        <div className="bp3-dialog-footer-actions">
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handlePublishIntro} intent={"primary"}>
            Publish Intro
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export const render = ({ uid, onloadArgs }: { uid: string; onloadArgs: any }) =>
  renderOverlay({ Overlay: NanopubDialog, props: { uid, onloadArgs } });
