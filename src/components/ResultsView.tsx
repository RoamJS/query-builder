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
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import Filter, { Filters } from "roamjs-components/components/Filter";
import getSubTree from "roamjs-components/util/getSubTree";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import createBlock from "roamjs-components/writes/createBlock";
import { render as renderToast } from "roamjs-components/components/Toast";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import useSubTree from "roamjs-components/hooks/useSubTree";
import extractTag from "roamjs-components/util/extractTag";
import { DAILY_NOTE_PAGE_TITLE_REGEX } from "roamjs-components/date/constants";
import getSettingIntFromTree from "roamjs-components/util/getSettingIntFromTree";
import Export from "./Export";
import parseQuery from "../utils/parseQuery";
import { getDatalogQuery, getDatalogQueryComponents } from "../utils/fireQuery";
import type { RoamBasicNode } from "roamjs-components/types";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import type {
  QBClauseData,
  Result,
} from "roamjs-components/types/query-builder";
import parseResultSettings from "../utils/parseResultSettings";
import { useExtensionAPI } from "roamjs-components/components/ExtensionApiContext";
import postProcessResults from "../utils/postProcessResults";

type Sorts = { key: string; descending: boolean }[];
type FilterData = Record<string, Filters>;

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
  filters: FilterData;
  setFilters: (f: FilterData) => void;
  initialFilter: Filters;
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
  ctrlClick,
  views,
  extraColumn,
}: {
  r: Result;
  ctrlClick?: (e: Result) => void;
  views: Record<string, string>;
  extraColumn?: { row: (e: Result) => React.ReactNode; reserved: RegExp[] };
}) => {
  const rowCells = Object.keys(r).filter(
    (k) =>
      !UID_REGEX.test(k) &&
      !(extraColumn && extraColumn.reserved.some((t) => t.test(k)))
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
  const cell = (key: string) => {
    const value = toCellValue(r[key] || "");
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
          const val = r[k] || "";
          return (
            <td
              style={{
                textOverflow: "ellipsis",
                overflow: "hidden",
              }}
              key={k}
            >
              {val === "" ? (
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
                        text: toCellValue(val),
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
        {extraColumn && <td>{extraColumn.row(r)}</td>}
      </tr>
    </>
  );
};

const UID_REGEX = /uid/;
const toCellValue = (v: number | Date | string) =>
  v instanceof Date
    ? window.roamAlphaAPI.util.dateToPageTitle(v)
    : typeof v === "undefined" || v === null
    ? ""
    : extractTag(v.toString());

const QueryUsed = ({ parentUid }: { parentUid: string }) => {
  const { datalogQuery, englishQuery } = useMemo(() => {
    const args = parseQuery(parentUid);
    const datalogQuery = getDatalogQuery(getDatalogQueryComponents(args));
    const englishQuery = [
      `Find ${args.returnNode} Where`,
      ...(args.conditions as QBClauseData[]).map(
        (c) => `${c.not ? "NOT " : ""}${c.source} ${c.relation} ${c.target}`
      ),
      ...args.selections.map((s) => `Select ${s.text} AS ${s.label}`),
    ];
    return { datalogQuery, englishQuery };
  }, [parentUid]);
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
        <style>{`.roamjs-query-results-lang.bp3-control.bp3-switch .bp3-control-indicator-child:first-child {
    height: 0;
}`}</style>
        <Switch
          className={"roamjs-query-results-lang"}
          checked={isEnglish}
          onChange={(e) => setIsEnglish((e.target as HTMLInputElement).checked)}
          innerLabelChecked={"ENG"}
          innerLabel={"DATA"}
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
  onRefresh,
  getExportTypes,
  onResultsInViewChange,

  // @ts-ignore
  extraColumn,
}) => {
  const extensionAPI = useExtensionAPI();
  const columns = useMemo(
    () =>
      results.length
        ? Object.keys(results[0]).filter(
            (k) =>
              !UID_REGEX.test(k) &&
              !(
                extraColumn &&
                extraColumn.reserved.some((t: RegExp) => t.test(k))
              )
          )
        : ["text"],
    [results, extraColumn]
  );
  const settings = useMemo(
    () => parseResultSettings(parentUid, columns, extensionAPI),
    [parentUid]
  );
  const [activeSort, setActiveSort] = useState<Sorts>(settings.activeSort);
  const [filters, setFilters] = useState<FilterData>(() => settings.filters);
  const randomRef = useRef(settings.random);
  const [random, setRandom] = useState({ count: settings.random });
  const [page, setPage] = useState(settings.page);
  const [pageSize, setPageSize] = useState(settings.pageSize);
  const pageSizeTimeoutRef = useRef(0);
  const [views, setViews] = useState(settings.views);

  const preProcessedResults = useMemo(
    () => (resultFilter ? results.filter(resultFilter) : results),
    [results, resultFilter]
  );
  const { allResults, paginatedResults } = useMemo(() => {
    return postProcessResults(preProcessedResults, {
      activeSort,
      filters,
      random: random.count,
      page,
      pageSize,
    });
  }, [preProcessedResults, activeSort, filters, page, pageSize, random.count]);

  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    onResultsInViewChange?.(paginatedResults);
  }, [paginatedResults]);
  return (
    <div className="roamjs-query-results-view w-full">
      <div
        tabIndex={-1}
        className={"roamjs-query-results-header relative outline-none p-4"}
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
          <div className="roamjs-query-results-metadata">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <i style={{ opacity: 0.8 }}>
                <Button
                  icon={showContent ? "caret-down" : "caret-right"}
                  minimal
                  onClick={() => setShowContent(!showContent)}
                  style={{
                    marginRight: 16,
                  }}
                />
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
                                "Successfully saved query results settings!",
                              intent: Intent.SUCCESS,
                            })
                          );
                      }}
                    />
                  </Tooltip>
                )}
                {!preventExport && (
                  <Export
                    results={allResults}
                    exportTypes={getExportTypes?.(allResults)}
                  />
                )}
                {onEdit && (
                  <Tooltip content={"Edit Query"}>
                    <Button icon={"annotation"} minimal onClick={onEdit} />
                  </Tooltip>
                )}
                {onRefresh && (
                  <Tooltip content={"Refresh Results"}>
                    <Button icon={"refresh"} minimal onClick={onRefresh} />
                  </Tooltip>
                )}
              </span>
            </div>
            {showContent && <QueryUsed parentUid={parentUid} />}
          </div>
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
                  initialFilter={settings.filters[c]}
                  view={views[c]}
                  onViewChange={(v) => setViews({ ...views, [c]: v })}
                />
              ))}
              {extraColumn && (
                <th style={{ width: extraColumn.width }}>
                  {extraColumn.header}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedResults.map((r) => (
              <ResultView
                key={Object.values(r).join("-")}
                r={r}
                ctrlClick={ctrlClick}
                views={views}
                extraColumn={extraColumn}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={columns.length + (extraColumn ? 1 : 0)}
                style={{ padding: 0 }}
              >
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
                      defaultValue={settings.random.toString()}
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
                    <span style={{ margin: "4px 0" }}>{page}</span>
                    <Button
                      minimal
                      icon={"chevron-right"}
                      onClick={() => setPage(page + 1)}
                      disabled={
                        page === Math.ceil(allResults.length / pageSize) ||
                        allResults.length === 0
                      }
                    />
                    <Button
                      minimal
                      icon={"double-chevron-right"}
                      disabled={
                        page === Math.ceil(allResults.length / pageSize) ||
                        allResults.length === 0
                      }
                      onClick={() =>
                        setPage(Math.ceil(allResults.length / pageSize))
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
