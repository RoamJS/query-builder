import { Card, Button, Tooltip } from "@blueprintjs/core";
import { useEffect, useMemo, useRef, useState } from "react";
import fireQuery from "../utils/fireQuery";
import parseQuery from "../utils/parseQuery";
import ResultsView, { Result as SearchResult } from "./ResultsView";
// import { render as exportRender } from "../ExportDialog";
import ReactDOM from "react-dom";
import QueryEditor from "./QueryEditor";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getSubTree from "roamjs-components/util/getSubTree";
import { createComponentRender } from "roamjs-components/components/ComponentContainer";
import type { QBClauseData } from "roamjs-components/types/query-builder";

type Props = {
  pageUid: string;
  hideMetadata?: boolean;
  defaultReturnNode?: string;
  getExportTypes?: Parameters<typeof ResultsView>[0]["getExportTypes"];
};

const QueryPage = ({
  pageUid,
  hideMetadata = false,
  defaultReturnNode,
  getExportTypes,
}: Props) => {
  const queryNode = useMemo(
    () => getSubTree({ parentUid: pageUid, key: "query" }),
    [pageUid]
  );
  const [isEdit, setIsEdit] = useState(
    !queryNode.children.length &&
      (!defaultReturnNode || defaultReturnNode === "block")
  );
  const [query, setQuery] = useState(() =>
    queryNode.children.length
      ? queryNode.children.map((s) => s.text)
      : defaultReturnNode
      ? [`Find ${defaultReturnNode} Where`]
      : []
  );
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (query.length) {
      setLoading(true);
      const { returnNode, conditionNodes, selectionNodes } = parseQuery(query);
      setTimeout(() => {
        const results = fireQuery({
          returnNode,
          conditions: conditionNodes,
          selections: selectionNodes,
        });
        setResults(results);
        setLoading(false);
      }, 1);
    }
  }, [setResults, query]);
  useEffect(() => {
    const roamBlock = containerRef.current.closest(".rm-block-main");
    if (roamBlock) {
      const sep = roamBlock.querySelector<HTMLDivElement>(
        ".rm-block-separator"
      );
      if (sep) {
        sep.style.minWidth = "0";
      }
    }
  }, []);
  return (
    <Card
      id={`roamjs-query-page-${pageUid}`}
      style={{ padding: 0 }}
      className={"roamjs-query-page"}
    >
      <div ref={containerRef}>
        {hideMetadata && (
          <style>
            {`.roam-article .rm-block-children {
          display: none;
        }`}
          </style>
        )}
        {isEdit && (
          <>
            <QueryEditor
              parentUid={pageUid}
              defaultQuery={query}
              onQuery={({ returnNode, conditions, selections }) => {
                const queryNode = getSubTree({
                  parentUid: pageUid,
                  key: "query",
                });
                return (
                  queryNode.uid
                    ? Promise.all(
                        queryNode.children.map((c) => deleteBlock(c.uid))
                      ).then(() => queryNode.uid)
                    : createBlock({
                        parentUid: pageUid,
                        node: { text: "query" },
                      })
                )
                  .then((parentUid) => {
                    const nodes = [
                      { text: `Find ${returnNode} Where` },
                      ...(conditions as QBClauseData[]).map((c) => ({
                        text: `${c.not ? "NOT " : ""}${c.source} ${
                          c.relation
                        } ${c.target}`,
                      })),
                      ...selections.map((s) => ({
                        text: `Select ${s.text} AS ${s.label}`,
                      })),
                    ];
                    return Promise.all(
                      nodes.map((node, order) =>
                        createBlock({ node, order, parentUid })
                      )
                    ).then(() => {
                      setIsEdit(false);
                      setQuery(nodes.map((t) => t.text));
                    });
                  })
                  .then(() =>
                    Promise.all(
                      conditions
                        .map((c) => deleteBlock(c.uid))
                        .concat(selections.map((s) => deleteBlock(s.uid)))
                    )
                  )
                  .then(() => Promise.resolve());
              }}
              defaultReturnNode={defaultReturnNode}
            />
            <hr style={{ borderColor: "#333333" }} />
          </>
        )}
        {loading ? (
          <p>Loading results...</p>
        ) : (
          <ResultsView
            parentUid={pageUid}
            onEdit={() => setIsEdit(true)}
            getExportTypes={getExportTypes}
            header={
              <div>
                {/*<Tooltip content={"Export"}>
                <Button
                  icon={"export"}
                  disabled
                  minimal
                  onClick={() => {
                    const conditions = parseQuery(query).conditionNodes.map(
                      (c) => ({
                        predicate: {
                          title: c.target,
                          uid: getPageUidByPageTitle(c.target),
                        },
                        relation: c.relation,
                      })
                    );
                    exportRender({
                      fromQuery: {
                        nodes: results
                          .map(({ text, uid }) => ({
                            title: text,
                            uid,
                          }))
                          .concat(
                            conditions
                              .map((c) => c.predicate)
                              .filter((c) => !!c.uid)
                          ),
                      },
                    });
                  }}
                />
                </Tooltip>*/}
              </div>
            }
            results={results.map(({ id, ...a }) => a)}
            resultContent={
              <div style={{ fontSize: 10, position: "relative" }}>
                {query.map((q, i) => (
                  <p key={i} style={{ margin: 0 }}>
                    {q}
                  </p>
                ))}
              </div>
            }
          />
        )}
      </div>
    </Card>
  );
};

export const renderQueryBlock = createComponentRender(({ blockUid }) => (
  <QueryPage pageUid={blockUid} defaultReturnNode={"block"} />
));

export const render = ({ parent, ...props }: { parent: HTMLElement } & Props) =>
  ReactDOM.render(<QueryPage {...props} />, parent);

export default QueryPage;
