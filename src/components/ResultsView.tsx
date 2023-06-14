import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Icon,
  Tooltip,
  InputGroup,
  Popover,
  Menu,
  MenuItem,
  Switch,
  Intent,
  Label,
} from "@blueprintjs/core";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { Filters } from "roamjs-components/components/Filter";
import getSubTree from "roamjs-components/util/getSubTree";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import createBlock from "roamjs-components/writes/createBlock";
import Export from "./Export";
import parseQuery from "../utils/parseQuery";
import { getDatalogQuery } from "../utils/fireQuery";
import parseResultSettings, {
  FilterData,
  Sorts,
  Views,
} from "../utils/parseResultSettings";
import { useExtensionAPI } from "roamjs-components/components/ExtensionApiContext";
import postProcessResults from "../utils/postProcessResults";
import setInputSetting from "roamjs-components/util/setInputSetting";
import getUids from "roamjs-components/dom/getUids";
import Charts from "./Charts";
import Timeline from "./Timeline";
import Kanban from "./Kanban";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import { RoamBasicNode } from "roamjs-components/types";
import { render as renderToast } from "roamjs-components/components/Toast";
import { Column, ExportTypes, Result } from "../utils/types";
import updateBlock from "roamjs-components/writes/updateBlock";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import { Condition } from "../utils/types";
import ResultsTable from "./ResultsTable";
import hashResults from "../utils/hashResults";

const VIEWS: Record<string, { value: boolean }> = {
  link: { value: false },
  plain: { value: false },
  embed: { value: false },
  alias: { value: true },
};

type EnglishQueryPart = { text: string; clickId?: string };

