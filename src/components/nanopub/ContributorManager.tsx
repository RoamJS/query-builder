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

export type CreditRole = {
  label: string;
  uri: string;
  verb: string;
};
export const creditRoles: CreditRole[] = [
  {
    uri: "conceptualization",
    label: "Conceptualization",
    verb: "Conceptualized by",
  },
  {
    uri: "data-curation",
    label: "Data curation",
    verb: "Data curated by",
  },
  {
    uri: "formal-analysis",
    label: "Formal analysis",
    verb: "Formal analysis performed by",
  },
  {
    uri: "funding-acquisition",
    label: "Funding acquisition",
    verb: "Funding acquired by",
  },
  {
    uri: "investigation",
    label: "Investigation",
    verb: "Investigated by",
  },
  {
    uri: "methodology",
    label: "Methodology",
    verb: "Methodology developed by",
  },
  {
    uri: "project-administration",
    label: "Project administration",
    verb: "Project administered by",
  },
  {
    uri: "software",
    label: "Software",
    verb: "Software developed by",
  },
  {
    uri: "resources",
    label: "Resources",
    verb: "Resources provided by",
  },
  {
    uri: "supervision",
    label: "Supervision",
    verb: "Supervised by",
  },
  {
    uri: "validation",
    label: "Validation",
    verb: "Validated by",
  },
  {
    uri: "visualization",
    label: "Visualization",
    verb: "Visualization created by",
  },
  {
    uri: "writing-original-draft",
    label: "Writing – original draft",
    verb: "Original draft written by",
  },
  {
    uri: "writing-review-editing",
    label: "Writing – review & editing",
    verb: "Reviewed and edited by",
  },
];

const ContributorManager = ({
  pageUid,
  pageProps: props,
  node,
  contributors,
  setContributors,
  requireContributors = false,
  handleClose,
}: {
  pageUid: string;
  pageProps: Record<string, unknown>;
  node: string;
  contributors: Contributor[];
  setContributors: React.Dispatch<React.SetStateAction<Contributor[]>>;
  requireContributors?: boolean;
  handleClose: () => void;
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
      <div className={`${requireContributors ? "hidden" : ""}`}>
        <p className="text-warning">
          Warning: Contributes will not be added automatically to the template.
        </p>
        <p className="text-warning">
          Edit the template to add contributors to the nanopublication.
        </p>
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
          timeout ? 250 : 0
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
          onBlur={(e) => setContributorName(e, false)}
        />
        <MultiSelect
          fill={true}
          items={creditRoles.map((role) => role.label)}
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
