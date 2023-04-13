import React, { useEffect, useMemo, useRef, useState } from "react";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import {
  Button,
  Icon,
  IconName,
  Tooltip,
  HTMLTable,
  InputGroup,
  Popover,
  Menu,
  MenuItem,
  Switch,
  Intent,
} from "@blueprintjs/core";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import Filter, { Filters } from "roamjs-components/components/Filter";
import getSubTree from "roamjs-components/util/getSubTree";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import createBlock from "roamjs-components/writes/createBlock";
import extractTag from "roamjs-components/util/extractTag";
import Export from "./Export";
import parseQuery from "../utils/parseQuery";
import { getDatalogQuery } from "../utils/fireQuery";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import type { Result } from "roamjs-components/types/query-builder";
import parseResultSettings from "../utils/parseResultSettings";
import { useExtensionAPI } from "roamjs-components/components/ExtensionApiContext";
import postProcessResults from "../utils/postProcessResults";
import setInputSetting from "roamjs-components/util/setInputSetting";
import getUids from "roamjs-components/dom/getUids";
import Charts from "./Charts";
import Timeline from "./Timeline";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import { RoamBasicNode } from "roamjs-components/types";
import { render as renderToast } from "roamjs-components/components/Toast";
import { ExportTypes, QBClauseData } from "../utils/types";

type Sorts = { key: string; descending: boolean }[];
type FilterData = Record<string, Filters>;

const VIEWS = ["link", "plain", "embed", "alias"];

const ResultHeader = ({
  c,
  results,
  activeSort,
  setActiveSort,
  filters,
  setFilters,
  initialFilter,
}: {
  c: string;
  results: Result[];
  activeSort: Sorts;
  setActiveSort: (s: Sorts) => void;
  filters: FilterData;
  setFilters: (f: FilterData) => void;
  initialFilter: Filters;
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
      <div className="flex items-center">
        <span className="inline-block mr-4">{c}</span>
        <span>
          <Filter
            data={filterData}
            initialValue={initialFilter}
            onChange={(newFilters) =>
              setFilters({ ...filters, [c]: newFilters })
            }
            renderButtonText={(s) =>
              s ? s.toString() : <i style={{ opacity: 0.5 }}>(Empty)</i>
            }
            small
          />
          {sortIndex >= 0 && (
            <span>
              <Icon
                icon={
                  activeSort[sortIndex].descending ? "sort-desc" : "sort-asc"
                }
              />
              <span style={{ fontSize: 8 }}>({sortIndex + 1})</span>
            </span>
          )}
        </span>
      </div>
    </td>
  );
};

const CellEmbed = ({ uid }: { uid: string }) => {
  const title = getPageTitleByPageUid(uid);
  const isPage = !!title ? "page-embed" : "block-embed";
  const contentRef = useRef(null);
  useEffect(() => {
    window.roamAlphaAPI.ui.components.renderBlock({
      uid,
      el: contentRef.current,
    });
  }, [contentRef]);
  return (
    <div className="roamjs-query-embed">
      {isPage === "page-embed" ? (
        <h1 className="rm-page-title">{title}</h1>
      ) : (
        ""
      )}
      <div ref={contentRef} className={isPage} />
    </div>
  );
};

