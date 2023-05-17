import React, { useMemo, useRef, useEffect } from "react";
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

const resolveRefs = (text: string, refs = new Set<string>()): string => {
  return text.replace(new RegExp(BLOCK_REF_REGEX, "g"), (_, blockUid) => {
    if (refs.has(blockUid)) return "";
    const reference = getTextByBlockUid(blockUid);
    return resolveRefs(reference, new Set(refs));
  });
};

const toCellValue = (v: number | Date | string) =>
  v instanceof Date
    ? window.roamAlphaAPI.util.dateToPageTitle(v)
    : typeof v === "undefined" || v === null
    ? ""
    : extractTag(resolveRefs(v.toString()));

const ResultHeader = ({
  c,
  results,
  activeSort,
  setActiveSort,
  filters,
  setFilters,
  initialFilter,
  columnWidth,
}: {
  c: string;
  results: Result[];
  activeSort: Sorts;
  setActiveSort: (s: Sorts) => void;
  filters: FilterData;
  setFilters: (f: FilterData) => void;
  initialFilter: Filters;
  columnWidth?: string;
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
        width: columnWidth,
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

const ResultView = ({
  r,
  ctrlClick,
  views,
  extraColumn,
  onRefresh,
  columns,
}: {
  r: Result;
  ctrlClick?: (e: Result) => void;
  views: { column: string; mode: string; value: string }[];
  extraColumn?: { row: (e: Result) => React.ReactNode; reserved: RegExp[] };
  columns: string[];
  onRefresh: () => void;
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
  return (
    <>
      <tr>
        {columns.map((k) => {
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
          const match = /^(.*) - ([^-])+$/.exec(w);
          return match;
        })
        .filter((m): m is RegExpExecArray => !!m)
        .map((match, i) => {
          return [match[1], match[2]];
        })
    );
  }, [layout]);
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
          <ResultView
            key={Object.values(r).join("-")}
            r={r}
            views={views}
            extraColumn={extraColumn}
            onRefresh={onRefresh}
            columns={columns}
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
                      const resultNode = getSubTree({
                        key: "results",
                        parentUid,
                      });
                      setInputSetting({
                        key: "size",
                        value: e.target.value,
                        blockUid: resultNode.uid,
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
