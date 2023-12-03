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
import parseResultSettings from "../utils/parseResultSettings";
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
import { render as renderSimpleAlert } from "roamjs-components/components/SimpleAlert";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";

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

const SUPPORTED_COLUMN_FILTER_TYPES = [
  { id: "contains" },
  { id: "contains exactly" },
];

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
    settings: [
      { key: "key", label: "Group By", options: "columns" },
      { key: "display", label: "Display", options: "columns" },
      { key: "legend", label: "Show Legend", options: ["No", "Yes"] },
    ],
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
  onEdit?: () => void;
  onDeleteQuery?: () => void;
  onRefresh: (loadInBackground?: boolean) => void;
  globalFiltersData?: Record<string, Filters>;
  globalPageSize?: number;
  isEditBlock?: boolean;
  exportIsOpen?: boolean;
  toggleExport?: (isOpen: boolean) => void;
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
  onEdit,
  onDeleteQuery,
  onRefresh,
  onResultsInViewChange,
  isEditBlock,
  exportIsOpen = false,
  toggleExport,
}) => {
  const extensionAPI = useExtensionAPI();
  const settings = useMemo(
    () => parseResultSettings(parentUid, columns, extensionAPI),
    [parentUid]
  );
  const [activeSort, setActiveSort] = useState(settings.activeSort);
  // @deprecated - use columnFilters
  const [filters, setFilters] = useState(settings.filters);
  const randomRef = useRef(settings.random);
  const [random, setRandom] = useState({ count: settings.random });
  const [page, setPage] = useState(settings.page);
  const [pageSize, setPageSize] = useState(settings.pageSize);
  const pageSizeTimeoutRef = useRef(0);
  const [views, setViews] = useState(settings.views);
  const [columnFilters, setColumnFilters] = useState(settings.columnFilters);
  const [searchFilter, setSearchFilter] = useState(settings.searchFilter);
  const [showInterface, setShowInterface] = useState(settings.showInterface);
  const [showMenuIcons, setShowMenuIcons] = useState(false);

  const { allProcessedResults, paginatedResults } = useMemo(() => {
    return postProcessResults(results, {
      activeSort,
      filters,
      columnFilters,
      random: random.count,
      page,
      pageSize,
      searchFilter,
      showInterface,
    });
  }, [
    results,
    activeSort,
    filters,
    page,
    pageSize,
    random.count,
    searchFilter,
    columnFilters,
  ]);

  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    onResultsInViewChange?.(paginatedResults);
  }, [paginatedResults]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isEditViews, setIsEditViews] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  useEffect(() => {
    setIsExportOpen(exportIsOpen);
  }, [exportIsOpen]);
  const handleCloseExport = () => {
    if (toggleExport) {
      toggleExport(false);
    }
    setIsExportOpen(false);
  };
  const [isEditRandom, setIsEditRandom] = useState(false);
  const [isEditLayout, setIsEditLayout] = useState(false);
  const [isEditColumnFilter, setIsEditColumnFilter] = useState(false);
  const [isEditSearchFilter, setIsEditSearchFilter] = useState(false);
  const isMenuIconDirty = useMemo(
    () => !!searchFilter || !!columnFilters.length,
    [searchFilter, columnFilters]
  );
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
        title="Share Query Results"
        isOpen={isExportOpen}
        onClose={handleCloseExport}
        results={allProcessedResults}
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
            placement="left-end"
            isOpen={moreMenuOpen}
            target={
              <Button
                minimal
                icon={"more"}
                className={isMenuIconDirty ? "roamjs-item-dirty" : ""}
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
                        ? columns.map((c) => c.key)
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
              ) : isEditColumnFilter ? (
                <div className="relative p-2" style={{ minWidth: "320px" }}>
                  <h4 className="font-bold flex justify-between items-center p-2">
                    Set Filters
                    <Button
                      icon={"small-cross"}
                      onClick={() => setIsEditColumnFilter(false)}
                      minimal
                      small
                    />
                  </h4>
                  <div className="flex flex-col gap-4 items-start overflow-auto p-2">
                    {columnFilters.map(({ key, type, value, uid }) => (
                      <div key={uid}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <MenuItemSelect
                            className="roamjs-column-filter-key flex-grow"
                            items={columns.map((c) => c.key)}
                            transformItem={(k) =>
                              k.length > 10 ? `${k.slice(0, 7)}...` : k
                            }
                            activeItem={key}
                            onItemSelect={(newKey) => {
                              setColumnFilters(
                                columnFilters.map((f) =>
                                  f.uid === uid ? { ...f, key: newKey } : f
                                )
                              );
                              updateBlock({ uid, text: newKey });
                            }}
                          />
                          <MenuItemSelect
                            className="roamjs-column-filter-type"
                            items={SUPPORTED_COLUMN_FILTER_TYPES.map(
                              (c) => c.id
                            )}
                            activeItem={type}
                            onItemSelect={(newType) => {
                              setColumnFilters(
                                columnFilters.map((f) =>
                                  f.uid === uid ? { ...f, type: newType } : f
                                )
                              );
                              setInputSetting({
                                blockUid: uid,
                                key: "type",
                                value: newType,
                              });
                            }}
                          />
                          <Button
                            icon={"trash"}
                            minimal
                            onClick={() => {
                              setColumnFilters(
                                columnFilters.filter((f) => f.uid !== uid)
                              );
                              deleteBlock(uid);
                            }}
                          />
                        </div>
                        <div>
                          {type === "contains exactly" ? (
                            <AutocompleteInput
                              setValue={(newValue) => {
                                if (value === newValue) return; // prevent infinite render loop
                                setColumnFilters(
                                  columnFilters.map((f) =>
                                    f.uid === uid
                                      ? { ...f, value: newValue }
                                      : f
                                  )
                                );
                                setInputSetting({
                                  blockUid: uid,
                                  key: "value",
                                  value: newValue,
                                });
                              }}
                              value={value}
                              options={Array.from(
                                new Set(results.map((r) => r[key].toString()))
                              )}
                            />
                          ) : (
                            <InputGroup
                              className="roamjs-column-filter-value"
                              value={value[0]}
                              placeholder="Type a value..."
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setColumnFilters(
                                  columnFilters.map((f) =>
                                    f.uid === uid
                                      ? { ...f, value: newValue }
                                      : f
                                  )
                                );
                                setInputSetting({
                                  blockUid: uid,
                                  key: "value",
                                  value: newValue,
                                });
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    <Button
                      text={"Add Filter"}
                      intent="primary"
                      onClick={() => {
                        const newFilter = {
                          key: columns[0].key,
                          type: SUPPORTED_COLUMN_FILTER_TYPES[0].id,
                          value: "",
                          uid: window.roamAlphaAPI.util.generateUID(),
                        };
                        setColumnFilters([...columnFilters, newFilter]);
                        const columnFiltersNode = getSubTree({
                          key: "columnFilters",
                          parentUid: settings.resultNodeUid,
                        });
                        createBlock({
                          parentUid: columnFiltersNode.uid,
                          order: Number.MAX_VALUE,
                          node: {
                            text: newFilter.key,
                            uid: newFilter.uid,
                            children: [
                              {
                                text: "type",
                                children: [{ text: newFilter.type }],
                              },
                              {
                                text: "value",
                                children: [{ text: newFilter.value }],
                              },
                            ],
                          },
                        });
                      }}
                      rightIcon={"plus"}
                    />
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
                      <React.Fragment key={i}>
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
                      </React.Fragment>
                    ))}
                  </div>
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
                    icon={"filter"}
                    text={"Filters"}
                    className={columnFilters.length ? "roamjs-item-dirty" : ""}
                    onClick={() => {
                      setIsEditColumnFilter(true);
                    }}
                  />
                  <MenuItem
                    icon={"search"}
                    text={isEditSearchFilter ? "Hide Search" : "Search"}
                    className={searchFilter ? "roamjs-item-dirty" : ""}
                    onClick={() => {
                      setMoreMenuOpen(false);
                      setIsEditSearchFilter((prevState) => !prevState);
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
                  <MenuItem
                    icon={"export"}
                    text={"Share Data"}
                    onClick={async () => {
                      if (!results.length) {
                        onRefresh();
                      }
                      setMoreMenuOpen(false);
                      setIsExportOpen(true);
                    }}
                  />
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
                  {onDeleteQuery && (
                    <>
                      <MenuItem
                        icon={"trash"}
                        text={"Delete Query"}
                        onClick={() => {
                          renderSimpleAlert({
                            content:
                              "Are you sure you want to delete this query?",
                            onConfirm: onDeleteQuery,
                            onCancel: true,
                          });
                        }}
                      />
                    </>
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
        {!hideResults && (
          <>
            {results.length !== 0 ? (
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
                  allProcessedResults={allProcessedResults}
                  allResults={results}
                  showInterface={showInterface}
                />
              ) : layoutMode === "line" ? (
                <Charts
                  type="line"
                  data={allProcessedResults}
                  columns={columns.slice(1)}
                />
              ) : layoutMode === "bar" ? (
                <Charts
                  type="bar"
                  data={allProcessedResults}
                  columns={columns.slice(1)}
                />
              ) : layoutMode === "timeline" ? (
                <Timeline timelineElements={allProcessedResults} />
              ) : layoutMode === "kanban" ? (
                <Kanban
                  data={allProcessedResults}
                  layout={layout}
                  onQuery={() => onRefresh(true)}
                  resultKeys={columns}
                  parentUid={parentUid}
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
            )}
            <div
              style={
                !showInterface
                  ? { display: "none" }
                  : { background: "#eeeeee80" }
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
                    Showing {paginatedResults.length} of {results.length}{" "}
                    results
                  </i>
                </span>
              </div>
              {showContent && <QueryUsed parentUid={parentUid} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResultsView;
