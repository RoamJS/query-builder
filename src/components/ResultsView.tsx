import React, { useEffect, useMemo, useRef, useState } from "react";
import fuzzy from "fuzzy";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import {
  Button,
  Icon,
  Tooltip,
  HTMLTable,
  InputGroup,
} from "@blueprintjs/core";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import toRoamDate from "roamjs-components/date/toRoamDate";

export type Result = { text: string; uid: string } & Record<
  string,
  string | number | Date
>;

type MappedResult = { uid: string } & Record<string, string>;

const sortFunction =
  (key: string, descending?: boolean) => (a: Result, b: Result) => {
    const aVal = a[key];
    const bVal = b[key];
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

const ResultView = ({ r, colSpan }: { r: MappedResult; colSpan: number }) => {
  const rowCells = Object.keys(r).filter((k) => !defaultFields.includes(k));
  const [contextOpen, setContextOpen] = useState(false);
  const contextPageTitle = useMemo(
    () => r.context && getPageTitleByPageUid(r.context.toString()),
    [r.context]
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
  const cell = (key: string) =>
    (r[key] || "")
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
  return (
    <>
      <tr>
        <td
          style={{
            textOverflow: "ellipsis",
            overflow: "hidden",
          }}
        >
          <a
            className={"rm-page-ref"}
            href={getRoamUrl(r.uid)}
            onClick={(e) => {
              if (e.ctrlKey || e.shiftKey) {
                openBlockInSidebar(r.uid);
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            {cell("text")}
          </a>
        </td>
        {rowCells.map((k) => {
          return (
            <td
              style={{
                textOverflow: "ellipsis",
              }}
              key={k}
            >
              {cell(k)}
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

const defaultFields = ["text", "uid", "context"];

const ResultsView = ({
  header = "Results",
  hideResults = false,
  results,
  ResultIcon = () => <span />,
  resultFilter = () => true,
  resultContent = <div />,
}: {
  header?: React.ReactNode;
  hideResults?: boolean;
  results: Result[];
  ResultIcon?: (props: { result: MappedResult }) => React.ReactElement;
  resultFilter?: (r: Result) => boolean;
  resultContent?: React.ReactElement;
}) => {
  const columns = useMemo(
    () =>
      results.length
        ? [
            "text",
            ...Object.keys(results[0]).filter(
              (k) => !defaultFields.includes(k)
            ),
            ...(results.some((r) => !!r.context) ? ["context"] : []),
          ]
        : ["text"],
    [results]
  );
  const [activeSort, setActiveSort] = useState({
    key: columns[0],
    descending: false,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const sortedResults = useMemo(() => {
    const sorted = results
      .filter(resultFilter)
      .map((r) => ({
        uid: r.uid,
        text: r.text,
        ...Object.fromEntries(
          Object.entries(r)
            .filter(([k]) => k !== "uid" && k !== "text")
            .map(([k, v]) => [k, v instanceof Date ? toRoamDate(v) : v])
        ),
      }))
      .sort(sortFunction(activeSort.key, activeSort.descending));
    return searchTerm
      ? sorted
          .filter((s) =>
            Object.values(s).some((v) => fuzzy.test(searchTerm, v.toString()))
          )
          .map(
            (s) =>
              ({
                uid: s.uid,
                ...Object.fromEntries(
                  Object.entries(s)
                    .filter(([k]) => k !== "uid" && k !== "context")
                    .map(([k, v]) => [
                      k,
                      fuzzy.match(searchTerm, v.toString(), {
                        pre: "<span>",
                        post: "<span>",
                      })?.rendered || v,
                    ])
                ),
              } as MappedResult)
          )
      : sorted;
  }, [results, activeSort, searchTerm, resultFilter]);
  return (
    <div
      className="roamjs-query-results-view"
      style={{
        width: "100%",
      }}
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
        <div tabIndex={-1} style={{ position: "relative", outline: "none" }}>
          {resultContent}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <i style={{ opacity: 0.8 }}>
              Showing {sortedResults.length} of {results.length} results
            </i>
            <InputGroup
              placeholder="Filter results..."
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {sortedResults.length ? (
            <HTMLTable
              style={{
                maxHeight: "400px",
                overflowY: "scroll",
                width: "100%",
                tableLayout: "fixed",
              }}
              striped
              interactive
              bordered
            >
              <thead>
                <tr>
                  {columns.map((c) => (
                    <td
                      style={{ cursor: "pointer" }}
                      key={c}
                      onClick={() => {
                        if (activeSort.key === c) {
                          setActiveSort({
                            key: c,
                            descending: !activeSort.descending,
                          });
                        } else {
                          setActiveSort({
                            key: c,
                            descending: false,
                          });
                        }
                      }}
                    >
                      {c.slice(0, 1).toUpperCase()}
                      {c.slice(1)}{" "}
                      {activeSort.key === c && (
                        <Icon
                          icon={
                            activeSort.descending ? "sort-desc" : "sort-asc"
                          }
                        />
                      )}
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((r) => (
                  <ResultView key={r.uid} r={r} colSpan={columns.length} />
                ))}
              </tbody>
            </HTMLTable>
          ) : (
            <div>No Results</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultsView;
