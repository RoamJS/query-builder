import React, { useEffect, useState, useMemo } from "react";
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

export const NanoPubTitleButtons = ({ uid }: { uid: string }) => {
  return (
    <div className="github-sync-container flex space-x-2">
      <Button
        text="Nanopub"
        icon="git-push"
        minimal
        outlined
        onClick={() => {
          render({ uid });
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

const LabelValuePair = ({ label, value }: { label: string; value: string }) => (
  <div className="sm:flex sm:space-x-4">
    <div className="font-semibold sm:w-1/3">{label}:</div>
    <div className="sm:w-2/3">{value}</div>
  </div>
);

const NanopubDialog = ({ uid }: { uid: string }) => {
  const [isOpen, setIsOpen] = useState(true);
  const handleClose = () => setIsOpen(false);
  const [discourseContext, setDiscourseContext] =
    useState<DiscourseContextResults>([]);

  const node = useMemo(() => getDiscourseNode(uid), [uid]);
  const title = useMemo(() => getPageTitleByPageUid(uid), [uid]);
  const name = useMemo(() => getCurrentUserDisplayName(), []);
  const pageUrl = `https://roamresearch.com/${window.roamAlphaAPI.graph.name}/page/${uid}`;
  useEffect(() => {
    const fetchDiscourseContext = async () => {
      const results = await getDiscourseContextResults({ uid });
      setDiscourseContext(results);
    };
    fetchDiscourseContext();
  }, [uid]);
  const ORCID = "0000-0000-0000-0000";

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
            <LabelValuePair label="is a" value={node.text} />
            <LabelValuePair label="has the label" value={title} />
            <LabelValuePair label="has the description" value={`{body}`} />
            <LabelValuePair label="has more info at" value={pageUrl} />
            {/* <DiscourseContextSection discourseContext={discourseContext} /> */}
            <LabelValuePair label="is attributed to" value={ORCID} />
            <LabelValuePair label="is created by" value={name} />
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

export const render = ({ uid }: { uid: string }) =>
  renderOverlay({ Overlay: NanopubDialog, props: { uid } });
