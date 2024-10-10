import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Dialog,
  Button,
  TextArea,
  Tabs,
  Tab,
  TabId,
  Label,
  Tag,
  Text,
  FormGroup,
  InputGroup,
} from "@blueprintjs/core";
// web.js:1014 Uncaught (in promise) TypeError: Failed to construct 'URL': Invalid URL
//     at __wbg_init (web.js:1014:17)
//     at Nanopub.tsx:200:7
// import init, { KeyPair, Nanopub, NpProfile, getNpServer } from "@nanopub/sign";
import init, {
  Nanopub,
  NpProfile,
  getNpServer,
  KeyPair,
  // @ts-ignore
} from "https://unpkg.com/@nanopub/sign";
import renderOverlay from "roamjs-components/util/renderOverlay";
import { OnloadArgs } from "roamjs-components/types";
import getDiscourseNode from "../../utils/getDiscourseNode";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import ContributorManager, { creditRoles } from "./ContributorManager";
import {
  baseRdf,
  defaultPredicates,
  NanopubTripleType,
  PredicateKey,
} from "./NanopubNodeConfig";
import getBlockProps from "../../utils/getBlockProps";
import getExportTypes, {
  extractContentFromFormat,
} from "../../utils/getExportTypes";
import { DiscourseNode } from "../../utils/getDiscourseNodes";
import apiPost from "roamjs-components/util/apiPost";
import { getExportSettings } from "../../utils/getExportSettings";

export type NanopubPage = {
  contributors: Contributor[];
  published?: string;
};
export type Contributor = {
  id: string;
  name: string;
  roles: string[];
};

// TEMP PRIVATE KEY
const PRIVATE_KEY =
  "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCjY1gsFxmak6SOCouJPuEzHNForkqFhgfHE3aAIAx+Y5q6UDEDM9Q0EksheNffJB4iPqsAfiFpY0ARQY92K5r8P4+a78eu9reYrb2WxZb1qPJmvR7XZ6sN1oHD7dd/EyQoJmQsmOKdrqaLRbzR7tZrf52yvKkwNWXcIVhW8uxe7iUgxiojZpW9srKoK/qFRpaUZSKn7Z/zgtDH9FJkYbBsGPDMqp78Kzt+sJb+U2W+wCSSy34jIUxx6QRbzvn6uexc/emFw/1DU5y7zBudhgC7mVk8vX1gUNKyjZBzlOmRcretrANgffqs5fx/TMHN1xtkA/H1u1IKBfKoyk/xThMLAgMBAAECggEAECuG0GZA3HF8OaqFgMG+W+agOvH04h4Pqv4cHjYNxnxpFcNV9nEssTKWSOvCwYy7hrwZBGV3PQzbjFmmrxVFs20+8yCD7KbyKKQZPVC0zf84bj6NTNgvr6DpGtDxINxuGaMjCt7enqhoRyRRuZ0fj2gD3Wqae/Ds8cpDCefkyMg0TvauHSUj244vGq5nt93txUv1Sa+/8tWZ77Dm0s5a3wUYB2IeAMl5WrO2GMvgzwH+zT+4kvNWg5S0Ze4KE+dG3lSIYZjo99h14LcQS9eALC/VBcAJ6pRXaCTT/TULtcLNeOpoc9Fu25f0yTsDt6Ga5ApliYkb7rDhV+OFrw1sYQKBgQDCE9so+dPg7qbp0cV+lbb7rrV43m5s9Klq0riS7u8m71oTwhmvm6gSLfjzqb8GLrmflCK4lKPDSTdwyvd+2SSmOXySw94zr1Pvc7sHdmMRyA7mH3m+zSOOgyCTTKyhDRCNcRIkysoL+DecDhNo4Fumf71tsqDYogfxpAQhn0re8wKBgQDXhMmmT2oXiMnYHhi2k7CJe3HUqkZgmW4W44SWqKHp0V6sjcHm0N0RT5Hz1BFFUd5Y0ZB3JLcah19myD1kKYCj7xz6oVLb8O7LeAZNlb0FsrtD7NU+Hciywo8qESiA7UYDkU6+hsmxaI01DsttMIdG4lSBbEjA7t4IQC5lyr7xiQKBgQCN87YGJ40Y5ZXCSgOZDepz9hqX2KGOIfnUv2HvXsIfiUwqTXs6HbD18xg3KL4myIBOvywSM+4ABYp+foY+Cpcq2btLIeZhiWjsKIrw71+Q/vIe0YDb1PGf6DsoYhmWBpdHzR9HN+hGjvwlsYny2L9Qbfhgxxmsuf7zeFLpQLijjwKBgH7TD28k8IOk5VKec2CNjKd600OYaA3UfCpP/OhDl/RmVtYoHWDcrBrRvkvEEd2/DZ8qw165Zl7gJs3vK+FTYvYVcfIzGPWA1KU7nkntwewmf3i7V8lT8ZTwVRsmObWU60ySJ8qKuwoBQodki2VX12NpMN1wgWe3qUUlr6gLJU4xAoGAet6nD3QKwk6TTmcGVfSWOzvpaDEzGkXjCLaxLKh9GreM/OE+h5aN2gUoFeQapG5rUwI/7Qq0xiLbRXw+OmfAoV2XKv7iI8DjdIh0F06mlEAwQ/B0CpbqkuuxphIbchtdcz/5ra233r3BMNIqBl3VDDVoJlgHPg9msOTRy13lFqc=";

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
    </div>
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
    <Text
      className="col-span-12 sm:col-span-2 truncate"
      title={subject}
      children={subject}
    />
    <Text
      className="col-span-12 sm:col-span-2 truncate"
      title={predicate}
      children={predicate}
    />
    <Text
      className="col-span-12 sm:col-span-8 truncate"
      title={object}
      children={object}
    />
  </div>
);

