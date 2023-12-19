// Design inspiration from Trello
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Column, Result } from "../utils/types";
import { Button, HTMLTable, Icon, Popover, Tooltip } from "@blueprintjs/core";
import Draggable from "react-draggable";
import setInputSettings from "roamjs-components/util/setInputSettings";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import setInputSetting from "roamjs-components/util/setInputSetting";
import { z } from "zod";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import predefinedSelections from "../utils/predefinedSelections";
import toCellValue from "../utils/toCellValue";
import extractTag from "roamjs-components/util/extractTag";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getSubTree from "roamjs-components/util/getSubTree";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";

const zPriority = z.record(z.number().min(0).max(1));

type Reprioritize = (args: { uid: string; x: number; y: number }) => void;

const BlockEmbed = ({
  uid,
  viewValue,
  type,
}: {
  uid: string;
  viewValue: string;
  type: `cell` | `selection`;
}) => {
  const title = getPageTitleByPageUid(uid);
  const contentRef = useRef(null);
  const open =
    viewValue === "open" ? true : viewValue === "closed" ? false : null;
  useEffect(() => {
    const el = contentRef.current;
    if (el) {
      window.roamAlphaAPI.ui.components.renderBlock({
        uid,
        el,
        // "open?": open, // waiting for roamAlphaAPI to add a open/close to renderBlock
      });
    }
  }, [uid, open, contentRef]);
  if (type === "cell") {
    return (
      <div className="roamjs-query-embed -ml-4">
        <div
          ref={contentRef}
          className={!!title ? "page-embed" : "block-embed"}
        />
      </div>
    );
  } else if (type === "selection") {
    return <div ref={contentRef} />;
  }

  return null;
};

type ViewsByColumnType = Record<
  string,
  { column: string; mode: string; value: string }
