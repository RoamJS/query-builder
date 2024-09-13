import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
} from "react";
import { Button, H5, TagInput, Intent } from "@blueprintjs/core";
import { MultiSelect } from "@blueprintjs/select";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import { PullBlock } from "roamjs-components/types";
import getBlockProps from "../../utils/getBlockProps";
import nanoid from "nanoid";
import { Contributor, NanopubPage } from "./Nanopub";

// https://credit.niso.org/ taxonomy roles
const creditRoles = [
  "Conceptualization",
  "Data curation",
  "Formal analysis",
  "Funding acquisition",
  "Investigation",
  "Methodology",
  "Project administration",
  "Software",
  "Resources",
  "Supervision",
  "Validation",
  "Visualization",
  "Writing – original draft",
  "Writing – review & editing",
];

const ContributorManager = ({
  pageUid,
  props,
  contributors,
  setContributors,
}: {
  pageUid: string;
  props: Record<string, unknown>;
  contributors: Contributor[];
  setContributors: React.Dispatch<React.SetStateAction<Contributor[]>>;
}) => {
  const debounceRef = useRef(0);
  const nanopubProps = props["nanopub"] as NanopubPage;
  const userDisplayNames = useMemo(() => {
    const queryResults = window.roamAlphaAPI.data.fast.q(
      `[:find (pull ?p [:user/email]) (pull ?r [:node/title]) :where 
        [?p :user/display-page ?r]
      ]`
    ) as [PullBlock, PullBlock][];

    return queryResults
      .map(([p, r]) =>
        r[":node/title"]?.startsWith("Anonymous") && p
          ? (p[":user/email"] as string) || ""
          : r[":node/title"] || ""
      )
      .filter(Boolean)
      .filter((name) => name !== "Anonymous");
  }, []);

  const updateContributorProps = useCallback(
    (newContributors: Contributor[]) => {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        window.roamAlphaAPI.updateBlock({
          block: {
            uid: pageUid,
            props: {
              ...props,
              nanopub: { ...nanopubProps, contributors: newContributors },
            },
          },
        });
      }, 1000);
    },
    [pageUid, props, nanopubProps]
  );
  useEffect(() => {
    updateContributorProps(contributors);
  }, [contributors, updateContributorProps]);

  return (
    <div className="space-y-4">
      <style>
        {`
 
      `}
      </style>
      <div className="space-y-2">
        {contributors.map((contributor, index) => (
          <ContributorRow
            key={contributor.id}
            contributor={contributor}
            // isEditing={isEditing}
            setContributors={setContributors}
            userDisplayNames={userDisplayNames}
          />
        ))}
      </div>
      <Button
        intent={Intent.PRIMARY}
        icon="add"
        onClick={() =>
          setContributors([
            ...contributors,
            { id: nanoid(), name: "", roles: [] },
          ])
        }
      >
        Add Contributor
      </Button>
    </div>
  );
};

const ContributorRow = memo(
  ({
    contributor,
    key,
    // isEditing,
    userDisplayNames,
    setContributors,
  }: {
    contributor: Contributor;
    key: string;
    // isEditing: boolean;
    setContributors: React.Dispatch<React.SetStateAction<Contributor[]>>;
    userDisplayNames: string[];
  }) => {
    const debounceRef = useRef(0);

    const setContributorName = useCallback(
      (newName: string, timeout: boolean = true) => {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(
          () => {
            setContributors((_contributors) =>
              _contributors.map((con) =>
                con.id === contributor.id ? { ...con, name: newName } : con
              )
            );
          },
          timeout ? 500 : 0
        );
      },
      [contributor.id, setContributors]
    );

    const setContributorRoles = useCallback(
      (v, contributor, remove = false) => {
        setContributors((_contributors) =>
          _contributors.map((c) =>
            contributor.id === c.id
              ? {
                  ...c,
                  roles: remove
                    ? c.roles?.filter((r) => r !== v)
                    : [...(c.roles || []), v],
                }
              : c
          )
        );
      },
      []
    );

    const removeContributor = useCallback(() => {
      setContributors((_contributors) =>
        _contributors.filter((c) => c.id !== contributor.id)
      );
    }, [contributor.id, setContributors]);

    return (
      <div key={key} className="flex items-center space-x-2">
        <AutocompleteInput
          // disabled={!isEditing}
          placeholder="Contributor name"
          value={contributor.name}
          setValue={setContributorName}
          options={userDisplayNames}
          onBlur={() => setContributorName(contributor.name, false)}
        />
        <MultiSelect
          fill={true}
          items={creditRoles}
          selectedItems={contributor.roles}
          onItemSelect={(item) => setContributorRoles(item, contributor)}
          tagRenderer={(item) => item}
          popoverProps={{ minimal: true }}
          itemListRenderer={({ items, renderItem }) => {
            return <div className="rounded p-1">{items.map(renderItem)}</div>;
          }}
          itemRenderer={(item, { modifiers, handleClick }) => {
            if (contributor.roles?.includes(item)) return null;
            if (!modifiers.matchesPredicate) return null;
            return (
              <Button
                minimal
                active={modifiers.active}
                onClick={handleClick}
                text={item}
                key={item}
                className="block w-full"
              />
            );
          }}
          tagInputProps={{
            onRemove: (item) => setContributorRoles(item, contributor, true),
            placeholder: "Click to add role(s)",
          }}
        />
        <Button icon="cross" minimal onClick={removeContributor} />
      </div>
    );
  }
);

export default ContributorManager;
