import { H3, InputGroup, Button, Tooltip } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import ResizableDrawer from "./ResizableDrawer";
import getSubTree from "roamjs-components/util/getSubTree";
import { OnloadArgs, PullBlock } from "roamjs-components/types/native";
import { Result } from "roamjs-components/types/query-builder";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import createPage from "roamjs-components/writes/createPage";
import updateBlock from "roamjs-components/writes/updateBlock";
import getParentUidByBlockUid from "roamjs-components/queries/getParentUidByBlockUid";
import getQBClauses from "../utils/getQBClauses";
import { render as exportRender } from "./ExportDialog";
import renderOverlay from "roamjs-components/util/renderOverlay";
import fireQuery from "../utils/fireQuery";
import parseQuery from "../utils/parseQuery";
import ResultsView from "./ResultsView";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import QueryEditor from "./QueryEditor";

type Props = {
  blockUid: string;
  clearOnClick: (s: string) => void;
  onloadArgs: OnloadArgs;
};

const SavedQuery = ({
  uid,
  isSavedToPage = false,
  onDelete,
  resultsReferenced,
  clearOnClick,
  setResultsReferenced,
  editSavedQuery,
  initialResults,
  onRefresh,
}: {
  uid: string;
  onDelete?: () => void;
  isSavedToPage?: boolean;
  resultsReferenced: Set<string>;
  clearOnClick: (s: string) => void;
  setResultsReferenced: (s: Set<string>) => void;
  editSavedQuery: (s: string) => void;
  initialResults?: Result[];
  onRefresh: () => void;
}) => {
  const [results, setResults] = useState<Result[]>(initialResults || []);
  const resultFilter = useCallback(
    (r: Result) => !resultsReferenced.has(r.text),
    [resultsReferenced]
  );
  const [minimized, setMinimized] = useState(!isSavedToPage && !initialResults);
  const [initialQuery, setInitialQuery] = useState(!!initialResults);
  const [label, setLabel] = useState(() => getTextByBlockUid(uid));
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!initialQuery && !minimized) {
      setInitialQuery(true);
      fireQuery(parseQuery(uid))
        .then(setResults)
        .catch(() => {
          setError(
            `Query failed to run. Try running a new query from the editor.`
          );
        });
    }
  }, [initialQuery, minimized, setInitialQuery, setResults, uid]);
  const resultsInViewRef = useRef<Result[]>([]);
  return (
    <div
      style={{
        border: "1px solid gray",
        borderRadius: 4,
        padding: 4,
        margin: 4,
      }}
    >
      <ResultsView
        parentUid={uid}
        onRefresh={onRefresh}
        header={
          error ? (
            <div className="text-red-700 mb-4">{error}</div>
          ) : (
            <>
              {isEditingLabel ? (
                <InputGroup
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updateBlock({ uid, text: label });
                      setIsEditingLabel(false);
                    }
                  }}
                  autoFocus
                  rightElement={
                    <Button
                      minimal
                      icon={"confirm"}
                      onClick={() => {
                        updateBlock({ uid, text: label });
                        setIsEditingLabel(false);
                      }}
                    />
                  }
                />
              ) : (
                <span tabIndex={-1} onClick={() => setIsEditingLabel(true)}>
                  {label}
                </span>
              )}
              <div className="mr-14 mt-2">
                <Tooltip content={"Edit"}>
                  <Button
                    icon={"edit"}
                    onClick={() => {
                      const parentUid = getParentUidByBlockUid(uid);
                      const oldScratchUid = getSubTree({
                        key: "scratch",
                        parentUid,
                      }).uid;
                      (oldScratchUid
                        ? deleteBlock(oldScratchUid)
                        : Promise.resolve()
                      )
                        .then(() =>
                          createBlock({
                            parentUid,
                            node: { text: "scratch" },
                          })
                        )
                        .then((newUid) =>
                          Promise.all(
                            getShallowTreeByParentUid(
                              getSubTree({
                                key: "scratch",
                                parentUid: uid,
                              }).uid
                            ).map((c, order) =>
                              window.roamAlphaAPI.moveBlock({
                                location: { "parent-uid": newUid, order },
                                block: { uid: c.uid },
                              })
                            )
                          )
                        )
                        .then(() => {
                          editSavedQuery(label);
                          onDelete?.();
                        });
                    }}
                    minimal
                  />
                </Tooltip>
                <Tooltip content={"Export Results"}>
                  <Button
                    icon={"export"}
                    minimal
                    onClick={() => {
                      (results.length
                        ? Promise.resolve(results)
                        : fireQuery(parseQuery(uid))
                      ).then((records) => {
                        const cons = getQBClauses(
                          parseQuery(uid).conditions
                        ).map((c) => ({
                          predicate: {
                            text: c.target,
                            uid: getPageUidByPageTitle(c.target),
                          },
                          relation: c.relation,
                        }));
                        exportRender({
                          fromQuery: {
                            nodes: records.concat(
                              cons
                                .map((c) => c.predicate)
                                .filter((c) => !!c.uid)
                            ),
                          },
                        });
                      });
                    }}
                  />
                </Tooltip>
                {!isSavedToPage && (
                  <>
                    <Tooltip content={"Insert Results"}>
                      <Button
                        icon={"insert"}
                        minimal
                        onClick={() => {
                          resultsInViewRef.current.map((r) => {
                            clearOnClick?.(r.text || "");
                          });
                          setResultsReferenced(
                            new Set([
                              ...Array.from(resultsReferenced),
                              ...resultsInViewRef.current.map((r) => r.text),
                            ])
                          );
                        }}
                      />
                    </Tooltip>
                    <Tooltip content={"Save Query to Page"}>
                      <Button
                        icon={"page-layout"}
                        minimal
                        onClick={() => {
                          createPage({
                            title: `discourse-graph/queries/${label}`,
                          })
                            .then((pageUid) =>
                              window.roamAlphaAPI
                                .moveBlock({
                                  block: {
                                    uid: getSubTree({
                                      key: "scratch",
                                      parentUid: uid,
                                    }).uid,
                                  },
                                  location: { "parent-uid": pageUid, order: 0 },
                                })
                                .then(() =>
                                  window.roamAlphaAPI.ui.mainWindow.openPage({
                                    page: { uid: pageUid },
                                  })
                                )
                            )
                            .then(onDelete);
                        }}
                      />
                    </Tooltip>
                    <Tooltip content={minimized ? "Maximize" : "Minimize"}>
                      <Button
                        icon={minimized ? "maximize" : "minimize"}
                        onClick={() => setMinimized(!minimized)}
                        active={minimized}
                        minimal
                      />
                    </Tooltip>
                    <Tooltip content={"Delete"}>
                      <Button icon={"cross"} onClick={onDelete} minimal />
                    </Tooltip>
                  </>
                )}
              </div>
            </>
          )
        }
        resultFilter={resultFilter}
        hideResults={minimized}
        results={results.map(({ id, ...a }) => a)}
        preventSavingSettings
        preventExport
        ctrlClick={(r) => {
          setResultsReferenced(
            new Set([...Array.from(resultsReferenced), r.text])
          );
          clearOnClick?.(r.text);
        }}
        onResultsInViewChange={(r) => (resultsInViewRef.current = r)}
      />
    </div>
  );
};

