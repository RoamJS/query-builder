import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Dialog, Button } from "@blueprintjs/core";

// web.js:1014 Uncaught (in promise) TypeError: Failed to construct 'URL': Invalid URL
//     at __wbg_init (web.js:1014:17)
//     at Nanopub.tsx:200:7
// import init, { KeyPair, Nanopub, NpProfile, getNpServer } from "@nanopub/sign";
import init, {
  Nanopub,
  NpProfile,
  getNpServer,
  KeyPair,
} from "https://unpkg.com/@nanopub/sign";
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
import ContributorManager from "./ContributorManager";
const SERVER_URL =
  getNodeEnv() === "development"
    ? "" // leave blank to publish to test server
    : getNpServer(false);
const PRIVATE_KEY =
  getNodeEnv() === "development"
    ? "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCjY1gsFxmak6SOCouJPuEzHNForkqFhgfHE3aAIAx+Y5q6UDEDM9Q0EksheNffJB4iPqsAfiFpY0ARQY92K5r8P4+a78eu9reYrb2WxZb1qPJmvR7XZ6sN1oHD7dd/EyQoJmQsmOKdrqaLRbzR7tZrf52yvKkwNWXcIVhW8uxe7iUgxiojZpW9srKoK/qFRpaUZSKn7Z/zgtDH9FJkYbBsGPDMqp78Kzt+sJb+U2W+wCSSy34jIUxx6QRbzvn6uexc/emFw/1DU5y7zBudhgC7mVk8vX1gUNKyjZBzlOmRcretrANgffqs5fx/TMHN1xtkA/H1u1IKBfKoyk/xThMLAgMBAAECggEAECuG0GZA3HF8OaqFgMG+W+agOvH04h4Pqv4cHjYNxnxpFcNV9nEssTKWSOvCwYy7hrwZBGV3PQzbjFmmrxVFs20+8yCD7KbyKKQZPVC0zf84bj6NTNgvr6DpGtDxINxuGaMjCt7enqhoRyRRuZ0fj2gD3Wqae/Ds8cpDCefkyMg0TvauHSUj244vGq5nt93txUv1Sa+/8tWZ77Dm0s5a3wUYB2IeAMl5WrO2GMvgzwH+zT+4kvNWg5S0Ze4KE+dG3lSIYZjo99h14LcQS9eALC/VBcAJ6pRXaCTT/TULtcLNeOpoc9Fu25f0yTsDt6Ga5ApliYkb7rDhV+OFrw1sYQKBgQDCE9so+dPg7qbp0cV+lbb7rrV43m5s9Klq0riS7u8m71oTwhmvm6gSLfjzqb8GLrmflCK4lKPDSTdwyvd+2SSmOXySw94zr1Pvc7sHdmMRyA7mH3m+zSOOgyCTTKyhDRCNcRIkysoL+DecDhNo4Fumf71tsqDYogfxpAQhn0re8wKBgQDXhMmmT2oXiMnYHhi2k7CJe3HUqkZgmW4W44SWqKHp0V6sjcHm0N0RT5Hz1BFFUd5Y0ZB3JLcah19myD1kKYCj7xz6oVLb8O7LeAZNlb0FsrtD7NU+Hciywo8qESiA7UYDkU6+hsmxaI01DsttMIdG4lSBbEjA7t4IQC5lyr7xiQKBgQCN87YGJ40Y5ZXCSgOZDepz9hqX2KGOIfnUv2HvXsIfiUwqTXs6HbD18xg3KL4myIBOvywSM+4ABYp+foY+Cpcq2btLIeZhiWjsKIrw71+Q/vIe0YDb1PGf6DsoYhmWBpdHzR9HN+hGjvwlsYny2L9Qbfhgxxmsuf7zeFLpQLijjwKBgH7TD28k8IOk5VKec2CNjKd600OYaA3UfCpP/OhDl/RmVtYoHWDcrBrRvkvEEd2/DZ8qw165Zl7gJs3vK+FTYvYVcfIzGPWA1KU7nkntwewmf3i7V8lT8ZTwVRsmObWU60ySJ8qKuwoBQodki2VX12NpMN1wgWe3qUUlr6gLJU4xAoGAet6nD3QKwk6TTmcGVfSWOzvpaDEzGkXjCLaxLKh9GreM/OE+h5aN2gUoFeQapG5rUwI/7Qq0xiLbRXw+OmfAoV2XKv7iI8DjdIh0F06mlEAwQ/B0CpbqkuuxphIbchtdcz/5ra233r3BMNIqBl3VDDVoJlgHPg9msOTRy13lFqc="
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

  const handlePublish = async () => {
    try {
      const privateKey = `MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCjY1gsFxmak6SOCouJPuEzHNForkqFhgfHE3aAIAx+Y5q6UDEDM9Q0EksheNffJB4iPqsAfiFpY0ARQY92K5r8P4+a78eu9reYrb2WxZb1qPJmvR7XZ6sN1oHD7dd/EyQoJmQsmOKdrqaLRbzR7tZrf52yvKkwNWXcIVhW8uxe7iUgxiojZpW9srKoK/qFRpaUZSKn7Z/zgtDH9FJkYbBsGPDMqp78Kzt+sJb+U2W+wCSSy34jIUxx6QRbzvn6uexc/emFw/1DU5y7zBudhgC7mVk8vX1gUNKyjZBzlOmRcretrANgffqs5fx/TMHN1xtkA/H1u1IKBfKoyk/xThMLAgMBAAECggEAECuG0GZA3HF8OaqFgMG+W+agOvH04h4Pqv4cHjYNxnxpFcNV9nEssTKWSOvCwYy7hrwZBGV3PQzbjFmmrxVFs20+8yCD7KbyKKQZPVC0zf84bj6NTNgvr6DpGtDxINxuGaMjCt7enqhoRyRRuZ0fj2gD3Wqae/Ds8cpDCefkyMg0TvauHSUj244vGq5nt93txUv1Sa+/8tWZ77Dm0s5a3wUYB2IeAMl5WrO2GMvgzwH+zT+4kvNWg5S0Ze4KE+dG3lSIYZjo99h14LcQS9eALC/VBcAJ6pRXaCTT/TULtcLNeOpoc9Fu25f0yTsDt6Ga5ApliYkb7rDhV+OFrw1sYQKBgQDCE9so+dPg7qbp0cV+lbb7rrV43m5s9Klq0riS7u8m71oTwhmvm6gSLfjzqb8GLrmflCK4lKPDSTdwyvd+2SSmOXySw94zr1Pvc7sHdmMRyA7mH3m+zSOOgyCTTKyhDRCNcRIkysoL+DecDhNo4Fumf71tsqDYogfxpAQhn0re8wKBgQDXhMmmT2oXiMnYHhi2k7CJe3HUqkZgmW4W44SWqKHp0V6sjcHm0N0RT5Hz1BFFUd5Y0ZB3JLcah19myD1kKYCj7xz6oVLb8O7LeAZNlb0FsrtD7NU+Hciywo8qESiA7UYDkU6+hsmxaI01DsttMIdG4lSBbEjA7t4IQC5lyr7xiQKBgQCN87YGJ40Y5ZXCSgOZDepz9hqX2KGOIfnUv2HvXsIfiUwqTXs6HbD18xg3KL4myIBOvywSM+4ABYp+foY+Cpcq2btLIeZhiWjsKIrw71+Q/vIe0YDb1PGf6DsoYhmWBpdHzR9HN+hGjvwlsYny2L9Qbfhgxxmsuf7zeFLpQLijjwKBgH7TD28k8IOk5VKec2CNjKd600OYaA3UfCpP/OhDl/RmVtYoHWDcrBrRvkvEEd2/DZ8qw165Zl7gJs3vK+FTYvYVcfIzGPWA1KU7nkntwewmf3i7V8lT8ZTwVRsmObWU60ySJ8qKuwoBQodki2VX12NpMN1wgWe3qUUlr6gLJU4xAoGAet6nD3QKwk6TTmcGVfSWOzvpaDEzGkXjCLaxLKh9GreM/OE+h5aN2gUoFeQapG5rUwI/7Qq0xiLbRXw+OmfAoV2XKv7iI8DjdIh0F06mlEAwQ/B0CpbqkuuxphIbchtdcz/5ra233r3BMNIqBl3VDDVoJlgHPg9msOTRy13lFqc=`;

      const serverUrl = "";
      const profile = new NpProfile(
        privateKey,
        "https://orcid.org/0000-0000-0000-0000",
        "User Name",
        ""
      );

      const np = await new Nanopub(RDF_STR).publish(profile, serverUrl);
      console.log("Published info dict:", np.info());
      // init().then(async () => {
      //   const profile = new NpProfile(PRIVATE_KEY, ORCID, NAME, "");

      //   const np = new Nanopub(RDF_STR);

      //   const result = await np.publish(profile, SERVER_URL);

      //   console.log("Nanopub:", np.info());
      //   console.log("Published:", result.info());

      //   console.log("Info");
      //   console.log("-----------------");
      //   console.log("Private Key:", PRIVATE_KEY);
      //   console.log("ORCID:", ORCID);
      //   console.log("Name:", NAME);
      //   console.log("Server URL:", SERVER_URL);
      //   // console.log("RDF:", RDF_STR);
      //   console.log("-----------------");
      // });

      // handleClose();
    } catch (error) {
      console.error("Error publishing nanopub:", error);
    }
  };

  // DEBUG
  // DEBUG
  // DEBUG
  const [rdfOutput, setRdfOutput] = useState("");
  const [checkedOutput, setCheckedOutput] = useState("");
  const [signedOutput, setSignedOutput] = useState("");
  const [publishedOutput, setPublishedOutput] = useState("");
  const [publishedURL, setPublishedURL] = useState("");
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);

  useEffect(() => {
    try {
      // @ts-ignore
      init().then(() => {
        console.log("WASM Initialized");
      });
    } catch (error) {
      console.error("Error initializing WASM:", error);
    }
  }, []);

  const generateKeyPair = () => {
    const keypair = new KeyPair().toJs();
    setKeyPair(keypair);
    console.log(keypair);
  };

  const checkNanopub = () => {
    const np = new Nanopub(RDF_STR);
    const checked = np.check();
    console.log("Checked info dict:", checked.info());
    console.log(checked);
    setCheckedOutput(JSON.stringify(checked.info(), null, 2));
  };

  const signNanopub = () => {
    const np = new Nanopub(RDF_STR);
    console.log(np);
    try {
      console.log("signNanopub");
      console.log(PRIVATE_KEY);
      console.log(ORCID);
      console.log(NAME);
      const profile = new NpProfile(PRIVATE_KEY, ORCID, NAME, "");
      console.log(profile);
      const signed = np.sign(profile);
      console.log("Signed info dict:", signed.info());
      console.log(signed);
      setSignedOutput(JSON.stringify(signed.info(), null, 2));
    } catch (error) {
      console.error("Error signing nanopub:", error);
    }
  };

  const publishNanopub = () => {
    const serverUrl = "";
    const profile = new NpProfile(PRIVATE_KEY, ORCID, NAME, "");
    const np = new Nanopub(RDF_STR);
    np.publish(profile, serverUrl).then((published) => {
      console.log("Published info dict:", published.info());
      setPublishedOutput(JSON.stringify(published.info(), null, 2));
      setRdfOutput(published.rdf());
      setPublishedURL(published.info().published);
    });
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
      <div className="bp3-dialog-body">
        <p>
          Key Pair:{" "}
          {keyPair
            ? `Public-${keyPair.public.length} Private-${keyPair.private.length}`
            : "No output"}
        </p>
        <p>
          Checked Output: {checkedOutput ? checkedOutput.length : "No output"}
        </p>
        <p>Signed Output: {signedOutput ? signedOutput.length : "No output"}</p>
        <p>
          Published Output:{" "}
          {publishedOutput ? publishedOutput.length : "No output"}
        </p>
        <p>RDF Output: {rdfOutput ? rdfOutput.length : "No output"}</p>
        <p>
          Published URL:{" "}
          {publishedURL ? (
            <a href={publishedURL} target="_blank" rel="noopener noreferrer">
              Link
            </a>
          ) : (
            "No URL"
          )}
        </p>
      </div>
      {/* {node ? (
        <div className="bp3-dialog-body">
          <div className="space-y-4">
            <ContributorManager pageUid={uid} />
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
      )} */}
      <div className="bp3-dialog-footer">
        <div className="bp3-dialog-footer-actions">
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={generateKeyPair} intent={"primary"}>
            Generate Key Pair
          </Button>
          <Button onClick={checkNanopub} intent={"primary"}>
            Check
          </Button>
          <Button onClick={signNanopub} intent={"primary"}>
            Sign
          </Button>
          <Button onClick={publishNanopub} intent={"primary"}>
            Publish
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export const render = ({ uid, onloadArgs }: { uid: string; onloadArgs: any }) =>
  renderOverlay({ Overlay: NanopubDialog, props: { uid, onloadArgs } });
