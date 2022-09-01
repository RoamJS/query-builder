import { Filters } from "roamjs-components/components/Filter";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { OnloadArgs, RoamBasicNode } from "roamjs-components/types/native";
import getSettingIntFromTree from "roamjs-components/util/getSettingIntFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import { StoredFilters } from "../components/DefaultFilters";

const getFilterEntries = (
  n: Pick<RoamBasicNode, "children">
): [string, Filters][] =>
  n.children.map((c) => [
    c.text,
    {
      includes: {
        values: new Set(
          getSubTree({ tree: c.children, key: "includes" }).children.map(
            (t) => t.text
          )
        ),
      },
      excludes: {
        values: new Set(
          getSubTree({ tree: c.children, key: "excludes" }).children.map(
            (t) => t.text
          )
        ),
      },
      uid: c.uid,
    },
  ]);

const getSettings = (extensionAPI: OnloadArgs["extensionAPI"]) => {
  return {
    globalFiltersData: Object.fromEntries(
      Object.entries(
        (extensionAPI.settings.get("default-filters") as Record<
          string,
          StoredFilters
        >) || {}
      ).map(([k, v]) => [
        k,
        {
          includes: Object.fromEntries(
            Object.entries(v.includes || {}).map(([k, v]) => [k, new Set(v)])
          ),
          excludes: Object.fromEntries(
            Object.entries(v.excludes || {}).map(([k, v]) => [k, new Set(v)])
          ),
        },
      ])
    ),
    globalPageSize:
      Number(extensionAPI.settings.get("default-page-size")) || 10,
  };
};

const parseResultSettings = (
  parentUid: string,
  columns: string[],
  extensionAPI: OnloadArgs["extensionAPI"]
) => {
  const { globalFiltersData, globalPageSize } = getSettings(extensionAPI);
  const tree = getBasicTreeByParentUid(parentUid);
  const resultNode = getSubTree({ tree, key: "results" });
  const sortsNode = getSubTree({ tree: resultNode.children, key: "sorts" });
  const filtersNode = getSubTree({ tree: resultNode.children, key: "filters" });
  const filterEntries = getFilterEntries(filtersNode);
  const savedFilterData = filterEntries.length
    ? Object.fromEntries(filterEntries)
    : globalFiltersData;
  const random = getSettingIntFromTree({
    tree: resultNode.children,
    key: "random",
  });
  const pageSize =
    getSettingIntFromTree({ tree: resultNode.children, key: "size" }) ||
    globalPageSize;
  const viewsNode = getSubTree({ tree: resultNode.children, key: "views" });
  const savedViewData = Object.fromEntries(
    viewsNode.children.map((c) => [c.text, c.children[0]?.text])
  );
  return {
    activeSort: sortsNode.children.map((s) => ({
      key: s.text,
      descending: toFlexRegex("true").test(s.children[0]?.text || ""),
    })),
    filters: Object.fromEntries(
      columns.map((key) => [
        key,
        savedFilterData[key] || {
          includes: { values: new Set<string>() },
          excludes: { values: new Set<string>() },
        },
      ])
    ),
    views: Object.fromEntries(
      columns.map((key) => [
        key,
        savedViewData[key] || (key === "text" ? "link" : "plain"),
      ])
    ),
    random,
    pageSize,
    page: 1, // TODO save in roam data
  };
};

export default parseResultSettings;
