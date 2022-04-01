import { Card } from "@blueprintjs/core";
import { useEffect, useMemo, useRef, useState } from "react";
import fireQuery from "../utils/fireQuery";
import parseQuery from "../utils/parseQuery";
import ResultsView, { Result as SearchResult } from "./ResultsView";
import ReactDOM from "react-dom";
import QueryEditor from "./QueryEditor";
import getSubTree from "roamjs-components/util/getSubTree";
import { createComponentRender } from "roamjs-components/components/ComponentContainer";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";

type Props = {
  pageUid: string;
  hideMetadata?: boolean;
  defaultReturnNode?: string;
  getExportTypes?: Parameters<typeof ResultsView>[0]["getExportTypes"];
};

const getQueryNode = (parentUid: string) => {
  const tree = getBasicTreeByParentUid(parentUid);
  const resultsNode = getSubTree({ tree, key: "results" });
  return getSubTree({ tree: resultsNode.children, key: "query" });
};

const QueryPage = ({
  pageUid,
  hideMetadata = false,
  defaultReturnNode,
  getExportTypes,
}: Props) => {
  const [isEdit, setIsEdit] = useState(
    () =>
      !getQueryNode(pageUid).children.length &&
      (!defaultReturnNode || defaultReturnNode === "block")
  );
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isEdit) {
      setLoading(true);
      setTimeout(() => {
        fireQuery(parseQuery(getQueryNode(pageUid))).then((results) => {
          setResults(results);
          setLoading(false);
        });
      }, 1);
    }
  }, [setResults, pageUid, isEdit, setLoading]);
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
              onQuery={() => {
                setIsEdit(false);
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
            header={<div />}
            results={results.map(({ id, ...a }) => a)}
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
