// Design inspiration from Trello
import React from "react";
import { Result } from "../utils/types";
import { Button, Icon, InputGroup } from "@blueprintjs/core";
import setInputSettings from "roamjs-components/util/setInputSettings";

const columnKey = "status";

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
    <div className="flex gap-4 items-start p-4">
      {columns.map((col) => {
        return (
          <div key={col} className="p-4 rounded-2xl flex flex-col gap-2 bg-gray-100 w-64">
            <div className="font-bold mb-4">{col}</div>
            {(cards[col] || [])?.map((d) => (
              <div key={d.uid} className="rounded-xl bg-white p-4">
                {d.text}
              </div>
            ))}
          </div>
        );
      })}
      <div className="rounded-2xl w-64">
        {isAdding ? (
          <div className="p-4 bg-gray-100">
            <InputGroup
              placeholder="Enter column title..."
              value={newColumn}
              onChange={(e) => setNewColumn(e.target.value)}
            />
            <div className="flex gap-4">
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
            className="bg-opacity-50 p-8 cursor-pointer hover:bg-opacity-25"
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