const getPageContent = async ({
  pageTitle,
  uid,
}: {
  pageTitle: string;
  uid: string;
}): Promise<string> => {
  const exportTypes = getExportTypes({
    exportId: "nanopub",
    results: [{ text: pageTitle, uid }],
    isExportDiscourseGraph: false,
  });
  const markdownExport = exportTypes.find((type) => type.name === "Markdown");
  if (!markdownExport) return "";
  const result = await markdownExport.callback({
    isSamePageEnabled: false,
    includeDiscourseContext: false,
    filename: "",
    isExportDiscourseGraph: false,
    settings: {
      frontmatter: [],
    },
  });
  const { content } = result[0];
  return content;
};

const NanopubDialog = ({
  uid,
  onloadArgs,
}: {
  uid: string;
  onloadArgs: any;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const handleClose = () => setIsOpen(false);
  const [rdfString, setRdfString] = useState("");
  const [error, setError] = useState<string>("");
  const props = useMemo(
    () => getBlockProps(uid) as Record<string, unknown>,
    [uid]
  );
  const nanopub = props["nanopub"] as NanopubPage;
  const initialContributors = nanopub?.contributors || [];
  const propsUrl = nanopub?.published;
  const [contributors, setContributors] =
    useState<Contributor[]>(initialContributors);
  const [publishedURL, setPublishedURL] = useState(propsUrl);
  const [selectedTabId, setSelectedTabId] = useState<TabId>("nanopub-details");
  const [discourseNode, setDiscourseNode] = useState<DiscourseNode | null>(
    null
  );
  useEffect(() => {
    const node = getDiscourseNode({ uid, cache: false });
    setDiscourseNode(node);
  }, []);
  const nanopubConfig = discourseNode?.nanopub;
  const templateTriples = nanopubConfig?.triples;
  const [resolvedTriples, setResolvedTriples] = useState<NanopubTripleType[]>(
    []
  );

  const updateObjectPlaceholders = async (object: string) => {
    const pageTitle = getPageTitleByPageUid(uid);
    const pageUrl = `https://roamresearch.com/${window.roamAlphaAPI.graph.name}/page/${uid}`;

    // use exportSettings?  or just enforce simplifiedTitle?
    // const { simplifiedFilename } = getExportSettings();
    // const title = simplifiedFilename
    //   ? extractContentFromFormat({ title: pageTitle })
    //   : pageTitle;

    return object
      .replace(/\{nodeType\}/g, nanopubConfig?.nodeType || "")
      .replace(/\{title\}/g, extractContentFromFormat({ title: pageTitle }))
      .replace(/\{name\}/g, getCurrentUserDisplayName())
      .replace(/\{url\}/g, pageUrl)
      .replace(/\{myORCID\}/g, orcidUrl)
      .replace(/\{createdBy\}/g, getCurrentUserDisplayName())
      .replace(/\{body\}/g, await getPageContent({ pageTitle, uid }));
  };

  const generateRdfString = async ({
    triples,
  }: {
    triples: NanopubTripleType[];
  }): Promise<string> => {
    const rdf = { ...baseRdf };

    rdf["@graph"]["np:hasAssertion"]["@graph"] = await Promise.all(
      triples
        .filter((triple) => triple.type === "assertion")
        .map(async (triple) => ({
          "@id": "#",
          [defaultPredicates[triple.predicate as PredicateKey]]: {
            "@value": await updateObjectPlaceholders(triple.object),
          },
        }))
    );

    rdf["@graph"]["np:hasProvenance"]["@graph"] = await Promise.all(
      triples
        .filter((triple) => triple.type === "provenance")
        .map(async (triple) => ({
          "@id": "#assertion",
          [defaultPredicates[triple.predicate as PredicateKey]]: {
            "@value": await updateObjectPlaceholders(triple.object),
          },
        }))
    );

    rdf["@graph"]["np:hasPublicationInfo"]["@graph"] = await Promise.all(
      triples
        .filter((triple) => triple.type === "publication info")
        .map(async (triple) => ({
          "@id": "#pubinfo",
          [defaultPredicates[triple.predicate as PredicateKey]]: {
            "@value": await updateObjectPlaceholders(triple.object),
          },
        }))
    );

    // Add timestamp to publication info
    rdf["@graph"]["np:hasPublicationInfo"]["@graph"].push({
      "@id": "#",
      "dct:created": {
        "@value": new Date().toISOString(),
        "@type": "xsd:dateTime",
      },
    });

    // Alias predicates
    Object.entries(defaultPredicates).map(([key, value]) => {
      rdf["@graph"]["np:hasPublicationInfo"]["@graph"].push({
        "@id": value,
        "rdfs:label": key,
      });
    });

    // DEV TODO REMOVE
    rdf["@graph"]["np:hasPublicationInfo"]["@graph"].push({
      "@id": "#",
      "@type": "npx:ExampleNanopub",
    });

    // Add contributors to provenance
    if (nanopubConfig?.requireContributors) {
      const props = getBlockProps(uid) as Record<string, unknown>;
      const nanopub = props["nanopub"] as NanopubPage;
      const contributors = nanopub?.contributors || [];
      if (contributors.length > 0) {
        const provenanceGraph = rdf["@graph"]["np:hasProvenance"]["@graph"];

        contributors.forEach((contributor) => {
          if (contributor.roles.length > 0) {
            contributor.roles.forEach((role) => {
              const roleUri = creditRoles.find((r) => r.label === role)?.uri;
              if (!roleUri) return;
              const newAssertion = {
                "@id": "#assertion",
                [`credit:${roleUri}`]: contributor.name,
              };
              provenanceGraph.push(newAssertion);
            });
          }
        });
      }
    }

    // Alias contributor roles
    creditRoles.forEach((role) => {
      rdf["@graph"]["np:hasPublicationInfo"]["@graph"].push({
        "@id": `credit:${role.uri}`,
        "rdfs:label": role.verb,
      });
    });

    return JSON.stringify(rdf, null, 2);
  };

  // DEV
  const [rdfOutput, setRdfOutput] = useState("");
  const [checkedOutput, setCheckedOutput] = useState("");
  const [signedOutput, setSignedOutput] = useState("");
  const [publishedOutput, setPublishedOutput] = useState("");
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [addDevUrl, setAddDevUrl] = useState("");

  // DEV
  const generateKeyPair = () => {
    const keypair = new KeyPair().toJs();
    setKeyPair(keypair);
    console.log(keypair);
  };
  const checkNanopub = () => {
    const np = new Nanopub(rdfString);
    const checked = np.check();
    console.log("Checked info dict:", checked.info());
    console.log(checked);
    setCheckedOutput(JSON.stringify(checked.info(), null, 2));
  };
  const signNanopub = () => {
    const np = new Nanopub(rdfString);
    console.log(np);
    try {
      console.log("signNanopub");
      console.log(PRIVATE_KEY);
      const ORCID = onloadArgs.extensionAPI.settings.get("orcid") as string;
      const NAME = getCurrentUserDisplayName();
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
  const DevDetails = () => {
    return (
      <div className="bp3-dialog-body flex flex-col space-y-4">
        <div className="dev">
          <p>
            Key Pair:{" "}
            {keyPair
              ? `Public-${keyPair.public.length} Private-${keyPair.private.length}`
              : "No output"}
          </p>
          <p>
            Checked Output: {checkedOutput ? checkedOutput.length : "No output"}
          </p>
          <p>
            Signed Output: {signedOutput ? signedOutput.length : "No output"}
          </p>
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
        <div className="dev flex space-x-2">
          <Button
            onClick={() => {
              window.roamAlphaAPI.updateBlock({
                block: {
                  uid,
                  props: {},
                },
              });
            }}
            intent="primary"
          >
            Clear Props
          </Button>
          <Button
            onClick={() => {
              if (!templateTriples) return console.log("No triples");
              console.log(generateRdfString({ triples: templateTriples }));
            }}
            intent={"primary"}
          >
            Console Log RDF
          </Button>
          <Button onClick={generateKeyPair} intent={"primary"}>
            Generate Key Pair
          </Button>
          <Button onClick={checkNanopub} intent={"primary"}>
            Check
          </Button>
          <Button onClick={signNanopub} intent={"primary"}>
            Sign
          </Button>
          <Button
            onClick={() => publishNanopub({ isDev: "true" })}
            intent={"primary"}
          >
            Publish Test Server
          </Button>
        </div>
        <FormGroup label="Add Publish URL">
          <InputGroup
            value={addDevUrl}
            onChange={(e) => setAddDevUrl(e.target.value)}
            className="mb-4"
          />
          <Button
            onClick={() => {
              const props = getBlockProps(uid) as Record<string, unknown>;
              const nanopub = props["nanopub"] as NanopubPage;
              window.roamAlphaAPI.updateBlock({
                block: {
                  uid,
                  props: {
                    ...props,
                    nanopub: { ...nanopub, published: addDevUrl },
                  },
                },
              });
              setPublishedURL(addDevUrl);
              setSelectedTabId("nanopub-details");
            }}
            intent={"primary"}
          >
            Add URL
          </Button>
        </FormGroup>
      </div>
    );
  };
  // END DEV

  const orcidUrl = useMemo(() => {
    const hasORCID = onloadArgs.extensionAPI.settings.get("orcid") as string;
    const ORCID = hasORCID ? `https://orcid.org/${hasORCID}` : "";
    return ORCID;
  }, [onloadArgs]);

  const publishNanopub = async ({ isDev = "" }: { isDev?: string }) => {
    const requiresORCID = templateTriples?.some(
      (triple) => triple.object === "{myORCID}"
    );
    if (requiresORCID) {
      if (!orcidUrl) {
        setError(
          "This template requires your ORCID. Please set your ORCID in the main settings."
        );
        return;
      }
      const orcidRegex = /^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{4}$/;
      if (!orcidRegex.test(orcidUrl)) {
        setError("ORCID must be in the format 0000-0000-0000-0000");
        return;
      }
    }
    if (nanopubConfig?.requireContributors && contributors.length === 0) {
      setError(
        "This template requires contributors. Please add contributors to the nanopub."
      );
      return;
    }
    const rdfString = await generateRdfString({
      triples: templateTriples || [],
    });
    const serverUrl = isDev ? "" : getNpServer(false);
    const currentUser = getCurrentUserDisplayName();
    const profile = new NpProfile(PRIVATE_KEY, orcidUrl, currentUser, "");
    const np = new Nanopub(rdfString);
    try {
      const published = await np.publish(profile, serverUrl);
      const url = published.info().published;
      console.log("Published info dict:", published.info());
      setPublishedOutput(JSON.stringify(published.info(), null, 2));
      setRdfOutput(published.rdf());
      setPublishedURL(url);
      const props = getBlockProps(uid) as Record<string, unknown>;
      const nanopub = props["nanopub"] as NanopubPage;
      window.roamAlphaAPI.updateBlock({
        block: {
          uid,
          props: {
            ...props,
            nanopub: { ...nanopub, published: url },
          },
        },
      });
      setSelectedTabId("nanopub-details");
    } catch (e) {
      const error = e as Error;
      console.error("Error publishing the Nanopub:", error);
      setPublishedOutput(JSON.stringify({ error: error.message }, null, 2));
      apiPost({
        domain: "https://api.samepage.network",
        path: "errors",
        data: {
          method: "extension-error",
          type: "Nanopub Publish Failed",
          message: error.message,
          stack: error.stack,
          version: process.env.VERSION,
          data: {
            templateTriples,
            contributors,
            rdfString,
            orcidUrl,
          },
          notebookUuid: JSON.stringify({
            owner: "RoamJS",
            app: "query-builder",
            workspace: window.roamAlphaAPI.graph.name,
          }),
        },
      }).catch(() => {});
    }
  };

  const generateAndSetRDF = useCallback(async () => {
    const rdfString = await generateRdfString({
      triples: templateTriples || [],
    });
    setRdfString(rdfString);
  }, [templateTriples]);

  // Tabs
  const NanopubDetails = () => {
    return (
      <div className="flex flex-col space-y-6">
        <div>
          <Label>Status</Label>
          <span>
            {publishedURL ? (
              <Tag intent="success">Published</Tag>
            ) : (
              <Tag>Not Published</Tag>
            )}
          </span>
        </div>
        <div>
          <Label>URL</Label>
          <span>
            {publishedURL ? (
              <a href={publishedURL} target="_blank" rel="noopener noreferrer">
                {publishedURL}
              </a>
            ) : (
              "N/A"
            )}
          </span>
        </div>
      </div>
    );
  };
  const NanopubTemplate = ({
    node,
    handleClose,
  }: {
    node: string;
    handleClose: () => void;
  }) => {
    const uniqueTypes = Array.from(
      new Set(templateTriples?.map((triple) => triple.type) || [])
    );

    return (
      <>
        <div>
          {uniqueTypes.map((type) => (
            <div key={type}>
              <h3 className="text-lg font-semibold capitalize mb-2">{type}</h3>
              {templateTriples
                ?.filter((triple) => triple.type === type)
                .map((triple) => (
                  <NanopubTriple
                    key={triple.uid}
                    subject={discourseNode?.text || ""}
                    predicate={triple.predicate}
                    object={triple.object}
                  />
                ))}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button
            text="View Template"
            icon="link"
            onClick={() => {
              window.roamAlphaAPI.ui.mainWindow.openPage({
                page: {
                  title: `discourse-graph/nodes/${node}`,
                },
              });
              handleClose();
            }}
          />
        </div>
      </>
    );
  };
  const PreviewNanopub = ({
    // nodeText,
    // handleClose,
    contributors,
    resolvedTriples,
  }: {
    // nodeText: string;
    // handleClose: () => void;
    contributors: Contributor[];
    resolvedTriples: NanopubTripleType[];
  }) => {
    const uniqueTypes = Array.from(
      new Set(resolvedTriples?.map((triple) => triple.type) || [])
    );
    return (
      <>
        <div className="mb-4">
          {uniqueTypes.map((type) => (
            <div key={type}>
              <h3 className="text-lg font-semibold capitalize mb-2">{type}</h3>
              {resolvedTriples
                ?.filter((triple) => triple.type === type)
                .map((triple) => (
                  <NanopubTriple
                    key={triple.uid}
                    subject={discourseNode?.text || ""}
                    predicate={triple.predicate}
                    object={triple.object}
                  />
                ))}
            </div>
          ))}
          {nanopubConfig?.requireContributors &&
            contributors.flatMap((contributor) =>
              contributor.roles.map((role) => {
                const creditRole = creditRoles.find((r) => r.label === role);
                if (!creditRole) return;
                return (
                  <NanopubTriple
                    key={`${contributor.id}-${creditRole.uri}`}
                    subject={discourseNode?.text || ""}
                    predicate={creditRole.verb}
                    object={contributor.name}
                  />
                );
              })
            )}
        </div>
        {/* <Button
          text="Change Template"
          icon="link"
          onClick={() => {
            window.roamAlphaAPI.ui.mainWindow.openPage({
              page: {
                title: `discourse-graph/nodes/${nodeText}`,
              },
            });
            handleClose();
          }}
        /> */}
      </>
    );
  };
  const TripleString = () => {
    return (
      <div className="mt-4">
        <TextArea
          value={rdfString}
          fill
          rows={30}
          className="font-mono text-sm overflow-y-auto mb-4"
        />
        <Button
          onClick={async () => {
            const rdfString = await generateRdfString({
              triples: templateTriples || [],
            });
            setRdfString(rdfString);
          }}
          intent={"primary"}
        >
          Refresh
        </Button>
      </div>
    );
  };

  // Init WASM
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
  // Generate Initial RDF String
  useEffect(() => {
    generateAndSetRDF();
  }, []);
  // Resolve triple placeholders
  useEffect(() => {
    const resolveTriples = async () => {
      const resolved = await Promise.all(
        templateTriples?.map(async (triple) => {
          const updatedObject = await updateObjectPlaceholders(triple.object);
          return { ...triple, object: updatedObject };
        }) || []
      );
      setResolvedTriples(resolved);
    };
    resolveTriples();
  }, [templateTriples]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      // title="Nanopub Publication"
      autoFocus={false}
      enforceFocus={false}
      className="w-full sm:w-full md:w-3/4 lg:w-full lg:max-w-7xl bg-white"
      style={{ height: "80vh" }}
    >
      {discourseNode ? (
        <>
          <div className="bp3-dialog-body">
            <div className="space-y-4">
              <Tabs
                selectedTabId={selectedTabId}
                onChange={(id) => {
                  setError("");
                  setSelectedTabId(id);
                }}
              >
                <Tab
                  id="nanopub-details"
                  title="Details"
                  panel={<NanopubDetails />}
                />
                <Tab
                  id="nanopub-contributors"
                  title="Contributors"
                  panel={
                    <ContributorManager
                      pageUid={uid}
                      pageProps={props}
                      contributors={contributors}
                      setContributors={setContributors}
                      node={discourseNode.text}
                      handleClose={handleClose}
                      requireContributors={nanopubConfig?.requireContributors}
                    />
                  }
                />
                <Tab
                  id="nanopub-preview"
                  title="Preview"
                  panel={
                    <PreviewNanopub
                      // nodeText={discourseNode.text}
                      // handleClose={handleClose}
                      contributors={contributors}
                      resolvedTriples={resolvedTriples}
                    />
                  }
                />
                <Tab
                  id="nanopub-template"
                  title="Template"
                  panel={
                    <NanopubTemplate
                      node={discourseNode.text}
                      handleClose={handleClose}
                    />
                  }
                />

                <Tab id="triple-string" title="RDF" panel={<TripleString />} />

                <Tab id="dev-details" title="Dev" panel={<DevDetails />} />
              </Tabs>
            </div>
            {error && <p className="text-red-500 text-right">{error}</p>}
          </div>
          <div className="bp3-dialog-footer">
            <div className="bp3-dialog-footer-actions">
              <Button onClick={handleClose}>Close</Button>
              <Button
                onClick={() => setSelectedTabId("nanopub-preview")}
                hidden={!!publishedURL}
              >
                Preview
              </Button>
              <Button
                onClick={publishNanopub}
                intent={"primary"}
                disabled={selectedTabId !== "nanopub-preview"}
                hidden={!!publishedURL}
              >
                Publish Example Nanopub
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="bp3-dialog-body">
          <p>No node found</p>
          <Button onClick={handleClose}>Close</Button>
        </div>
      )}
    </Dialog>
  );
};

export const render = ({ uid, onloadArgs }: { uid: string; onloadArgs: any }) =>
  renderOverlay({ Overlay: NanopubDialog, props: { uid, onloadArgs } });
