import React, { useEffect, useState } from "react";
import { creditRoles } from "./ContributorManager";
import {
  Contributor,
  getOrcidUrl,
  NanopubTriple,
  updateObjectPlaceholders,
} from "./Nanopub";
import { NanopubTripleType } from "./NanopubNodeConfig";
import { DiscourseNode } from "../../utils/getDiscourseNodes";
import { OnloadArgs } from "roamjs-components/types";
import { Text, Button } from "@blueprintjs/core";

const PreviewNanopub = ({
  contributors,
  templateTriples,
  discourseNode,
  extensionAPI,
  pageUid,
}: {
  contributors?: Contributor[];
  templateTriples?: NanopubTripleType[];
  discourseNode: DiscourseNode;
  extensionAPI: OnloadArgs["extensionAPI"];
  pageUid: string;
}) => {
  const [resolvedTriples, setResolvedTriples] = useState<NanopubTripleType[]>(
    []
  );

  useEffect(() => {
    const orcidUrl = getOrcidUrl(extensionAPI);
    const resolveTriples = async () => {
      const resolved = await Promise.all(
        templateTriples?.map(async (triple) => {
          const updatedObject = await updateObjectPlaceholders({
            object: triple.object,
            pageUid,
            nanopubConfig: discourseNode.nanopub,
            extensionAPI,
            orcidUrl,
          });
          return { ...triple, object: updatedObject };
        }) || []
      );
      setResolvedTriples(resolved);
    };
    resolveTriples();
  }, [templateTriples]);

  const uniqueTypes = Array.from(
    new Set(resolvedTriples?.map((triple) => triple.type) || [])
  );
  const [previewDescription, setPreviewDescription] = useState("");

  if (previewDescription) {
    return (
      <div>
        <Button
          onClick={() => setPreviewDescription("")}
          icon={"arrow-left"}
          text={"Back"}
          className="mb-4"
          outlined
        />
        <div dangerouslySetInnerHTML={{ __html: previewDescription }} />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        {uniqueTypes.map((type) => (
          <div key={type}>
            <h3 className="text-lg font-semibold capitalize mb-2">{type}</h3>
            {resolvedTriples
              ?.filter((triple) => triple.type === type)
              .map((triple) => {
                const isHtmlDescription =
                  triple.type === "assertion" &&
                  triple.predicate === "has the description" &&
                  triple.object.startsWith("<body>");
                if (isHtmlDescription) {
                  return (
                    <div className="grid grid-cols-12 gap-4 border-0 border-b sm:border-b-0 py-2">
                      <Text
                        className="col-span-12 sm:col-span-2 truncate"
                        title={discourseNode?.text || ""}
                        children={discourseNode?.text || ""}
                      />
                      <Text
                        className="col-span-12 sm:col-span-2 truncate"
                        title={triple.predicate}
                        children={triple.predicate}
                      />
                      <div className="col-span-12 sm:col-span-3">
                        <Button
                          outlined
                          small
                          text={"View"}
                          onClick={() => setPreviewDescription(triple.object)}
                        />
                      </div>
                    </div>
                  );
                }
                return (
                  <NanopubTriple
                    key={triple.uid}
                    subject={discourseNode?.text || ""}
                    predicate={triple.predicate}
                    object={triple.object}
                  />
                );
              })}
          </div>
        ))}
        {discourseNode?.nanopub?.requireContributors &&
          contributors?.flatMap((contributor) =>
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

export default PreviewNanopub;
