// Design inspiration from Trello
import React from "react";
import { Result } from "../utils/types";
import { Button, Icon, InputGroup } from "@blueprintjs/core";
import Draggable from "react-draggable";
import setInputSettings from "roamjs-components/util/setInputSettings";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";

const columnKey = "status";

const KanbanCard = (card: { text: string; uid: string }) => {
  const [isDragging, setIsDragging] = React.useState(false);
  return (
    <Draggable
      onDrag={() => setIsDragging(true)}
      onStop={(_, _data) => {
        // set timeout to prevent click handler
        setTimeout(() => setIsDragging(false));
      }}
      bounds={".roamjs-kanban-container"}
    >
      <div
        onClick={(e) => {
          if (isDragging) return;
          if (e.shiftKey) {
            openBlockInSidebar(card.uid);
            e.preventDefault();
            e.stopPropagation();
          } else {
            window.roamAlphaAPI.ui.mainWindow.openBlock({
              block: { uid: card.uid },
            });
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <div
          className={`rounded-xl bg-white p-4 hover:bg-gray-200`}
          style={
            isDragging
              ? {
                  transform: "rotate(20deg)",
                  cursor: "grabbing",
                }
              : {
                  cursor: "pointer",
                  transform: "rotate(0deg)",
                }
          }
        >
          {card.text}
        </div>
      </div>
    </Draggable>
  );
};

const Kanban = ({
  data,
  layout,
}: {
  data: Result[];
  layout: Record<string, string | string[]>;
}) => {
  const [columns, setColumns] = React.useState(() =>
    Array.isArray(layout.columns)
      ? layout.columns
      : typeof layout.columns === "string"
      ? [layout.columns]
      : ["Backlog"]
  );
  const [isAdding, setIsAdding] = React.useState(false);
  const [newColumn, setNewColumn] = React.useState("");
  const cards = React.useMemo(() => {
    const cards: Record<string, Result[]> = {};
    data.forEach((d) => {
      const column = d[columnKey].toString() || "Backlog";
      if (!cards[column]) {
        cards[column] = [];
      }
      cards[column].push(d);
    });
    return cards;
  }, [data]);
  return (
    <div
      className="gap-4 items-start p-4 relative roamjs-kanban-container overflow-x-scroll"
      style={{ display: "flex" }}
    >
      {columns.map((col) => {
        return (
          <div
            key={col}
            className="p-4 rounded-2xl flex-col gap-2 bg-gray-100 w-48 flex-shrink-0"
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
              <KanbanCard key={d.uid} {...d} />
            ))}
          </div>
        );
      })}
      <div className="w-48 flex-shrink-0">
        {isAdding ? (
          <div className="rounded-2xl p-4 bg-gray-100">
            <InputGroup
              placeholder="Enter column title..."
              value={newColumn}
              onChange={(e) => setNewColumn(e.target.value)}
            />
            <div className="gap-4" style={{ display: "flex" }}>
              <Button
                intent="primary"
                text="Add column"
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
