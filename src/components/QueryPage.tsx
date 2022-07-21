import { Card, Spinner } from "@blueprintjs/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import fireQuery from "../utils/fireQuery";
import parseQuery from "../utils/parseQuery";
import type { Result as SearchResult } from "roamjs-components/types/query-builder";
import ResultsView from "./ResultsView";
import ReactDOM from "react-dom";
import QueryEditor from "./QueryEditor";
import getSubTree from "roamjs-components/util/getSubTree";
import { createComponentRender } from "roamjs-components/components/ComponentContainer";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import setInputSetting from "roamjs-components/util/setInputSetting";

type Props = {
  pageUid: string;
  hideMetadata?: boolean;
  defaultReturnNode?: string;
  getExportTypes?: Parameters<typeof ResultsView>[0]["getExportTypes"];
};

const ensureSetting = ({
  parentUid,
  key,
  value,
}: {
  parentUid: string;
  key: string;
  value: string;
}) => {
  const [first, second] = key.split(".");
  const tree = getBasicTreeByParentUid(parentUid);
  const node = getSubTree({ tree, key: first });
  return (
    node.uid
      ? Promise.resolve(node.uid)
      : createBlock({ parentUid, node: { text: first } })
  ).then((blockUid) =>
    setInputSetting({
      blockUid,
      key: second,
      value,
    })
  );
};

const QueryPage = ({
  pageUid,
  hideMetadata = false,
  defaultReturnNode,
  getExportTypes,
}: Props) => {
  const tree = useMemo(() => getBasicTreeByParentUid(pageUid), [pageUid]);
  const [isEdit, _setIsEdit] = useState(
    () => !!getSubTree({ tree, key: "editing" }).uid
  );
  const setIsEdit = useCallback(
    (b: boolean) => {
      _setIsEdit(b);
      return b
        ? createBlock({
            parentUid: pageUid,
            node: { text: "editing" },
            order: 2,
          })
        : deleteBlock(getSubTree({ parentUid: pageUid, key: "editing" }).uid);
    },
    [pageUid]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const onRefresh = useCallback(() => {
    setError("");
    setLoading(true);
    const args = parseQuery(pageUid);
    setTimeout(() => {
      (args.returnNode
        ? fireQuery(args)
            .then((results) => {
              setResults(results);
            })
            .catch(() => {
              setError(
                `Query failed to run. Try running a new query from the editor.`
              );
            })
        : defaultReturnNode
        ? ensureSetting({
            key: "scratch.return",
            value: defaultReturnNode,
            parentUid: pageUid,
          }).then(() => {
            if (defaultReturnNode === "block" || defaultReturnNode === "node") {
              setIsEdit(true);
            } else {
              fireQuery({ ...args, returnNode: defaultReturnNode })
                .then((results) => {
                  setResults(results);
                })
                .catch(() => {
                  setError(
                    `Query failed to run. Try running a new query from the editor.`
                  );
                });
            }
          })
        : setIsEdit(true)
      ).finally(() => {
        setLoading(false);
      });
    }, 1);
  }, [setResults, pageUid, setLoading, defaultReturnNode]);
  useEffect(() => {
    if (!isEdit) {
      onRefresh();
    }
  }, [isEdit, onRefresh]);
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
      className={"roamjs-query-page p-0 overflow-auto"}
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
              onQuery={() => setIsEdit(false)}
              defaultReturnNode={defaultReturnNode}
            />
            <hr style={{ borderColor: "#333333" }} />
          </>
        )}
        {loading ? (
          <p className="px-8 py-4">
            <Spinner /> Loading Results...
          </p>
        ) : (
          <ResultsView
            parentUid={pageUid}
            onEdit={() => setIsEdit(true)}
            getExportTypes={getExportTypes}
            header={
              error ? <div className="text-red-700 mb-4">{error}</div> : <div />
            }
            results={results.map(({ id, ...a }) => a)}
            onRefresh={onRefresh}
            // hide header on edit
          />
        )}
      </div>
    </Card>
  );
};

export const renderQueryBlock = createComponentRender(({ blockUid }) => (
  <QueryPage pageUid={blockUid} defaultReturnNode={"node"} />
));

export const render = ({ parent, ...props }: { parent: HTMLElement } & Props) =>
  ReactDOM.render(<QueryPage {...props} />, parent);

export default QueryPage;
