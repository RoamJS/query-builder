import React, { useMemo, useState, useCallback, useRef, memo } from "react";
import { InputGroup, Button, Intent } from "@blueprintjs/core";
import { OnloadArgs, PullBlock } from "roamjs-components/types";
import { getSubTree } from "roamjs-components/util";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";

type NanopubMainConfigProps = {
  onloadArgs: OnloadArgs;
  uid: string;
};
export type PossibleContributor = {
  uid: string;
  name: string;
  orcid: string;
};

const NanopubMainConfig = ({ onloadArgs, uid }: NanopubMainConfigProps) => {
  const tree = useMemo(() => getBasicTreeByParentUid(uid), [uid]);
  const contributorsUid = useMemo<string>(
    () => getSubTree({ tree, key: "contributors", parentUid: uid }).uid,
    [tree, uid]
  );
  const [contributors, setContributors] = useState<PossibleContributor[]>(() =>
    getBasicTreeByParentUid(contributorsUid).map((c) => ({
      uid: c.uid,
      name: c.text,
      orcid: c.children[0]?.text,
    }))
  );

  const userDisplayNames = useMemo(() => {
    const queryResults = window.roamAlphaAPI.data.fast.q(
      `[:find (pull ?p [:user/email]) (pull ?r [:node/title]) :where 
        [?p :user/display-page ?r]
      ]`
    ) as [PullBlock, PullBlock][];

    return queryResults
      .map(([p, r]) => {
        const title = r?.[":node/title"];
        const email = p?.[":user/email"] as string | undefined;

        if (title && title.startsWith("Anonymous") && email) {
          return email;
        }
        return title || email || "";
      })
      .filter(Boolean)
      .filter((name) => name !== "Anonymous");
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {contributors.map((contributor, index) => (
          <ContributorRow
            key={contributor.uid}
            contributor={contributor}
            setContributors={setContributors}
            userDisplayNames={userDisplayNames}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          intent={Intent.PRIMARY}
          icon="add"
          onClick={async () =>
            setContributors([
              ...contributors,
              {
                uid: await createBlock({
                  parentUid: contributorsUid,
                  node: { text: "" },
                }),
                name: "",
                orcid: "",
              },
            ])
          }
        >
          Add Contributor
        </Button>
      </div>
    </div>
  );
};

const ContributorRow = memo(
  ({
    contributor,
    key,
    userDisplayNames,
    setContributors,
  }: {
    contributor: PossibleContributor;
    key: string;
    setContributors: React.Dispatch<
      React.SetStateAction<PossibleContributor[]>
    >;
    userDisplayNames: string[];
  }) => {
    const debounceRef = useRef(0);

    const setContributorName = useCallback(
      (newName: string) => {
        updateBlock({
          uid: contributor.uid,
          text: newName,
        });
        setContributors((_contributors) =>
          _contributors.map((con) =>
            con.uid === contributor.uid ? { ...con, name: newName } : con
          )
        );
      },
      [contributor.uid, setContributors]
    );
    const setContributorOrcid = useCallback(
      (newOrcid: string) => {
        const orcidUid = getFirstChildUidByBlockUid(contributor.uid);
        if (orcidUid) {
          updateBlock({
            uid: orcidUid,
            text: newOrcid,
          });
        } else {
          createBlock({
            parentUid: contributor.uid,
            node: { text: newOrcid },
          });
        }
        setContributors((_contributors) =>
          _contributors.map((con) =>
            con.uid === contributor.uid ? { ...con, orcid: newOrcid } : con
          )
        );
      },
      [contributor.uid, setContributors]
    );

    const removeContributor = useCallback(() => {
      setContributors((_contributors) =>
        _contributors.filter((c) => c.uid !== contributor.uid)
      );
      deleteBlock(contributor.uid);
    }, [contributor.uid, setContributors]);

    return (
      <div key={key} className="flex items-center space-x-2">
        <AutocompleteInput
          // disabled={!isEditing}
          placeholder="Contributor name"
          value={contributor.name}
          setValue={setContributorName}
          options={userDisplayNames}
          onBlur={(e) => setContributorName(e)}
        />
        <InputGroup
          placeholder="0000-0000-0000-0000"
          value={contributor.orcid}
          onChange={(e) => setContributorOrcid(e.target.value)}
          onBlur={(e) => setContributorOrcid(e.target.value)}
        />
        <Button icon="cross" minimal onClick={removeContributor} />
      </div>
    );
  }
);

export default NanopubMainConfig;