const QueryUsed = ({ parentUid }: { parentUid: string }) => {
  const { datalogQuery, englishQuery } = useMemo(() => {
    const args = parseQuery(parentUid);
    const { query: datalogQuery } = getDatalogQuery(args);
    const toEnglish = (c: Condition, level = 0): EnglishQueryPart[][] =>
      c.type === "or" || c.type === "not or"
        ? [
            [{ text: `${"".padStart(level * 2, " ")}OR` }],
            ...c.conditions.flatMap((cc) => [
              [{ text: `${"".padStart((level + 1) * 2, " ")}AND` }],
              ...cc.flatMap((ccc) => toEnglish(ccc, level + 2)),
            ]),
          ]
        : [
            [
              {
                text: `${"".padStart(level * 2, " ")}${
                  c.type === "not" ? "NOT " : ""
                }`,
              },
              { text: c.source, clickId: `${c.uid}-source` },
              { text: c.relation, clickId: `${c.uid}-relation` },
              { text: c.target, clickId: `${c.uid}-target` },
            ],
          ];
    const englishQuery: EnglishQueryPart[][] = [
      [{ text: `FIND` }, { text: args.returnNode }, { text: "WHERE" }],
      ...args.conditions.flatMap((c) => toEnglish(c)),
      ...args.selections.map((s) => [
        { text: "SELECT" },
        { text: s.text, clickId: `${s.uid}-select` },
        { text: "AS" },
        { text: s.label, clickId: `${s.uid}-as` },
      ]),
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
            minimal
            icon={"clipboard"}
            onClick={(e) => {
              const queryEl = (e.target as HTMLInputElement)
                ?.closest(".roamjs-query-used")
                ?.querySelector(".roamjs-query-used-text") as HTMLElement;
              navigator.clipboard.writeText(queryEl.innerText);
            }}
          />
        </Tooltip>
      </div>
      <div
        className={"roamjs-query-used-text"}
        style={{
          whiteSpace: "pre-wrap",
          fontFamily: isEnglish ? "inherit" : "monospace",
        }}
      >
        {isEnglish
          ? englishQuery.map((q, i) => (
              <span key={i} style={{ margin: 0, display: "block" }}>
                {q.map((p, j) => (
                  <span
                    key={j}
                    style={{
                      margin: 0,
                      cursor: p.clickId ? "pointer" : "inherit",
                    }}
                    onClick={() => {
                      if (!p.clickId) return;
                      const el = document.getElementById(p.clickId);
                      if (!el) return;
                      el.focus();
                    }}
                  >
                    {j !== 0 ? " " : ""}
                    {p.text}
                  </span>
                ))}
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
  {
    id: "table",
    icon: "join-table",
    settings: [
      {
        key: "rowStyle",
        label: "Row Style",
        options: ["Striped", "Bare"],
      },
    ],
  },
  { id: "line", icon: "chart", settings: [] },
  {
    id: "bar",
    icon: "vertical-bar-chart-asc",
    settings: [],
  },
  {
    id: "timeline",
    icon: "timeline-events",
    settings: [],
  },
  {
    id: "kanban",
    icon: "heat-grid",
    settings: [{ key: "key", label: "Group By", options: "columns" }],
  },
] as const;
const settingsById = Object.fromEntries(
  SUPPORTED_LAYOUTS.map((l) => [l.id, l.settings])
);

type ResultsViewComponent = (props: {
  parentUid: string;
  columns: Column[];
  header?: React.ReactNode;
  results: Result[];
  hideResults?: boolean;
  preventSavingSettings?: boolean;
  preventExport?: boolean;
  onEdit?: () => void;
  onRefresh: (loadInBackground?: boolean) => void;
  getExportTypes?: (r: Result[]) => ExportTypes;
  globalFiltersData?: Record<string, Filters>;
  globalPageSize?: number;
  isEditBlock?: boolean;
  // @deprecated - should be inferred from the query or layout
  onResultsInViewChange?: (r: Result[]) => void;
}) => JSX.Element;

const head = (s: string | string[]) => (Array.isArray(s) ? s[0] || "" : s);

const ResultsView: ResultsViewComponent = ({
  parentUid,
  columns,
  header,
  results,
  hideResults = false,
  preventSavingSettings = false,
  preventExport,
  onEdit,
  onRefresh,
  getExportTypes,
  onResultsInViewChange,
  isEditBlock,
}) => {
  const extensionAPI = useExtensionAPI();
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
  const [views, setViews] = useState<Views>(settings.views);
  const [searchFilter, setSearchFilter] = useState(() => settings.searchFilter);
  const [showInterface, setShowInterface] = useState(settings.showInterface);
  const [showMenuIcons, setShowMenuIcons] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    settings.notificationsEnabled
  );

  const { allResults, paginatedResults } = useMemo(() => {
    return postProcessResults(results, {
      activeSort,
      filters,
      random: random.count,
      page,
      pageSize,
      searchFilter,
    });
  }, [
    results,
    activeSort,
    filters,
    page,
    pageSize,
    random.count,
    searchFilter,
  ]);

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
  const [isEditSearchFilter, setIsEditSearchFilter] = useState(false);
  const [layout, setLayout] = useState(settings.layout);
  const layoutMode = useMemo(
    () => (Array.isArray(layout.mode) ? layout.mode[0] : layout.mode),
    [layout]
  );
  const onViewChange = (view: (typeof views)[number], i: number) => {
    const newViews = views.map((v, j) => (i === j ? view : v));
    setViews(newViews);

    if (preventSavingSettings) return;
    const viewsNode = getSubTree({
      key: "views",
      parentUid: settings.resultNodeUid,
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
  const debounceRef = useRef(0);
  useEffect(() => {
    if (notificationsEnabled)
      hashResults(results).then((hash) => {
        setInputSetting({
          blockUid: settings.resultNodeUid,
          key: "notifications",
          value: hash,
        });
      });
  }, [notificationsEnabled, results, settings.resultNodeUid]);
  return (
    <div
      className={`roamjs-query-results-view w-full relative mode-${layout.mode}`}
      ref={containerRef}
      onMouseOver={() => setShowMenuIcons(true)}
      onMouseOut={() => setShowMenuIcons(false)}
    >
      {isEditSearchFilter && (
        <div
          className="p-4 w-full"
          style={{
            background: "#eeeeee80",
          }}
        >
          <InputGroup
            fill={true}
            placeholder="Search"
            onChange={(e) => {
              window.clearTimeout(debounceRef.current);
              setSearchFilter(e.target.value);
              if (preventSavingSettings) return;
              const searchFilterNode = getSubTree({
                key: "searchFilter",
                parentUid: settings.resultNodeUid,
              });
              debounceRef.current = window.setTimeout(() => {
                const searchFilter = getFirstChildUidByBlockUid(
                  searchFilterNode.uid
                );
                if (searchFilter)
                  updateBlock({
                    uid: searchFilter,
                    text: e.target.value,
                  });
                else
                  createBlock({
                    parentUid: searchFilterNode.uid,
                    node: { text: e.target.value },
                  });
              }, 1000);
            }}
            defaultValue={searchFilter}
          />
        </div>
      )}
      <Export
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        results={allResults}
        exportTypes={getExportTypes?.(allResults)}
      />
      <div className="relative">
        <span
          className="absolute top-1 right-0 z-10"
          style={!showMenuIcons && !showInterface ? { display: "none" } : {}}
        >
          {onRefresh && (
            <Tooltip content={"Refresh Results"}>
              <Button icon={"refresh"} minimal onClick={() => onRefresh()} />
            </Tooltip>
          )}
          <Popover
            isOpen={moreMenuOpen}
            target={
              <Button
                minimal
                icon={"more"}
                className={
                  searchFilter && !isEditSearchFilter ? "bp-warning" : ""
                }
              />
            }
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
                    onChange={(e) =>
                      (randomRef.current = Number(e.target.value))
                    }
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
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {SUPPORTED_LAYOUTS.map((l) => (
                      <div
                        className={`rounded-sm border p-2 flex flex-col gap-2 items-center justify-center cursor-pointer ${
                          l.id === layoutMode
                            ? "border-blue-800 border-opacity-75 text-blue-800"
                            : "border-gray-800 border-opacity-25 text-gray-800"
                        }`}
                        onClick={() => {
                          setLayout({ ...layout, mode: l.id });
                          const resultNode = getSubTree({
                            key: "results",
                            parentUid,
                          });
                          const layoutNode = getSubTree({
                            key: "layout",
                            parentUid: resultNode.uid,
                          });
                          setInputSetting({
                            key: "mode",
                            value: l.id,
                            blockUid: layoutNode.uid,
                          });
                          setIsEditLayout(false);
                          setMoreMenuOpen(false);
                        }}
                      >
                        <Icon icon={l.icon} />
                        <span className="capitalize text-sm">{l.id}</span>
                      </div>
                    ))}
                  </div>
                  {settingsById[layoutMode].map((s) => {
                    const options =
                      s.options === "columns"
                        ? columns.slice(1).map((c) => c.key)
                        : s.options.slice();
                    return (
                      <Label key={s.key}>
                        {s.label}
                        <MenuItemSelect
                          activeItem={head(layout[s.key]) || options[0]}
                          onItemSelect={(value) => {
                            setLayout({ ...layout, [s.key]: value });
                            const resultNode = getSubTree({
                              key: "results",
                              parentUid,
                            });
                            const layoutNode = getSubTree({
                              key: "layout",
                              parentUid: resultNode.uid,
                            });
                            setInputSetting({
                              key: s.key,
                              value,
                              blockUid: layoutNode.uid,
                            });
                          }}
                          items={options}
                        />
                      </Label>
                    );
                  })}
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
                            items={Object.keys(VIEWS)}
                            activeItem={mode}
                            onItemSelect={(m) => {
                              onViewChange({ mode: m, column, value }, i);
                            }}
                          />
                        </div>
                        {VIEWS[mode]?.value && (
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
                  <MenuItem
                    icon={showInterface ? "th-disconnect" : "th"}
                    text={showInterface ? "Hide Interface" : "Show Interface"}
                    onClick={() => {
                      const resultNode = getSubTree({
                        key: "results",
                        parentUid,
                      });
                      setInputSetting({
                        key: "interface",
                        value: showInterface ? "hide" : "show",
                        blockUid: resultNode.uid,
                      });
                      setShowInterface((s) => !s);
                      setMoreMenuOpen(false);
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
                          containerRef.current?.closest(
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
                    icon={"search"}
                    text={isEditSearchFilter ? "Hide Search" : "Search"}
                    className={
                      searchFilter && !isEditSearchFilter ? "bp-warning" : ""
                    }
                    onClick={() => {
                      setMoreMenuOpen(false);
                      setIsEditSearchFilter((prevState) => !prevState);
                    }}
                  />
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
                  <MenuItem
                    icon={"notifications"}
                    text={
                      notificationsEnabled
                        ? "Turn off Notifications"
                        : "Turn on Notifications"
                    }
                    onClick={() => {
                      renderToast({
                        id: "notifications-enabled",
                        content: notificationsEnabled
                          ? "Turned off Notifications"
                          : "Turned on Notifications",
                        intent: Intent.PRIMARY,
                      });
                      setMoreMenuOpen(false);
                      const resultNode = getSubTree({
                        key: "results",
                        parentUid,
                      });
                      const newNotificationsEnabled = !notificationsEnabled;
                      setNotificationsEnabled(newNotificationsEnabled);
                      if (newNotificationsEnabled) {
                        createBlock({
                          node: { text: "notifications" },
                          parentUid: resultNode.uid,
                        });
                      } else {
                        deleteBlock(
                          getSubTree({
                            key: "notifications",
                            parentUid: resultNode.uid,
                          }).uid
                        );
                      }
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
            layoutMode === "table" ? (
              <ResultsTable
                layout={layout}
                columns={columns}
                results={paginatedResults}
                parentUid={settings.resultNodeUid}
                activeSort={activeSort}
                setActiveSort={setActiveSort}
                filters={filters}
                setFilters={setFilters}
                views={views}
                page={page}
                setPage={setPage}
                pageSize={pageSize}
                setPageSize={setPageSize}
                pageSizeTimeoutRef={pageSizeTimeoutRef}
                onRefresh={onRefresh}
                allResultsLength={allResults.length}
                showInterface={showInterface}
              />
            ) : layoutMode === "line" ? (
              <Charts
                type="line"
                data={allResults}
                columns={columns.slice(1)}
              />
            ) : layoutMode === "bar" ? (
              <Charts type="bar" data={allResults} columns={columns.slice(1)} />
            ) : layoutMode === "timeline" ? (
              <Timeline timelineElements={allResults} />
            ) : layoutMode === "kanban" ? (
              <Kanban
                data={allResults}
                layout={layout}
                onQuery={() => onRefresh(true)}
                resultKeys={columns}
              />
            ) : (
              <div style={{ padding: "16px 8px" }}>
                Layout `{layoutMode}` is not supported
              </div>
            )
          ) : (
            <div
              className="flex justify-between items-center mb-0"
              style={{ padding: "16px 8px" }}
            >
              <i>No Results Found</i>
            </div>
          ))}
        <div
          style={
            !showInterface ? { display: "none" } : { background: "#eeeeee80" }
          }
        >
          <div
            className="flex justify-between items-center text-xs px-1"
            style={{
              opacity: 0.8,
              padding: 4,
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
                    minWidth: 16,
                    minHeight: 16,
                  }}
                />
                Showing {paginatedResults.length} of {results.length} results
              </i>
            </span>
          </div>
          {showContent && <QueryUsed parentUid={parentUid} />}
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