const ResultView = ({
  r,
  ctrlClick,
  views,
  extraColumn,
}: {
  r: Result;
  ctrlClick?: (e: Result) => void;
  views: { column: string; mode: string; value: string }[];
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
  const viewsByColumn = useMemo(
    () => Object.fromEntries(views.map((v) => [v.column, v])),
    [views]
  );
  return (
    <>
      <tr>
        {rowCells.map((k) => {
          const uid = (r[`${k}-uid`] || "").toString();
          const val = r[k] || "";
          const { mode: view, value: viewValue } = viewsByColumn[k] || {};
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
              ) : view === "link" || view === "alias" ? (
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
                  {view === "alias" ? viewValue : cell(k)}
                </a>
              ) : view === "embed" ? (
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
    const { query: datalogQuery } = getDatalogQuery(args);
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
        padding: "8px",
      }}
      className={"roamjs-query-used"}
    >
      <div
        style={{
          flexShrink: 0,
          width: 100,
        }}
      >
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
        <Tooltip
          content={isEnglish ? "Copy English Query" : "Copy Datalog Query"}
          position={"right"}
          openOnTargetFocus={false}
          lazy={true}
          hoverOpenDelay={250}
          autoFocus={false}
        >
          <Button
            icon={"clipboard"}
            onClick={(e) => {
              const queryEl = (e.target as HTMLInputElement)
                .closest(".roamjs-query-used")
                .querySelector(".roamjs-query-used-text") as HTMLElement;
              navigator.clipboard.writeText(queryEl.innerText);
            }}
          />
        </Tooltip>
      </div>
      <div
        className={"roamjs-query-used-text"}
        style={{ whiteSpace: "pre-wrap" }}
      >
        {isEnglish
          ? englishQuery.map((q, i) => (
              <span key={i} style={{ margin: 0, display: "block" }}>
                {q}
              </span>
            ))
          : datalogQuery.split("\n").map((q, i) => (
              <span key={i} style={{ margin: 0, display: "block" }}>
                {q}
              </span>
            ))}
      </div>
    </div>
  );
};

const SUPPORTED_LAYOUTS = [
  { id: "table", icon: "join-table" },
  { id: "line", icon: "chart" },
  { id: "bar", icon: "vertical-bar-chart-asc" },
  { id: "timeline", icon: "timeline-events" },
] as const;

type ResultsViewComponent = (props: {
  parentUid: string;
  header?: React.ReactNode;
  results: Result[];
  hideResults?: boolean;
  resultFilter?: (r: Result) => boolean;
  ctrlClick?: (e: Result) => void;
  preventSavingSettings?: boolean;
  preventExport?: boolean;
  onEdit?: () => void;
  onRefresh?: () => void;
  getExportTypes?: (r: Result[]) => ExportTypes;
  onResultsInViewChange?: (r: Result[]) => void;
  globalFiltersData?: Record<string, Filters>;
  globalPageSize?: number;
}) => JSX.Element;

const ResultsView: ResultsViewComponent = ({
  parentUid,
  header,
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
  // @ts-ignore
  isEditBlock,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isEditViews, setIsEditViews] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isEditRandom, setIsEditRandom] = useState(false);
  const [isEditLayout, setIsEditLayout] = useState(false);
  const [layout, setLayout] = useState(
    settings.layout || SUPPORTED_LAYOUTS[0].id
  );
  const onViewChange = (view: typeof views[number], i: number) => {
    const newViews = views.map((v, j) => (i === j ? view : v));
    setViews(newViews);

    if (preventSavingSettings) return;
    const resultNode = getSubTree({
      key: "results",
      parentUid,
    });
    const viewsNode = getSubTree({
      key: "views",
      parentUid: resultNode.uid,
    });
    viewsNode.children.forEach((c) => deleteBlock(c.uid));

    newViews
      .map((v) => ({
        text: v.column,
        children: [
          { text: v.mode, children: v.value ? [{ text: v.value }] : [] },
        ],
      }))
      .forEach((node, order) =>
        createBlock({
          node,
          order,
          parentUid: viewsNode.uid,
        })
      );
  };
  return (
    <div
      className="roamjs-query-results-view w-full relative"
      ref={containerRef}
    >
      <Export
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        results={allResults}
        exportTypes={getExportTypes?.(allResults)}
      />
      <span className="absolute top-2 right-2 z-10">
        {onRefresh && (
          <Tooltip content={"Refresh Results"}>
            <Button icon={"refresh"} minimal onClick={onRefresh} small />
          </Tooltip>
        )}
        <Popover
          isOpen={moreMenuOpen}
          target={<Button minimal icon={"more"} />}
          onInteraction={(next, e) => {
            if (!e) return;
            const target = e.target as HTMLElement;
            if (
              target.classList.contains("bp3-menu-item") ||
              target.closest(".bp3-menu-item")
            ) {
              return;
            }
            setMoreMenuOpen(next);
          }}
          content={
            isEditRandom ? (
              <div className="relative w-72 p-4">
                <h4 className="font-bold flex justify-between items-center">
                  Get Random
                  <Button
                    icon={"small-cross"}
                    onClick={() => setIsEditRandom(false)}
                    minimal
                    small
                  />
                </h4>
                <InputGroup
                  defaultValue={settings.random.toString()}
                  onChange={(e) => (randomRef.current = Number(e.target.value))}
                  rightElement={
                    <Tooltip content={"Select Random Results"}>
                      <Button
                        icon={"random"}
                        onClick={() => {
                          setRandom({ count: randomRef.current });

                          if (preventSavingSettings) return;
                          const resultNode = getSubTree({
                            key: "results",
                            parentUid,
                          });
                          setInputSetting({
                            key: "random",
                            value: randomRef.current.toString(),
                            blockUid: resultNode.uid,
                          });
                        }}
                        minimal
                      />
                    </Tooltip>
                  }
                  type={"number"}
                  style={{ width: 80 }}
                />
              </div>
            ) : isEditLayout ? (
              <div className="relative w-72 p-4">
                <h4 className="font-bold flex justify-between items-center">
                  Layout
                  <Button
                    icon={"small-cross"}
                    onClick={() => setIsEditLayout(false)}
                    minimal
                    small
                  />
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  {SUPPORTED_LAYOUTS.map((l) => (
                    <div
                      className={`rounded-sm border py-2 px-6 flex flex-col gap-2 cursor-pointer ${
                        l.id === layout
                          ? "border-blue-300 border-opacity-75 text-blue-300"
                          : "border-gray-100 border-opacity-25 text-gray-100"
                      }`}
                      onClick={() => {
                        setLayout(l.id);
                        const resultNode = getSubTree({
                          key: "results",
                          parentUid,
                        });
                        setInputSetting({
                          key: "layout",
                          value: l.id,
                          blockUid: resultNode.uid,
                        });
                      }}
                    >
                      <Icon icon={l.icon} />
                      <span className="capitalize">{l.id}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : isEditViews ? (
              <div className="relative w-72 p-4">
                <h4 className="font-bold flex justify-between items-center">
                  Set Column Views
                  <Button
                    icon={"small-cross"}
                    onClick={() => setIsEditViews(false)}
                    minimal
                    small
                  />
                </h4>
                <div className="flex flex-col gap-1">
                  {views.map(({ column, mode, value }, i) => (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span style={{ flex: 1 }}>{column}</span>
                        <MenuItemSelect
                          className="roamjs-view-select"
                          items={VIEWS}
                          activeItem={mode}
                          onItemSelect={(m) => {
                            onViewChange({ mode: m, column, value }, i);
                          }}
                        />
                      </div>
                      {mode === "alias" && (
                        <InputGroup
                          value={value}
                          onChange={(e) => {
                            onViewChange(
                              { mode, column, value: e.target.value },
                              i
                            );
                          }}
                        />
                      )}
                    </>
                  ))}
                </div>
                {/* 
                Save this for when we move filters
                <Button
                  icon={"plus"}
                  text={"Add Filter"}
                  minimal
                  className="w-full"
                  onClick={() => {
                    setViews(
                      views.concat({ column: columns[0], mode: VIEWS[0] })
                    );

                    if (preventSavingSettings) return;
                    const resultNode = getSubTree({
                      key: "results",
                      parentUid,
                    });
                    const viewsNode = getSubTree({
                      key: "views",
                      parentUid: resultNode.uid,
                    });
                    createBlock({
                      node: {
                        text: columns[0],
                        children: [{ text: VIEWS[0] }],
                      },
                      order: viewsNode.children.length,
                      parentUid: viewsNode.uid,
                    });
                  }}
                /> */}
              </div>
            ) : (
              <Menu>
                {onEdit && (
                  <MenuItem
                    icon={"annotation"}
                    text={"Edit Query"}
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onEdit();
                    }}
                  />
                )}
                <MenuItem
                  icon={"layout"}
                  text={"Layout"}
                  onClick={() => {
                    setIsEditLayout(true);
                  }}
                />
                <MenuItem
                  icon={"eye-open"}
                  text={"Column Views"}
                  onClick={() => {
                    setIsEditViews(true);
                  }}
                />
                {!preventExport && (
                  <MenuItem
                    icon={"export"}
                    text={"Export"}
                    onClick={() => {
                      setMoreMenuOpen(false);
                      setIsExportOpen(true);
                    }}
                  />
                )}
                <MenuItem
                  icon={"random"}
                  text={"Get Random"}
                  onClick={() => setIsEditRandom(true)}
                />
                {isEditBlock && (
                  <MenuItem
                    icon={"edit"}
                    text={"Edit Block"}
                    onClick={() => {
                      const location = getUids(
                        containerRef.current.closest(
                          ".roam-block"
                        ) as HTMLDivElement
                      );
                      window.roamAlphaAPI.ui.setBlockFocusAndSelection({
                        location: {
                          "window-id": location.windowId,
                          "block-uid": location.blockUid,
                        },
                      });
                    }}
                  />
                )}
                <MenuItem
                  icon={"clipboard"}
                  text={"Copy Query"}
                  onClick={() => {
                    const getTextFromTreeToPaste = (
                      items: RoamBasicNode[],
                      indentLevel = 0
                    ): string => {
                      const indentation = "    ".repeat(indentLevel);

                      return items
                        .map((item) => {
                          const childrenText =
                            item.children.length > 0
                              ? getTextFromTreeToPaste(
                                  item.children,
                                  indentLevel + 1
                                )
                              : "";
                          return `${indentation}- ${item.text}\n${childrenText}`;
                        })
                        .join("");
                    };
                    const tree = getBasicTreeByParentUid(parentUid);
                    navigator.clipboard.writeText(
                      "- {{query block}}\n" + getTextFromTreeToPaste(tree, 1)
                    );
                    renderToast({
                      id: "query-copy",
                      content: "Copied Query",
                      intent: Intent.PRIMARY,
                    });
                  }}
                />
              </Menu>
            )
          }
        />
      </span>
      {header && (
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
      )}
      {!hideResults &&
        (results.length !== 0 ? (
          layout === "table" ? (
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
                      setActiveSort={(as) => {
                        setActiveSort(as);
                        if (preventSavingSettings) return;
                        const resultNode = getSubTree({
                          key: "results",
                          parentUid,
                        });
                        const sortsNode = getSubTree({
                          key: "sorts",
                          parentUid: resultNode.uid,
                        });
                        sortsNode.children.forEach((c) => deleteBlock(c.uid));
                        as.map((a) => ({
                          text: a.key,
                          children: [{ text: `${a.descending}` }],
                        })).forEach((node, order) =>
                          createBlock({ parentUid: sortsNode.uid, node, order })
                        );
                      }}
                      filters={filters}
                      setFilters={(fs) => {
                        setFilters(fs);

                        if (preventSavingSettings) return;
                        const resultNode = getSubTree({
                          key: "results",
                          parentUid,
                        });
                        const filtersNode = getSubTree({
                          key: "filters",
                          parentUid: resultNode.uid,
                        });
                        filtersNode.children.forEach((c) => deleteBlock(c.uid));
                        Object.entries(fs)
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
                                children: Array.from(data.includes.values).map(
                                  (text) => ({ text })
                                ),
                              },
                              {
                                text: "excludes",
                                children: Array.from(data.excludes.values).map(
                                  (text) => ({ text })
                                ),
                              },
                            ],
                          }))
                          .forEach((node, order) =>
                            createBlock({
                              parentUid: filtersNode.uid,
                              node,
                              order,
                            })
                          );
                      }}
                      initialFilter={settings.filters[c]}
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
                    style={{ padding: 0, background: "#eeeeee80" }}
                  >
                    <div
                      className="flex justify-between items-center"
                      style={{
                        opacity: 0.8,
                        padding: "8px 4px",
                      }}
                    >
                      <span>
                        <i style={{ opacity: 0.8 }}>
                          <Button
                            icon={showContent ? "caret-down" : "caret-right"}
                            minimal
                            small
                            onClick={() => setShowContent(!showContent)}
                            style={{
                              marginRight: 4,
                            }}
                          />
                          Showing {paginatedResults.length} of {results.length}{" "}
                          results
                        </i>
                      </span>
                      <span style={{ display: "flex", alignItems: "center" }}>
                        <span>Rows per page:</span>
                        <InputGroup
                          defaultValue={pageSize.toString()}
                          onChange={(e) => {
                            clearTimeout(pageSizeTimeoutRef.current);
                            pageSizeTimeoutRef.current = window.setTimeout(
                              () => {
                                setPageSize(Number(e.target.value));

                                if (preventSavingSettings) return;
                                const resultNode = getSubTree({
                                  key: "results",
                                  parentUid,
                                });
                                setInputSetting({
                                  key: "size",
                                  value: e.target.value,
                                  blockUid: resultNode.uid,
                                });
                              },
                              1000
                            );
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
                    {showContent && <QueryUsed parentUid={parentUid} />}
                  </td>
                </tr>
              </tfoot>
            </HTMLTable>
          ) : layout === "line" ? (
            <Charts type="line" data={allResults} columns={columns.slice(1)} />
          ) : layout === "bar" ? (
            <Charts type="bar" data={allResults} columns={columns.slice(1)} />
          ) : layout === "timeline" ? (
            <Timeline timelineElements={allResults} />
          ) : (
            <div>Layout `{layout}` is not supported</div>
          )
        ) : (
          <>
            <p className="px-2 py-3 flex justify-between items-center mb-0">
              <i>No Results Found</i>
            </p>
            <div style={{ background: "#eeeeee80" }}>
              <div
                className="flex justify-between items-center"
                style={{
                  opacity: 0.8,
                  padding: "8px 4px",
                }}
              >
                <span>
                  <i style={{ opacity: 0.8 }}>
                    <Button
                      icon={showContent ? "caret-down" : "caret-right"}
                      minimal
                      small
                      onClick={() => setShowContent(!showContent)}
                      style={{
                        marginRight: 4,
                      }}
                    />
                    Showing {paginatedResults.length} of {results.length}{" "}
                    results
                  </i>
                </span>
              </div>
              {showContent && <QueryUsed parentUid={parentUid} />}
            </div>
          </>
        ))}
    </div>
  );
};

export default ResultsView;
