// Design inspiration from Trello
import React from "react";
import { Column, Result } from "../utils/types";
import { Button, Icon, InputGroup } from "@blueprintjs/core";
import Draggable from "react-draggable";
import setInputSettings from "roamjs-components/util/setInputSettings";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import setInputSetting from "roamjs-components/util/setInputSetting";
import { z } from "zod";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import predefinedSelections from "../utils/predefinedSelections";
import toCellValue from "../utils/toCellValue";

const zPriority = z.record(z.number().min(0).max(1));

type Reprioritize = (args: { uid: string; x: number; y: number }) => void;

const KanbanCard = (card: {
  $priority: number;
  $reprioritize: Reprioritize;
  $displayKey: string;
  $getColumnElement: (x: number) => HTMLDivElement | undefined;
  result: Result;
}) => {
  const [isDragging, setIsDragging] = React.useState(false);

  return (
    <Draggable
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
        <div className={`rounded-xl bg-white p-4 hover:bg-gray-200`}>
          {toCellValue({
            value: card.result[card.$displayKey],
            uid: card.result[`${card.$displayKey}-uid`],
          })}
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
}: {
  resultKeys: Column[];
  data: Result[];
  layout: Record<string, string | string[]>;
  onQuery: () => void;
  parentUid: string;
}) => {
  const byUid = React.useMemo(
    () => Object.fromEntries(data.map((d) => [d.uid, d] as const)),
    [data]
  );
  const columnKey = React.useMemo(() => {
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
  const displayKey = React.useMemo(() => {
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
  const [columns, setColumns] = React.useState(() => {
    const configuredCols = Array.isArray(layout.columns)
      ? layout.columns
      : typeof layout.columns === "string"
      ? [layout.columns]
      : undefined;
    if (configuredCols) return configuredCols;
    const valueCounts = data.reduce((prev, d) => {
      const key = d[columnKey]?.toString() || `No ${columnKey}`;
      if (!prev[key]) {
        prev[key] = 0;
      }
      prev[key] += 1;
      return prev;
    }, {} as Record<string, number>);
    return Object.entries(valueCounts)
      .sort((a, b) => b[1] - a[1])
      .map((c) => c[0])
      .slice(0, 3);
  });

  const [prioritization, setPrioritization] = React.useState(() => {
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
  const layoutUid = React.useMemo(() => {
    return Array.isArray(layout.uid)
      ? layout.uid[0]
      : typeof layout.uid === "string"
      ? layout.uid
      : ""; // should we throw an error here? Should never happen in practice...
  }, [layout.uid]);
  const [isAdding, setIsAdding] = React.useState(false);
  const [newColumn, setNewColumn] = React.useState("");
  const cards = React.useMemo(() => {
    const cards: Record<string, Result[]> = {};
    data.forEach((d) => {
      const column = toCellValue({
        value: d[columnKey],
        defaultValue: `No ${columnKey}`,
        uid: d[`${columnKey}-uid`]?.toString(),
      });
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
  const potentialColumns = React.useMemo(() => {
    const columnSet = new Set(columns);
    return Object.keys(cards).filter((c) => !columnSet.has(c));
  }, [cards, columns]);
  React.useEffect(() => {
    const base64 = window.btoa(JSON.stringify(prioritization));
    setInputSetting({
      blockUid: layoutUid,
      key: "prioritization",
      value: base64,
    });
  }, [prioritization]);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const getColumnElement = React.useCallback(
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
  const reprioritize = React.useCallback<Reprioritize>(
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
      if (typeof columnUid !== "string") return;
      predefinedSelection
        .update({
          uid: columnUid,
          value: column,
          selection: columnKeySelection,
          parentUid,
          result,
        })
        .then(onQuery);
    },
    [setPrioritization, cards, containerRef, byUid, columnKey, parentUid]
  );
  return (
    <div
      className="gap-4 items-start p-4 relative roamjs-kanban-container overflow-x-scroll grid"
      ref={containerRef}
    >
      {columns.map((col) => {
        return (
          <div
            key={col}
            className="p-4 rounded-2xl flex-col gap-2 bg-gray-100 w-48 flex-shrink-0 roamjs-kanban-column"
            data-column={col}
            style={{ display: "flex" }}
          >
            <div
              className="justify-between items-center mb-4"
              style={{ display: "flex" }}
            >
              <span className="font-bold">{col}</span>
              <Button
                icon={"trash"}
                minimal
                onClick={() => {
                  const values = columns.filter((c) => c !== col);
                  setInputSettings({
                    blockUid: layout.uid as string,
                    key: "columns",
                    values,
                  });
                  setColumns(values);
                }}
              />
            </div>
            {(cards[col] || [])?.map((d) => (
              <KanbanCard
                key={d.uid}
                result={d}
                // we use $ to prefix these props to avoid collisions with the result object
                $priority={prioritization[d.uid]}
                $reprioritize={reprioritize}
                $getColumnElement={getColumnElement}
                $displayKey={displayKey}
              />
            ))}
          </div>
        );
      })}
      <div className="w-48 flex-shrink-0">
        {isAdding ? (
          <div className="rounded-2xl p-4 bg-gray-100">
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
                    blockUid: layout.uid as string,
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
          <div
            className="rounded-2xl bg-opacity-50 p-8 cursor-pointer bg-gray-100 hover:bg-opacity-25"
            onClick={() => setIsAdding(true)}
          >
            <Icon icon={"plus"} /> Add another column
          </div>
        )}
      </div>
    </div>
  );
};

export default Kanban;
