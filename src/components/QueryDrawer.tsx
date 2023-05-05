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
  clearOnClick,
  editSavedQuery,
  initialResults,
}: {
  uid: string;
  onDelete?: () => void;
  isSavedToPage?: boolean;
  clearOnClick: (s: string) => void;
  editSavedQuery: (s: string) => void;
  initialResults?: Result[];
}) => {
  const [results, setResults] = useState<Result[]>(initialResults || []);
  const [minimized, setMinimized] = useState(!isSavedToPage && !initialResults);
  const [initialQuery, setInitialQuery] = useState(!!initialResults);
  const [label, setLabel] = useState(() => getTextByBlockUid(uid));
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [error, setError] = useState("");
  const resultsInViewRef = useRef<Result[]>([]);
  const refresh = useCallback(
    () =>
      fireQuery(parseQuery(uid))
        .then(setResults)
        .catch(() => {
          setError(
            `Query failed to run. Try running a new query from the editor.`
          );
        }),
    [uid, setResults, setError]
  );
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
        onRefresh={refresh}
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
              <div className="mr-16 mt-2">
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
                        onClick={() => {
                          if (!initialQuery && minimized) {
                            setInitialQuery(true);
                            refresh().finally(() => setMinimized(false));
                          }
                          setMinimized(!minimized);
                        }}
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
        hideResults={minimized}
        results={results.map(({ id, ...a }) => a)}
        preventExport
        ctrlClick={(r) => {
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
          editSavedQuery={setQuery}
          initialResults={sq.results}
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