>;
const KanbanCard = (card: {
  $priority: number;
  $reprioritize: Reprioritize;
  $displayKey: string;
  $getColumnElement: (x: number) => HTMLDivElement | undefined;
  result: Result;
  $columnKey: string;
  $selectionValues: string[];
  viewsByColumn: ViewsByColumnType;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const anyViewIsEmbed = useMemo(
    () => Object.values(card.viewsByColumn).some((v) => v.mode === "embed"),
    [card.viewsByColumn]
  );
  const displayKey = card.$displayKey;
  const cardView = card.viewsByColumn[displayKey];

  return (
    <Draggable
      handle={anyViewIsEmbed ? ".embed-handle" : ""}
      onDrag={(_, data) => {
        const { x, width } = data.node.getBoundingClientRect();
        const el = card.$getColumnElement(x + width / 2);
        if (el) el.style.background = "rgb(226, 232, 240)";
        setIsDragging(true);
      }}
      onStop={(_, data) => {
        const { x, y, width, height } = data.node.getBoundingClientRect();
        card.$reprioritize({
          uid: card.result.uid,
          x: x + width / 2,
          y: y + height / 2,
        });
        // set timeout to prevent click handler
        setTimeout(() => setIsDragging(false));
      }}
      bounds={".roamjs-kanban-container"}
      position={{ x: 0, y: 0 }}
    >
      <div
        className="roamjs-kanban-card"
        data-uid={card.result.uid}
        data-priority={card.$priority}
        onClick={(e) => {
          if (anyViewIsEmbed) return;
          if (isDragging) return;
          if (e.shiftKey) {
            openBlockInSidebar(card.result.uid);
            e.preventDefault();
            e.stopPropagation();
          } else {
            window.roamAlphaAPI.ui.mainWindow.openBlock({
              block: { uid: card.result.uid },
            });
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <Icon
          icon="drag-handle-horizontal"
          className="absolute right-2 top-2 text-gray-400 embed-handle cursor-move z-30"
          hidden={!anyViewIsEmbed}
        />
        <div
          className={`rounded-xl bg-white p-4 ${
            anyViewIsEmbed ? "" : "cursor-pointer hover:bg-gray-200"
          }`}
        >
          <div className="card-display-value">
            {cardView.mode === "embed" ? (
              <BlockEmbed
                uid={card.result.uid}
                viewValue={cardView.value}
                type={"cell"}
              />
            ) : (
              <div className="p-2">
                {toCellValue({
                  value: card.result[displayKey],
                  uid: card.result[`${displayKey}-uid`],
                })}
              </div>
            )}
          </div>
          <div className="card-selections mt-3">
            <div
              className="grid grid-cols-2"
              style={{ gridTemplateColumns: "auto 1fr" }}
            >
              {card.$selectionValues.map((sv) => {
                if (sv === displayKey || sv === card.$columnKey) return null;

                const value = toCellValue({
                  value: card.result[`${sv}-display`] || card.result[sv] || "",
                  uid: (card.result[`${sv}-uid`] as string) || "",
                });

                return (
                  <React.Fragment key={sv}>
                    {card.viewsByColumn[sv].mode === "embed" ? (
                      <div className="col-span-2 text-sm -ml-4">
                        <BlockEmbed
                          uid={card.result[`${sv}-uid`]}
                          viewValue={card.viewsByColumn[sv].value}
                          type={"selection"}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold text-sm p-2">{sv}:</div>
                        <div className="text-sm p-2 text-left">{value}</div>
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Draggable>
  );
};

const inlineTry = <T extends unknown>(f: () => T, d: T) => {
  try {
    return f();
  } catch (e) {
    return d;
  }
};

const Kanban = ({
  data,
  layout,
  onQuery,
  resultKeys,
  parentUid,
  views,
}: {
  resultKeys: Column[];
  data: Result[];
  layout: Record<string, string | string[]>;
  onQuery: () => void;
  parentUid: string;
  views: { column: string; mode: string; value: string }[];
}) => {
  const byUid = useMemo(
    () => Object.fromEntries(data.map((d) => [d.uid, d] as const)),
    [data]
  );
  const columnKey = useMemo(() => {
    const configuredKey = Array.isArray(layout.key)
      ? layout.key[0]
      : typeof layout.key === "string"
      ? layout.key
      : "";
    if (configuredKey) return configuredKey;
    const keySets = Object.fromEntries(
      resultKeys.map((rk) => [rk.key, new Set()])
    );
    data.forEach((d) => {
      resultKeys.forEach((rk) => {
        keySets[rk.key].add(d[rk.key]);
      });
    });
    const defaultColumnKey = Object.entries(keySets).reduce(
      (prev, [k, v]) => (v.size < prev[1] ? ([k, v.size] as const) : prev),
      ["" as string, data.length + 1] as const
    )[0];
    setInputSetting({
      key: "key",
      value: defaultColumnKey,
      blockUid: layout.uid as string,
    });
    return defaultColumnKey;
  }, [layout.key]);
  const DEFAULT_FORMAT = `No ${columnKey}`;
  const displayKey = useMemo(() => {
    const configuredDisplay = Array.isArray(layout.display)
      ? layout.display[0]
      : typeof layout.display === "string"
      ? layout.display
      : undefined;
    if (configuredDisplay) return configuredDisplay;
    const defaultDisplayKey = resultKeys[0].key;
    setInputSetting({
      key: "display",
      value: defaultDisplayKey,
      blockUid: layout.uid as string,
    });
    return defaultDisplayKey;
  }, [layout.key]);
  const [columns, setColumns] = useState(() => {
    const configuredCols = Array.isArray(layout.columns)
      ? layout.columns
      : typeof layout.columns === "string"
      ? [layout.columns]
      : undefined;
    if (configuredCols) return configuredCols;
    const valueCounts = data.reduce((prev, d) => {
      const key = d[columnKey]?.toString() || DEFAULT_FORMAT;
      if (!prev[key]) {
        prev[key] = 0;
      }
      prev[key] += 1;
      return prev;
    }, {} as Record<string, number>);
    const cleanedValueCounts = Object.fromEntries(
      Object.entries(valueCounts).map(([key, value]) => [
        extractTag(key),
        value,
      ])
    );
    return Object.entries(cleanedValueCounts)
      .sort((a, b) => b[1] - a[1])
      .map((c) => c[0])
      .slice(0, 3);
  });

  const [prioritization, setPrioritization] = useState(() => {
    const base64 = Array.isArray(layout.prioritization)
      ? layout.prioritization[0]
      : typeof layout.prioritization === "string"
      ? layout.prioritization
      : "e30="; // base64 of {}
    const stored = inlineTry(
      () => zPriority.parse(JSON.parse(window.atob(base64))),
      {}
    );
    data.forEach((d) => {
      if (!stored[d.uid]) {
        stored[d.uid] = Math.random();
      }
    });
    return stored;
  });
  const layoutUid = useMemo(() => {
    return Array.isArray(layout.uid)
      ? layout.uid[0]
      : typeof layout.uid === "string"
      ? layout.uid
      : ""; // should we throw an error here? Should never happen in practice...
  }, [layout.uid]);
  const [isAdding, setIsAdding] = useState(false);
  const [newColumn, setNewColumn] = useState("");
  const cards = useMemo(() => {
    const cards: Record<string, Result[]> = {};
    data.forEach((d) => {
      const column =
        toCellValue({
          value: d[columnKey],
          defaultValue: DEFAULT_FORMAT,
          uid: d[`${columnKey}-uid`]?.toString(),
        }) || DEFAULT_FORMAT;
      if (!cards[column]) {
        cards[column] = [];
      }
      cards[column].push(d);
    });
    Object.keys(cards).forEach((k) => {
      cards[k] = cards[k].sort(
        (a, b) => prioritization[a.uid] - prioritization[b.uid]
      );
    });
    return cards;
  }, [data, prioritization, columnKey]);
  const potentialColumns = useMemo(() => {
    const columnSet = new Set(columns);
    return Object.keys(cards).filter((c) => !columnSet.has(c));
  }, [cards, columns]);
  useEffect(() => {
    const base64 = window.btoa(JSON.stringify(prioritization));
    setInputSetting({
      blockUid: layoutUid,
      key: "prioritization",
      value: base64,
    });
  }, [prioritization]);
  const containerRef = useRef<HTMLDivElement>(null);
  const getColumnElement = useCallback(
    (x: number) => {
      if (!containerRef.current) return;
      const columnEls = Array.from<HTMLDivElement>(
        containerRef.current.querySelectorAll(".roamjs-kanban-column")
      ).reverse();
      columnEls.forEach((el) => (el.style.background = ""));
      return columnEls.find((el) => {
        const { left } = el.getBoundingClientRect();
        return x >= left;
      });
    },
    [containerRef]
  );
  const reprioritizeAndUpdateBlock = useCallback<Reprioritize>(
    ({ uid, x, y }) => {
      if (!containerRef.current) return;
      const newColumn = getColumnElement(x);
      if (!newColumn) return;

      const column = newColumn.getAttribute("data-column");
      if (!column) return;

      const _cardIndex = Array.from(
        newColumn.querySelectorAll(
          ".roamjs-kanban-card:not(.react-draggable-dragging)"
        )
      )
        .map((el, index) => ({ el, index }))
        .reverse()
        .find(({ el }) => {
          const { top } = el.getBoundingClientRect();
          return y >= top;
        })?.index;
      const cardIndex = typeof _cardIndex === "undefined" ? -1 : _cardIndex;
      const topCard = cards[column]?.[cardIndex];
      const bottomCard = cards[column]?.[cardIndex + 1];
      const topPriority = prioritization[topCard?.uid] || 0;
      const bottomPriority = prioritization[bottomCard?.uid] || 1;
      const priority = (topPriority + bottomPriority) / 2;
      setPrioritization((p) => ({ ...p, [uid]: priority }));

      // Update block
      const result = byUid[uid];
      if (!result) return;
      const columnKeySelection = resultKeys.find(
        (rk) => rk.key === columnKey
      )?.selection;
      if (!columnKeySelection) return;
      const predefinedSelection = predefinedSelections.find((ps) =>
        ps.test.test(columnKeySelection)
      );
      if (!predefinedSelection?.update) return;
      const { [`${columnKey}-uid`]: columnUid } = result;
      const previousValue = toCellValue({
        value: result[columnKey],
        uid: columnUid?.toString(),
      });
      const isRemoveValue = column === DEFAULT_FORMAT;
      if (isRemoveValue && !previousValue) return;
      if (typeof columnUid !== "string") return;
      predefinedSelection
        .update({
          uid: columnUid,
          value: isRemoveValue ? "" : column,
          selection: columnKeySelection,
          parentUid,
          result,
          previousValue,
        })
        .then(onQuery);
    },
    [setPrioritization, cards, containerRef, byUid, columnKey, parentUid]
  );
  const showLegend = useMemo(
    () => (Array.isArray(layout.legend) ? layout.legend[0] : layout.legend),
    [layout.legend]
  );
  const [openedPopoverIndex, setOpenedPopoverIndex] = useState<number | null>(
    null
  );

  const moveColumn = async (
    direction: "left" | "right",
    columnIndex: number
  ) => {
    const offset = direction === "left" ? -1 : 1;
    const newColumns = [...columns];
    // Swap elements
    [newColumns[columnIndex], newColumns[columnIndex + offset]] = [
      newColumns[columnIndex + offset],
      newColumns[columnIndex],
    ];

    const columnUid = getSubTree({
      key: "columns",
      parentUid: layoutUid,
    }).uid;
    await deleteBlock(columnUid);

    setInputSettings({
      blockUid: layoutUid,
      key: "columns",
      values: newColumns,
    });
    setColumns(newColumns);
    setOpenedPopoverIndex(null);
  };

  const viewsByColumn = useMemo(
    () => Object.fromEntries(views.map((v) => [v.column, v])),
    [views]
  );
  const { mode: view, value: viewValue } = viewsByColumn[displayKey] || {};

  return (
    <div className="relative">
      {showLegend === "Yes" && (
        <div
          className="p-4 w-full"
          style={{
            background: "#eeeeee80",
          }}
        >
          <div className="inline-block mr-4">
            <span className="font-bold">Group By:</span>
            <span> {columnKey}</span>
          </div>
          <div className="inline-block">
            <span className="font-bold">Display:</span>
            <span> {displayKey}</span>
          </div>
        </div>
      )}
      <div className="flex w-full p-4">
        <div
          className="gap-2 items-start relative roamjs-kanban-container overflow-x-scroll flex w-full"
          ref={containerRef}
        >
          {columns.map((col, columnIndex) => {
            return (
              <div
                key={col}
                className="p-4 rounded-2xl flex flex-col gap-2 bg-gray-100 flex-shrink-1 roamjs-kanban-column max-w-2xl"
                data-column={col}
                style={{ minWidth: "24rem" }}
              >
                <div
                  className="justify-between items-center mb-4"
                  style={{ display: "flex" }}
                >
                  <span className="font-bold">{col}</span>
                  <Popover
                    autoFocus={false}
                    interactionKind="hover"
                    placement="bottom"
                    isOpen={openedPopoverIndex === columnIndex}
                    onInteraction={(next) =>
                      next
                        ? setOpenedPopoverIndex(columnIndex)
                        : setOpenedPopoverIndex(null)
                    }
                    captureDismiss={true}
                    content={
                      <>
                        <Button
                          className="p-4"
                          minimal
                          icon="arrow-left"
                          disabled={columnIndex === 0}
                          onClick={() => moveColumn("left", columnIndex)}
                        />
                        <Button
                          className="p-4"
                          minimal
                          icon="arrow-right"
                          disabled={columnIndex === columns.length - 1}
                          onClick={() => moveColumn("right", columnIndex)}
                        />
                        <Button
                          className="p-4"
                          intent="danger"
                          minimal
                          icon="trash"
                          onClick={() => {
                            const values = columns.filter((c) => c !== col);
                            setInputSettings({
                              blockUid: layout.uid as string,
                              key: "columns",
                              values,
                            });
                            setColumns(values);
                            setOpenedPopoverIndex(null);
                          }}
                        />
                      </>
                    }
                    position="bottom-left"
                  >
                    <Button icon="more" minimal />
                  </Popover>
                </div>
                {(cards[col] || [])?.map((d) => (
                  <KanbanCard
                    key={d.uid}
                    result={d}
                    viewsByColumn={viewsByColumn}
                    // we use $ to prefix these props to avoid collisions with the result object
                    $priority={prioritization[d.uid]}
                    $reprioritize={reprioritizeAndUpdateBlock}
                    $getColumnElement={getColumnElement}
                    $displayKey={displayKey}
                    $columnKey={columnKey}
                    $selectionValues={resultKeys.map((rk) => rk.key)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-2 absolute bottom-8 right-8">
        {isAdding ? (
          <div className="rounded-2xl p-4 bg-gray-100 w-48 border border-gray-200 ">
            <AutocompleteInput
              placeholder="Enter column title..."
              value={newColumn}
              setValue={setNewColumn}
              options={potentialColumns}
            />
            <div
              className="justify-between items-center mt-2"
              style={{ display: "flex" }}
            >
              <Button
                intent="primary"
                text="Add column"
                className="text-xs"
                disabled={!newColumn}
                onClick={() => {
                  const values = [...columns, newColumn];
                  setInputSettings({
                    blockUid: layoutUid,
                    key: "columns",
                    values,
                  });
                  setColumns(values);
                  setIsAdding(false);
                  setNewColumn("");
                }}
              />
              <Button
                icon={"cross"}
                minimal
                onClick={() => setIsAdding(false)}
              />
            </div>
          </div>
        ) : (
          <Tooltip content="Add another column">
            <div>
              <Icon
                className="rounded-2xl p-4 cursor-pointer border border-gray-200 bg-gray-100 hover:bg-opacity-25"
                icon={"plus"}
                onClick={() => setIsAdding(true)}
              />
            </div>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default Kanban;