const SavedQueriesContainer = ({
  savedQueries,
  setSavedQueries,
  clearOnClick,
  setQuery,
}: {
  savedQueries: { uid: string; text: string; results?: Result[] }[];
  setSavedQueries: (
    s: { uid: string; text: string; results?: Result[] }[]
  ) => void;
  clearOnClick: (s: string) => void;
  setQuery: (s: string) => void;
}) => {
  const [resultsReferenced, setResultsReferenced] = useState(new Set<string>());
  const refreshResultsReferenced = useCallback(() => {
    return window.roamAlphaAPI.ui.mainWindow
      .getOpenPageOrBlockUid()
      .then(
        (uid) => uid || window.roamAlphaAPI.util.dateToPageTitle(new Date())
      )
      .then((pageUid) => {
        const title = getPageTitleByPageUid(pageUid);
        if (title.startsWith("Playground")) {
          return new Set(
            (
              window.roamAlphaAPI.data.fast.q(
                `[:find (pull ?c [:block/string]) :where 
            [?p :block/uid "${pageUid}"] 
            [?e :block/page ?p] 
            [?e :block/string "elements"]
            [?e :block/children ?c]]`
              ) as [PullBlock][]
            )
              .filter((a) => a.length && a[0])
              .map((a) => a[0][":block/string"] || "")
          );
        }
        return new Set(
          (
            window.roamAlphaAPI.q(
              `[:find (pull ?r [:node/title]) :where 
            [?p :block/uid "${pageUid}"] 
            [?b :block/page ?p] 
            [?b :block/refs ?r]]`
            ) as [PullBlock][]
          )
            .filter((a) => a.length && a[0])
            .map((a) => a[0][":node/title"] || "")
        );
      })
      .then(setResultsReferenced);
  }, [setResultsReferenced]);
  useEffect(() => {
    window.addEventListener("hashchange", refreshResultsReferenced);
    refreshResultsReferenced();
    return () =>
      window.removeEventListener("hashchange", refreshResultsReferenced);
  }, [refreshResultsReferenced]);
  return (
    <>
      <hr />
      <H3>Saved Queries</H3>
      {savedQueries.map((sq) => (
        <SavedQuery
          uid={sq.uid}
          key={sq.uid}
          clearOnClick={clearOnClick}
          onDelete={() => {
            setSavedQueries(savedQueries.filter((s) => s !== sq));
            deleteBlock(sq.uid);
          }}
          resultsReferenced={resultsReferenced}
          setResultsReferenced={setResultsReferenced}
          editSavedQuery={setQuery}
          initialResults={sq.results}
          onRefresh={refreshResultsReferenced}
        />
      ))}
    </>
  );
};

