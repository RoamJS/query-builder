import React, { useEffect, useMemo, useRef, useState } from "react";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import {
  Button,
  Icon,
  Tooltip,
  HTMLTable,
  InputGroup,
  Intent,
  Popover,
  Menu,
  MenuItem,
  Switch,
} from "@blueprintjs/core";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import toRoamDate from "roamjs-components/date/toRoamDate";
import Filter from "roamjs-components/components/Filter";
import getSubTree from "roamjs-components/util/getSubTree";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import createBlock from "roamjs-components/writes/createBlock";
import { render as renderToast } from "roamjs-components/components/Toast";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import useSubTree from "roamjs-components/hooks/useSubTree";
import extractTag from "roamjs-components/util/extractTag";
import { DAILY_NOTE_PAGE_TITLE_REGEX } from "roamjs-components/date/constants";
import parseRoamDate from "roamjs-components/date/parseRoamDate";
import getSettingIntFromTree from "roamjs-components/util/getSettingIntFromTree";
import Export from "./Export";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { getFilterEntries } from "./DefaultFilters";
import parseQuery from "../utils/parseQuery";
import { getDatalogQuery } from "../utils/fireQuery";
import { RoamBasicNode } from "roamjs-components/types";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";

export type Result = { text: string; uid: string } & Record<
  string,
  string | number | Date
>;

type Sorts = { key: string; descending: boolean }[];
type Filters = Record<
  string,
  {
    includes: Record<string, Set<string>>;
    excludes: Record<string, Set<string>>;
  }
>;

const sortFunction =
  (key: string, descending?: boolean) => (a: Result, b: Result) => {
    const _aVal = a[key];
    const _bVal = b[key];
    const aVal =
      typeof _aVal === "string" &&
      DAILY_NOTE_PAGE_TITLE_REGEX.test(extractTag(_aVal))
        ? parseRoamDate(extractTag(_aVal))
        : _aVal;
    const bVal =
      typeof _bVal === "string" &&
      DAILY_NOTE_PAGE_TITLE_REGEX.test(extractTag(_bVal))
        ? parseRoamDate(extractTag(_bVal))
        : _bVal;
    if (aVal instanceof Date && bVal instanceof Date) {
      return descending
        ? bVal.valueOf() - aVal.valueOf()
        : aVal.valueOf() - bVal.valueOf();
    } else if (typeof aVal === "number" && typeof bVal === "number") {
      return descending ? bVal - aVal : aVal - bVal;
    } else if (typeof aVal !== "undefined" && typeof bVal !== "undefined") {
      return descending
        ? bVal.toString().localeCompare(aVal.toString())
        : aVal.toString().localeCompare(bVal.toString());
    } else {
      return 0;
    }
  };

const VIEWS = ["link", "plain", "embed"];

