import React, {
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  Button,
  HTMLTable,
  Icon,
  IconName,
  InputGroup,
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { Result } from "../utils/types";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import extractTag from "roamjs-components/util/extractTag";
import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import type { FilterData, Sorts, Views } from "../utils/parseResultSettings";
import Filter, { Filters } from "roamjs-components/components/Filter";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getSubTree from "roamjs-components/util/getSubTree";
import setInputSetting from "roamjs-components/util/setInputSetting";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import setInputSettings from "roamjs-components/util/setInputSettings";

const resolveRefs = (text: string, refs = new Set<string>()): string => {
  return text.replace(new RegExp(BLOCK_REF_REGEX, "g"), (_, blockUid) => {
    if (refs.has(blockUid)) return "";
    const reference = getTextByBlockUid(blockUid);
    return resolveRefs(reference, new Set(refs));
  });
};

const dragImage = document.createElement("img");
dragImage.src =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

const toCellValue = (v: number | Date | string) =>
  v instanceof Date
    ? window.roamAlphaAPI.util.dateToPageTitle(v)
    : typeof v === "undefined" || v === null
    ? ""
    : extractTag(resolveRefs(v.toString()));

const ResultHeader = React.forwardRef<
  HTMLTableCellElement,
  {
    c: string;
    results: Result[];
    activeSort: Sorts;
    setActiveSort: (s: Sorts) => void;
    filters: FilterData;
    setFilters: (f: FilterData) => void;
    initialFilter: Filters;
    columnWidth?: string;
  }
>(
  (
    {
      c,
      results,
      activeSort,
      setActiveSort,
      filters,
      setFilters,
      initialFilter,
      columnWidth,
    },
    ref
  ) => {
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
          width: columnWidth,
        }}
        data-column={c}
        ref={ref}
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
                  size={12}
                />
                <span style={{ fontSize: 8 }}>({sortIndex + 1})</span>
              </span>
            )}
          </span>
        </div>
      </td>
    );
  }
);

const CellEmbed = ({ uid }: { uid: string }) => {
  const title = getPageTitleByPageUid(uid);
  const isPage = !!title ? "page-embed" : "block-embed";
  const contentRef = useRef(null);
  useEffect(() => {
    const el = contentRef.current;
    if (el) {
      window.roamAlphaAPI.ui.components.renderBlock({
        uid,
        el,
      });
    }
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

type OnWidthUpdate = (args: {
  column: string;
  width: string;
  save?: boolean;
}) => void;
const ResultRow = ({
  r,
  ctrlClick,
  views,
  extraColumn,
  onRefresh,
  columns,
  onWidthUpdate,
}: {
  r: Result;
  ctrlClick?: (e: Result) => void;
  views: { column: string; mode: string; value: string }[];
  extraColumn?: { row: (e: Result) => React.ReactNode; reserved: RegExp[] };
  columns: string[];
  onRefresh: () => void;
  onWidthUpdate: OnWidthUpdate;
}) => {
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
    const value = toCellValue(r[`${key}-display`] || r[key] || "");
    const action = r[`${key}-action`];
    if (typeof action === "string") {
      const buttonProps =
        value.toUpperCase().replace(/\s/g, "_") in IconNames
          ? { icon: value as IconName }
          : { text: value };
      return (
        <Button
          {...buttonProps}
          onClick={() => {
            document.dispatchEvent(
              new CustomEvent("roamjs:query-builder:action", {
                detail: {
                  action,
                  uid: r[`${key}-uid`],
                  val: r["text"],
                  onRefresh,
                },
              })
            );
          }}
        />
      );
    }
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
  const trRef = useRef<HTMLTableRowElement>(null);
  const dragHandler = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const delta = e.clientX - e.currentTarget.getBoundingClientRect().left;
      const cellWidth =
        e.currentTarget.parentElement?.getBoundingClientRect().width;
      if (typeof cellWidth === "undefined") return;
      if (cellWidth + delta <= 0) return;
      const rowWidth =
        e.currentTarget.parentElement?.parentElement?.getBoundingClientRect()
          .width;
      if (typeof rowWidth === "undefined") return;
      if (cellWidth + delta >= rowWidth) return;
      const column = e.currentTarget.getAttribute("data-column");
      const save = e.type === "dragEnd";
      if (trRef.current) {
        trRef.current.style.cursor = save ? "" : "ew-resize";
      }
      if (column)
        onWidthUpdate({
          column,
          width: `${((cellWidth + delta) / rowWidth) * 100}%`,
          save,
        });
    },
    [onWidthUpdate]
  );
  return (
    <>
      <tr>
        {columns.map((k, i) => {
          const uid = (r[`${k}-uid`] || "").toString();
          const val = r[k] || "";
          const { mode: view, value: viewValue } = viewsByColumn[k] || {};
          return (
            <td className={"relative overflow-hidden text-ellipsis"} key={k}>
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
              {i < columns.length - 1 && (
                <div
                  style={{
                    width: 1,
                    cursor: "ew-resize",
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    background: `rgba(16,22,26,0.15)`,
                  }}
                  data-column={k}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setDragImage(dragImage, 0, 0)
                  }
                  onDrag={dragHandler}
                  onDragEnd={dragHandler}
                />
              )}
            </td>
          );
        })}
        {extraColumn && <td>{extraColumn.row(r)}</td>}
      </tr>
    </>
  );
};