const QueryDrawerContent = ({
  clearOnClick,
  blockUid,
  onloadArgs,
  ...exportRenderProps
}: Props) => {
  const tree = useMemo(() => getBasicTreeByParentUid(blockUid), []);
  const [savedQueries, setSavedQueries] = useState<
    { text: string; uid: string; results?: Result[] }[]
  >(
    tree
      .filter((t) => !toFlexRegex("scratch").test(t.text))
      .map((t) => ({ text: t.text, uid: t.uid }))
  );
  const [savedQueryLabel, setSavedQueryLabel] = useState(
    `Query ${
      savedQueries.reduce(
        (prev, cur) =>
          prev < Number(cur.text.split(" ")[1])
            ? Number(cur.text.split(" ")[1])
            : prev,
        0
      ) + 1
    }`
  );

  const [query, setQuery] = useState(savedQueryLabel);
  return (
    <>
      <QueryEditor
        key={query}
        parentUid={blockUid}
        onQuery={() => {
          return Promise.all([
            createBlock({
              node: {
                text: savedQueryLabel,
              },
              parentUid: blockUid,
            }).then((newSavedUid) =>
              createBlock({
                node: {
                  text: "scratch",
                },
                parentUid: newSavedUid,
              }).then((scratchUid) => ({ newSavedUid, scratchUid }))
            ),
            fireQuery(parseQuery(blockUid)),
          ]).then(([{ newSavedUid, scratchUid }, results]) =>
            Promise.all(
              getSubTree({ key: "scratch", parentUid: blockUid }).children.map(
                (c, order) =>
                  window.roamAlphaAPI.moveBlock({
                    location: {
                      "parent-uid": scratchUid,
                      order,
                    },
                    block: { uid: c.uid },
                  })
              )
            ).then(() => {
              setSavedQueries([
                { uid: newSavedUid, text: savedQueryLabel, results },
                ...savedQueries,
              ]);
              const nextQueryLabel = savedQueryLabel
                .split(" ")
                .map((s) => (s === "Query" ? s : `${Number(s) + 1}`))
                .join(" ");
              setSavedQueryLabel(nextQueryLabel);
              setQuery(nextQueryLabel);
            })
          );
        }}
      />
      {!!savedQueries.length && (
        <ExtensionApiContextProvider {...onloadArgs}>
          <SavedQueriesContainer
            savedQueries={savedQueries}
            setSavedQueries={setSavedQueries}
            clearOnClick={clearOnClick}
            setQuery={setQuery}
            {...exportRenderProps}
          />
        </ExtensionApiContextProvider>
      )}
    </>
  );
};

const QueryDrawer = ({
  onClose,
  ...props
}: {
  onClose: () => void;
} & Props) => (
  <ResizableDrawer onClose={onClose} title={"Queries"}>
    <QueryDrawerContent {...props} />
  </ResizableDrawer>
);

export const render = (props: Props) =>
  renderOverlay({ Overlay: QueryDrawer, props });

export default QueryDrawer;
