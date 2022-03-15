import { Card, Button, Tooltip } from "@blueprintjs/core";
import React, { useEffect, useMemo, useState } from "react";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import fireQuery from "../utils/fireQuery";
import parseQuery from "../utils/parseQuery";
import ResultsView, { Result as SearchResult } from "./ResultsView";
// import { render as exportRender } from "../ExportDialog";
import ReactDOM from "react-dom";
import QueryEditor from "./QueryEditor";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getSubTree from "roamjs-components/util/getSubTree";

type Props = { pageUid: string };

const QueryPage = ({ pageUid }: Props) => {
  const tree = useMemo(() => getBasicTreeByParentUid(pageUid), []);
  const [queryNode, setQueryNode] = useState(() =>
    getSubTree({ tree, key: "query" })
  );
  const [isEdit, setIsEdit] = useState(!queryNode.uid);
  const query = useMemo(
    () => queryNode.children.map((s) => s.text),
    [queryNode]
  );
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const { returnNode, conditionNodes, selectionNodes } = useMemo(
    () => parseQuery(query),
    [parseQuery, query]
  );
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      const results = fireQuery({
        returnNode,
        conditions: conditionNodes,
        selections: selectionNodes,
      });
      setResults(results);
      setLoading(false);
    }, 1);
  }, [setResults]);
  return (
    <Card
      style={{
        padding: 16,
      }}
    >
      {isEdit ? (
        <>
          <QueryEditor
            parentUid={pageUid}
            defaultQuery={query}
            onQuery={({ returnNode, conditions, selections }) => {
              const results = fireQuery({ returnNode, conditions, selections });
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
                    ...conditions.map((c) => ({
                      text: `${c.source} ${c.relation} ${c.target}`,
                    })),
                    ...selections.map((s) => ({
                      text: `Select ${s.text} AS ${s.label}`,
                    })),
                  ];
                  return Promise.all(
                    nodes.map((node, order) =>
                      createBlock({ node, order, parentUid })
                    )
                  );
                })
                .then(() =>
                  Promise.all(
                    conditions
                      .map((c) => deleteBlock(c.uid))
                      .concat(selections.map((s) => deleteBlock(s.uid)))
                  )
                )
                .then(() => {
                  setResults(results);
                  setIsEdit(false);
                });
            }}
          />
          <hr style={{ borderColor: "#333333" }} />
        </>
      ) : (
        <Tooltip content={"Edit Query"}>
          <Button
            icon={"edit"}
            minimal
            onClick={() => {
              const tree = getBasicTreeByParentUid(pageUid);
              setQueryNode(getSubTree({ tree, key: "query" }));
              setIsEdit(true);
            }}
          />
        </Tooltip>
      )}
      {loading ? (
        <p>Loading results...</p>
      ) : (
        <ResultsView
          parentUid={pageUid}
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
    </Card>
  );
};

export const render = ({ parent, ...props }: { parent: HTMLElement } & Props) =>
  ReactDOM.render(<QueryPage {...props} />, parent);

export default QueryPage;