const ResultHeader = ({
  c,
  results,
  activeSort,
  setActiveSort,
  filters,
  setFilters,
  initialFilter,
  view,
  onViewChange,
}: {
  c: string;
  results: Result[];
  activeSort: Sorts;
  setActiveSort: (s: Sorts) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  initialFilter: Filters[string];
  view: string;
  onViewChange: (s: string) => void;
}) => {
  const filterData = useMemo(
    () => ({
      values: Array.from(new Set(results.map((r) => toCellValue(r[c])))),
    }),
    [results, c]
  );
  const sortIndex = activeSort.findIndex((s) => s.key === c);
  return (
    <td
      style={{
        cursor: "pointer",
        textTransform: "capitalize",
      }}
      key={c}
      onClick={() => {
        if (sortIndex >= 0) {
          if (activeSort[sortIndex].descending) {
            setActiveSort(activeSort.filter((s) => s.key !== c));
          } else {
            setActiveSort(
              activeSort.map((s) =>
                s.key === c ? { key: c, descending: true } : s
              )
            );
          }
        } else {
          setActiveSort([...activeSort, { key: c, descending: false }]);
        }
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{c}</span>
        <span>
          {sortIndex >= 0 && (
            <span>
              <Icon
                icon={
                  activeSort[sortIndex].descending ? "sort-desc" : "sort-asc"
                }
              />
              ({sortIndex + 1})
            </span>
          )}
          <Filter
            data={filterData}
            initialValue={initialFilter}
            onChange={(newFilters) =>
              setFilters({ ...filters, [c]: newFilters })
            }
            renderButtonText={(s) =>
              s ? s.toString() : <i style={{ opacity: 0.5 }}>(Empty)</i>
            }
          />
          <span onClick={(e) => e.stopPropagation()}>
            <Tooltip content={"Switch View"}>
              <Popover
                target={<Button icon={"eye-open"} minimal />}
                content={
                  <Menu style={{ padding: 16 }}>
                    {VIEWS.map((c) => (
                      <MenuItem
                        active={c === view}
                        onClick={() => onViewChange(c)}
                        text={c}
                      />
                    ))}
                  </Menu>
                }
              />
            </Tooltip>
          </span>
        </span>
      </div>
    </td>
  );
};

const CellEmbed = ({ uid }: { uid: string }) => {
  const contentRef = useRef(null);
  useEffect(() => {
    window.roamAlphaAPI.ui.components.renderBlock({
      uid,
      el: contentRef.current,
    });
  }, [contentRef]);
  return <div ref={contentRef} className="roamjs-query-embed" />;
};

const ResultView = ({
  r,
  colSpan,
  ctrlClick,
  views,
}: {
  r: Result;
  colSpan: number;
  ctrlClick?: (e: Result) => void;
  views: Record<string, string>;
}) => {
  const rowCells = Object.keys(r).filter(
    (k) => !defaultFields.some((r) => r.test(k))
  );
  const [contextOpen, setContextOpen] = useState(false);
  const contextPageTitle = useMemo(
    () => r.context && getPageTitleByPageUid(r.context.toString()),
    [r.context]
  );
  const namespaceSetting = useMemo(
    () =>
      (
        window.roamAlphaAPI.data.fast.q(
          `[:find [pull ?u [:user/settings]] :where [?u :user/uid "${getCurrentUserUid()}"]]`
        )?.[0]?.[0] as {
          ":user/settings": {
            ":namespace-options": { name: "partial" | "none" | "full" }[];
          };
        }
      )?.[":user/settings"]?.[":namespace-options"]?.[0]?.name,
    []
  );
  const contextBreadCrumbs = useMemo(
    () =>
      r.context
        ? window.roamAlphaAPI
            .q(
              `[:find (pull ?p [:node/title :block/string :block/uid]) :where 
              [?b :block/uid "${r.context}"]
              [?b :block/parents ?p]
            ]`
            )
            .map(
              (a) => a[0] as { string?: string; title?: string; uid: string }
            )
            .map((a) => ({ uid: a.uid, text: a.string || a.title || "" }))
        : [],
    [r.context]
  );
  const contextChildren = useMemo(
    () =>
      r.context &&
      (contextPageTitle
        ? getShallowTreeByParentUid(r.context.toString()).map(({ uid }) => uid)
        : [r.context.toString()]),
    [r.context, contextPageTitle, r.uid]
  );
  const contextElement = useRef<HTMLTableCellElement>(null);
  useEffect(() => {
    if (contextOpen) {
      setTimeout(() => {
        contextChildren.forEach((uid) => {
          window.roamAlphaAPI.ui.components.renderBlock({
            uid,
            el: contextElement.current.querySelector(`div[data-uid="${uid}"]`),
          });
        });
      }, 1);
    }
  }, [contextOpen, contextElement, r.uid, contextPageTitle]);
  const cell = (key: string) => {
    const value = r[key] || "";
    const formattedValue =
      typeof value === "string" &&
      r[`${key}-uid`] &&
      !!getPageTitleByPageUid((r[`${key}-uid`] || "").toString())
        ? namespaceSetting === "full"
          ? value.split("/").slice(-1)[0]
          : namespaceSetting === "partial"
          ? value
              .split("/")
              .map((v, i, a) => (i === a.length - 1 ? v : v.slice(0, 1)))
              .join("/")
          : value
        : value;
    return formattedValue
      .toString()
      .split("<span>")
      .map((s, i) => (
        <span
          key={i}
          className={i % 2 === 0 ? "" : "roamjs-query-hightlighted-result"}
        >
          {s}
        </span>
      ));
  };
  return (
    <>
      <tr>
        {rowCells.map((k) => {
          const uid = (r[`${k}-uid`] || "").toString();
          return (
            <td
              style={{
                textOverflow: "ellipsis",
                overflow: "hidden",
              }}
              key={k}
            >
              {!r[k] ? (
                <i>[block is blank]</i>
              ) : views[k] === "link" ? (
                <a
                  className={"rm-page-ref"}
                  data-link-title={getPageTitleByPageUid(uid) || ""}
                  href={getRoamUrl(uid)}
                  onMouseDown={(e) => {
                    if (e.shiftKey) {
                      openBlockInSidebar(uid);
                      e.preventDefault();
                      e.stopPropagation();
                    } else if (e.ctrlKey) {
                      ctrlClick?.({
                        text: toCellValue(r[k] || ""),
                        uid,
                      });
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onClick={(e) => {
                    if (e.shiftKey || e.ctrlKey) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onContextMenu={(e) => {
                    if (e.ctrlKey) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                >
                  {cell(k)}
                </a>
              ) : views[k] === "embed" ? (
                <CellEmbed uid={uid} />
              ) : (
                cell(k)
              )}
            </td>
          );
        })}
        {r.context && (
          <td>
            <Tooltip content={"Context"}>
              <Button
                onClick={() => setContextOpen(!contextOpen)}
                active={contextOpen}
                style={{
                  opacity: 0.5,
                  fontSize: "0.8em",
                  ...(contextOpen
                    ? {
                        opacity: 1,
                        color: "#8A9BA8",
                        backgroundColor: "#F5F8FA",
                      }
                    : {}),
                }}
                minimal
                icon="info-sign"
              />
            </Tooltip>
          </td>
        )}
      </tr>
      {contextOpen && (
        <tr>
          <td
            ref={contextElement}
            style={{
              position: "relative",
              backgroundColor: "#F5F8FA",
              padding: 16,
              maxHeight: 240,
              overflowY: "scroll",
            }}
            colSpan={colSpan}
          >
            {contextPageTitle ? (
              <h3 style={{ margin: 0 }}>{contextPageTitle}</h3>
            ) : (
              <div className="rm-zoom">
                {contextBreadCrumbs.map((bc) => (
                  <div key={bc.uid} className="rm-zoom-item">
                    <span className="rm-zoom-item-content">{bc.text}</span>
                    <Icon icon={"chevron-right"} />
                  </div>
                ))}
              </div>
            )}
            {contextChildren.map((uid) => (
              <div data-uid={uid} key={uid}></div>
            ))}
          </td>
        </tr>
      )}
    </>
  );
};

const defaultFields = [/uid/, /context/];
const toCellValue = (v: number | Date | string) =>
  v instanceof Date
    ? toRoamDate(v)
    : typeof v === "undefined"
    ? ""
    : extractTag(v.toString());

const QueryUsed = ({ queryNode }: { queryNode: RoamBasicNode }) => {
  const { datalogQuery, englishQuery } = useMemo(() => {
    const parsed = parseQuery(queryNode);
    const datalogQuery = getDatalogQuery({
      conditions: parsed.conditionNodes,
      selections: parsed.selectionNodes,
      returnNode: parsed.returnNode,
    }).query;
    const englishQuery = queryNode.children.map((t) => t.text);
    return { datalogQuery, englishQuery };
  }, [queryNode]);
  const [isEnglish, setIsEnglish] = useState(true);
  return (
    <div
      style={{
        fontSize: 10,
        position: "relative",
        display: "flex",
      }}
    >
      <div
        style={{
          width: 240,
          marginRight: 16,
        }}
      >
        {isEnglish
          ? englishQuery.map((q, i) => (
              <p key={i} style={{ margin: 0 }}>
                {q}
              </p>
            ))
          : datalogQuery.split("\n").map((q, i) => (
              <p key={i} style={{ margin: 0 }}>
                {q}
              </p>
            ))}
      </div>
      <div>
        <Switch
          checked={isEnglish}
          onChange={(e) => setIsEnglish((e.target as HTMLInputElement).checked)}
        />
      </div>
    </div>
  );
};

const ResultsView: typeof window.roamjs.extension.queryBuilder.ResultsView = ({
  parentUid,
  header = "Results",
  results,
  hideResults = false,
  resultFilter,
  ctrlClick,
  preventSavingSettings = false,
  preventExport,
  onEdit,
  getExportTypes,
  onResultsInViewChange,
}) => {
  const tree = useMemo(() => getBasicTreeByParentUid(parentUid), [parentUid]);
  const configTree = useMemo(
    () =>
      getBasicTreeByParentUid(getPageUidByPageTitle("roam/js/query-builder")),
    []
  );
  const resultNode = useSubTree({ tree, key: "results" });
  const sortsNode = useSubTree({ tree: resultNode.children, key: "sorts" });
  const filtersNode = useSubTree({ tree: resultNode.children, key: "filters" });
  const viewsNode = useSubTree({ tree: resultNode.children, key: "views" });
  const queryNode = useSubTree({ tree, key: "query" });
  const columns = useMemo(
    () =>
      results.length
        ? [
            ...Object.keys(results[0]).filter(
              (k) => !defaultFields.some((r) => r.test(k))
            ),
            ...(results.some((r) => !!r.context) ? ["context"] : []),
          ]
        : ["text"],
    [results]
  );
  const [activeSort, setActiveSort] = useState<Sorts>(() =>
    sortsNode.children.map((s) => ({
      key: s.text,
      descending: toFlexRegex("true").test(s.children[0]?.text || ""),
    }))
  );
  const savedFilterData = useMemo(() => {
    const globalFilterData = getSubTree({
      key: "Default Filters",
      tree: configTree,
    });
    const filterEntries = getFilterEntries(filtersNode);
    return filterEntries.length
      ? Object.fromEntries(filterEntries)
      : Object.fromEntries(getFilterEntries(globalFilterData));
  }, [filtersNode, configTree]);
  const savedViewData = useMemo(
    () =>
      Object.fromEntries(
        viewsNode.children.map((c) => [c.text, c.children[0]?.text])
      ),
    [filtersNode]
  );
  const [filters, setFilters] = useState<Filters>(() =>
    Object.fromEntries(
      columns.map((key) => [
        key,
        savedFilterData[key] || {
          includes: { values: new Set() },
          excludes: { values: new Set() },
        },
      ])
    )
  );
  const sortedResults = useMemo(() => {
    const resultsToSort = resultFilter ? results.filter(resultFilter) : results;
    return resultsToSort
      .filter((r) => {
        return (
          Object.keys(filters).every(
            (filterKey) =>
              filters[filterKey].includes.values.size === 0 &&
              !filters[filterKey].excludes.values.has(toCellValue(r[filterKey]))
          ) ||
          Object.keys(filters).some((filterKey) =>
            filters[filterKey].includes.values.has(toCellValue(r[filterKey]))
          )
        );
      })
      .sort((a, b) => {
        for (const sort of activeSort) {
          const cmpResult = sortFunction(sort.key, sort.descending)(a, b);
          if (cmpResult !== 0) return cmpResult;
        }
        return 0;
      })
      .map((r) => ({
        uid: r.uid,
        text: r.text,
        ...Object.fromEntries(
          Object.entries(r)
            .filter(([k]) => k !== "uid" && k !== "text")
            .map(([k, v]) => [k, toCellValue(v)])
        ),
      }));
  }, [results, activeSort, filters, resultFilter]);
  const defaultRandomValue = useMemo(
    () => getSettingIntFromTree({ tree: resultNode.children, key: "random" }),
    [resultNode]
  );
  const randomRef = useRef(defaultRandomValue);
  const [random, setRandom] = useState({ count: defaultRandomValue });
  const resultsInView = useMemo(
    () =>
      random.count > 0
        ? sortedResults.sort(() => 0.5 - Math.random()).slice(0, random.count)
        : sortedResults,
    [random, sortedResults]
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(
    () =>
      getSettingIntFromTree({ tree: resultNode.children, key: "size" }) ||
      getSettingIntFromTree({
        tree: configTree,
        key: "Default page size",
        defaultValue: 10,
      })
  );
  const pageSizeTimeoutRef = useRef(0);
  const paginatedResults = useMemo(
    () => resultsInView.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, resultsInView]
  );
  const [views, setViews] = useState(
    Object.fromEntries(
      columns.map((key) => [
        key,
        savedViewData[key] || (key === "text" ? "link" : "plain"),
      ])
    )
  );
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    onResultsInViewChange?.(paginatedResults);
  }, [paginatedResults]);
  return (
    <div
      className="roamjs-query-results-view"
      style={{
        width: "100%",
      }}
    >
      <div
        tabIndex={-1}
        style={{ position: "relative", outline: "none", padding: 16 }}
      >
        <h4
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: 4,
          }}
        >
          {header}
        </h4>
        {!hideResults && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <i style={{ opacity: 0.8 }}>
                {!!queryNode.uid && (
                  <Button
                    icon={showContent ? "caret-down" : "caret-right"}
                    minimal
                    onClick={() => setShowContent(!showContent)}
                    style={{
                      marginRight: 16,
                    }}
                  />
                )}
                Showing {paginatedResults.length} of {results.length} results
              </i>
              <span>
                {!preventSavingSettings && (
                  <Tooltip content={"Save settings"}>
                    <Button
                      icon={"saved"}
                      minimal
                      onClick={() => {
                        const resultNode = getSubTree({
                          key: "results",
                          parentUid,
                        });
                        return (
                          resultNode.uid
                            ? Promise.all(
                                resultNode.children.map((c) =>
                                  deleteBlock(c.uid)
                                )
                              ).then(() => resultNode.uid)
                            : createBlock({
                                parentUid,
                                node: { text: "results" },
                              })
                        )
                          .then((uid) =>
                            Promise.all([
                              createBlock({
                                parentUid: uid,
                                node: {
                                  text: "filters",
                                  children: Object.entries(filters)
                                    .filter(
                                      ([, data]) =>
                                        data.includes.values.size ||
                                        data.excludes.values.size
                                    )
                                    .map(([column, data]) => ({
                                      text: column,
                                      children: [
                                        {
                                          text: "includes",
                                          children: Array.from(
                                            data.includes.values
                                          ).map((text) => ({ text })),
                                        },
                                        {
                                          text: "excludes",
                                          children: Array.from(
                                            data.excludes.values
                                          ).map((text) => ({ text })),
                                        },
                                      ],
                                    })),
                                },
                              }),
                              createBlock({
                                parentUid: uid,
                                node: {
                                  text: "sorts",
                                  children: activeSort.map((a) => ({
                                    text: a.key,
                                    children: [{ text: `${a.descending}` }],
                                  })),
                                },
                                order: 2,
                              }),
                              createBlock({
                                parentUid: uid,
                                node: {
                                  text: "views",
                                  children: Object.entries(views).map(
                                    ([key, value]) => ({
                                      text: key,
                                      children: [{ text: value }],
                                    })
                                  ),
                                },
                                order: 3,
                              }),
                              createBlock({
                                parentUid: uid,
                                node: {
                                  text: "random",
                                  children: [{ text: random.count.toString() }],
                                },
                                order: 4,
                              }),
                              createBlock({
                                parentUid: uid,
                                node: {
                                  text: "size",
                                  children: [{ text: pageSize.toString() }],
                                },
                                order: 5,
                              }),
                            ])
                          )
                          .then(() =>
                            renderToast({
                              id: "query-results-success",
                              content:
                                "Successfully saved query results' settings!",
                              intent: Intent.SUCCESS,
                            })
                          );
                      }}
                    />
                  </Tooltip>
                )}
                {!preventExport && (
                  <Export
                    results={resultsInView}
                    exportTypes={getExportTypes?.(resultsInView)}
                  />
                )}
                {onEdit && (
                  <Tooltip content={"Edit Query"}>
                    <Button icon={"edit"} minimal onClick={onEdit} />
                  </Tooltip>
                )}
              </span>
            </div>
            {showContent && <QueryUsed queryNode={queryNode} />}
          </>
        )}
      </div>
      {!hideResults && results.length !== 0 && (
        <HTMLTable
          style={{
            maxHeight: "400px",
            overflowY: "scroll",
            width: "100%",
            tableLayout: "fixed",
            borderRadius: 3,
          }}
          striped
          interactive
          bordered
        >
          <thead
            style={{
              background: "#eeeeee80",
            }}
          >
            <tr>
              {columns.map((c) => (
                <ResultHeader
                  key={c}
                  c={c}
                  results={results}
                  activeSort={activeSort}
                  setActiveSort={setActiveSort}
                  filters={filters}
                  setFilters={setFilters}
                  initialFilter={savedFilterData[c]}
                  view={views[c]}
                  onViewChange={(v) => setViews({ ...views, [c]: v })}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedResults.map((r) => (
              <ResultView
                key={Object.values(r).join("-")}
                r={r}
                colSpan={columns.length}
                ctrlClick={ctrlClick}
                views={views}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={columns.length} style={{ padding: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    opacity: 0.8,
                    background: "#eeeeee80",
                    padding: "8px 4px",
                  }}
                >
                  <span>
                    <InputGroup
                      defaultValue={defaultRandomValue.toString()}
                      onChange={(e) =>
                        (randomRef.current = Number(e.target.value))
                      }
                      rightElement={
                        <Tooltip content={"Select Random Results"}>
                          <Button
                            icon={"random"}
                            onClick={() =>
                              setRandom({ count: randomRef.current })
                            }
                            minimal
                          />
                        </Tooltip>
                      }
                      type={"number"}
                      style={{ width: 80 }}
                    />
                  </span>
                  <span style={{ display: "flex", alignItems: "center" }}>
                    <span>Rows per page:</span>
                    <InputGroup
                      defaultValue={pageSize.toString()}
                      onChange={(e) => {
                        clearTimeout(pageSizeTimeoutRef.current);
                        pageSizeTimeoutRef.current = window.setTimeout(() => {
                          setPageSize(Number(e.target.value));
                        }, 1000);
                      }}
                      type="number"
                      style={{
                        width: 60,
                        maxWidth: 60,
                        marginRight: 32,
                        marginLeft: 16,
                      }}
                    />
                    <Button
                      minimal
                      icon={"double-chevron-left"}
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                    />
                    <Button
                      minimal
                      icon={"chevron-left"}
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    />
                    <span style={{ margin: "4px 0" }}>{pageSize}</span>
                    <Button
                      minimal
                      icon={"chevron-right"}
                      onClick={() => setPage(page + 1)}
                      disabled={
                        page === Math.ceil(resultsInView.length / pageSize) ||
                        resultsInView.length === 0
                      }
                    />
                    <Button
                      minimal
                      icon={"double-chevron-right"}
                      disabled={
                        page === Math.ceil(resultsInView.length / pageSize) ||
                        resultsInView.length === 0
                      }
                      onClick={() =>
                        setPage(Math.ceil(resultsInView.length / pageSize))
                      }
                    />
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </HTMLTable>
      )}
    </div>
  );
};

export default ResultsView;