const ResultsTable = ({
  columns,
  results,
  parentUid,
  layout,
  activeSort,
  setActiveSort,
  filters,
  setFilters,
  preventSavingSettings,
  onRefresh,
  views,
  pageSize,
  setPageSize,
  pageSizeTimeoutRef,
  page,
  setPage,
  allResultsLength,
  extraColumn,
}: {
  columns: string[];
  results: Result[];
  parentUid: string;
  layout: Record<string, string | string[]>;
  // TODO - can a lot of these settings become layout settings instead of global?
  activeSort: Sorts;
  setActiveSort: (s: Sorts) => void;
  filters: FilterData;
  setFilters: (f: FilterData) => void;
  preventSavingSettings?: boolean;
  views: Views;
  pageSize: number;
  setPageSize: (p: number) => void;
  pageSizeTimeoutRef: React.MutableRefObject<number>;
  page: number;
  setPage: (p: number) => void;
  onRefresh: () => void;
  allResultsLength: number;
  // @deprecated - move to `-action` columns through selections
  extraColumn?: {
    reserved: RegExp[];
    width: number;
    row: (e: Result) => React.ReactNode;
    header: React.ReactNode;
  };
}) => {
  const columnWidths = useMemo(() => {
    const widths =
      typeof layout.widths === "string" ? [layout.widths] : layout.widths || [];
    return Object.fromEntries(
      widths
        .map((w) => {
          const match = /^(.*) - ([^-]+)$/.exec(w);
          return match;
        })
        .filter((m): m is RegExpExecArray => !!m)
        .map((match) => {
          return [match[1], match[2]];
        })
    );
  }, [layout]);
  const thRefs = useRef<Record<string, HTMLTableCellElement>>({});
  const onWidthUpdate = useCallback<OnWidthUpdate>(
    (args) => {
      const cell = thRefs.current[args.column];
      if (!cell) return;
      cell.style.width = args.width;
      if (args.save) {
        const layoutUid = getSubTree({ parentUid, key: "layout" }).uid;
        if (layoutUid)
          setInputSettings({
            blockUid: layoutUid,
            key: "widths",
            values: Object.entries(thRefs.current)
              .map(([k, v]) => [k, v.style.width])
              .filter(([k, v]) => !!k && !!v)
              .map(([k, v]) => `${k} - ${v}`),
          });
      }
    },
    [thRefs, parentUid]
  );
  return (
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
              ref={(r) => r && (thRefs.current[c] = r)}
              results={results}
              activeSort={activeSort}
              setActiveSort={(as) => {
                setActiveSort(as);
                if (preventSavingSettings) return;
                const sortsNode = getSubTree({
                  key: "sorts",
                  parentUid,
                });
                sortsNode.children.forEach((c) => deleteBlock(c.uid));
                as.map((a) => ({
                  text: a.key,
                  children: [{ text: `${a.descending}` }],
                })).forEach((node, order) =>
                  createBlock({
                    parentUid: sortsNode.uid,
                    node,
                    order,
                  })
                );
              }}
              filters={filters}
              setFilters={(fs) => {
                setFilters(fs);

                if (preventSavingSettings) return;
                const filtersNode = getSubTree({
                  key: "filters",
                  parentUid,
                });
                filtersNode.children.forEach((c) => deleteBlock(c.uid));
                Object.entries(fs)
                  .filter(
                    ([, data]) =>
                      data.includes.values.size || data.excludes.values.size
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
              initialFilter={filters[c]}
              columnWidth={columnWidths[c]}
            />
          ))}
          {extraColumn && (
            <th style={{ width: extraColumn.width }}>{extraColumn.header}</th>
          )}
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <ResultRow
            key={Object.values(r).join("-")}
            r={r}
            views={views}
            extraColumn={extraColumn}
            onRefresh={onRefresh}
            columns={columns}
            onWidthUpdate={onWidthUpdate}
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
              style={{ padding: 4 }}
            >
              <div
                className="flex items-center gap-4"
                style={{ paddingLeft: 4 }}
              >
                <span>Rows per page:</span>
                <InputGroup
                  defaultValue={pageSize.toString()}
                  onChange={(e) => {
                    clearTimeout(pageSizeTimeoutRef.current);
                    pageSizeTimeoutRef.current = window.setTimeout(() => {
                      setPageSize(Number(e.target.value));

                      if (preventSavingSettings) return;
                      setInputSetting({
                        key: "size",
                        value: e.target.value,
                        blockUid: parentUid,
                      });
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
              </div>
              <span>
                <Button
                  minimal
                  icon={"double-chevron-left"}
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  small
                />
                <Button
                  minimal
                  icon={"chevron-left"}
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  small
                />
                <span style={{ margin: "4px 0" }} className={"text-sm"}>
                  {page}
                </span>
                <Button
                  minimal
                  icon={"chevron-right"}
                  onClick={() => setPage(page + 1)}
                  disabled={
                    page === Math.ceil(allResultsLength / pageSize) ||
                    allResultsLength === 0
                  }
                  small
                />
                <Button
                  minimal
                  icon={"double-chevron-right"}
                  disabled={
                    page === Math.ceil(allResultsLength / pageSize) ||
                    allResultsLength === 0
                  }
                  onClick={() =>
                    setPage(Math.ceil(allResultsLength / pageSize))
                  }
                  small
                />
              </span>
            </div>
          </td>
        </tr>
      </tfoot>
    </HTMLTable>
  );
};

export default ResultsTable;
