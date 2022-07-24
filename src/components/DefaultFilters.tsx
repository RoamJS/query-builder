import { Button, Intent, InputGroup } from "@blueprintjs/core";
import { useEffect, useRef, useState } from "react";
import type { OnloadArgs } from "roamjs-components/types";
import type { Filters } from "roamjs-components/components/Filter";

export type StoredFilters = {
  includes: { values: string[] };
  excludes: { values: string[] };
};

const Filter = ({
  column,
  data,
  onFilterAdd,
  onFilterRemove,
  onRemove,
}: {
  column: string;
  data: Filters;
  onFilterAdd: (args: {
    text: string;
    type: "includes" | "excludes";
  }) => Promise<unknown>;
  onFilterRemove: (args: {
    text: string;
    type: "includes" | "excludes";
  }) => Promise<unknown>;
  onRemove: () => void;
}) => {
  const [newFilter, setNewFilter] = useState("");
  return (
    <div
      style={{
        borderRadius: 4,
        border: "1px dashed #EEEEEE",
        marginBottom: 8,
        padding: 8,
      }}
    >
      <h4>{column}</h4>
      <div style={{ display: "flex" }}>
        <ul style={{ width: "50%" }}>
          {Array.from(data.includes.values).map((v) => (
            <li
              key={v}
              onClick={() => onFilterRemove({ text: v, type: "includes" })}
              style={{ cursor: "pointer" }}
            >
              {v}
            </li>
          ))}
        </ul>
        <ul style={{ width: "50%" }}>
          {Array.from(data.excludes.values).map((v) => (
            <li
              key={v}
              onClick={() => onFilterRemove({ text: v, type: "excludes" })}
              style={{ cursor: "pointer" }}
            >
              {v}
            </li>
          ))}
        </ul>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <InputGroup
          value={newFilter}
          onChange={(e) => setNewFilter(e.target.value)}
        />
        <div>
          <Button
            text={"Include"}
            rightIcon={"add"}
            intent={Intent.SUCCESS}
            style={{ marginRight: 8 }}
            onClick={() => {
              onFilterAdd({ text: newFilter, type: "includes" }).then(() =>
                setNewFilter("")
              );
            }}
          />
          <Button
            text={"Exclude"}
            rightIcon={"add"}
            intent={Intent.WARNING}
            onClick={() => {
              onFilterAdd({ text: newFilter, type: "excludes" }).then(() =>
                setNewFilter("")
              );
            }}
          />
          <Button icon={"trash"} onClick={onRemove} minimal />
        </div>
      </div>
    </div>
  );
};

const DefaultFilters = (extensionAPI: OnloadArgs["extensionAPI"]) => () => {
  const [newColumn, setNewColumn] = useState("");
  const [filters, setFilters] = useState(() =>
    Object.fromEntries(
      Object.entries(
        (extensionAPI.settings.get("default-filters") as Record<
          string,
          StoredFilters
        >) || {}
      ).map(([k, v]) => [
        k,
        {
          includes: Object.fromEntries(
            Object.entries(v.includes).map(([k, v]) => [k, new Set(v)])
          ),
          excludes: Object.fromEntries(
            Object.entries(v.excludes).map(([k, v]) => [k, new Set(v)])
          ),
        },
      ])
    )
  );

  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current.className = "rm-extensions-settings";
  }, [inputRef]);
  useEffect(() => {
    extensionAPI.settings.set(
      "default-filters",
      Object.fromEntries(
        Object.entries(filters).map(([k, v]) => [
          k,
          {
            includes: Object.fromEntries(
              Object.entries(v.includes).map(([k, v]) => [k, Array.from(v)])
            ),
            excludes: Object.fromEntries(
              Object.entries(v.excludes).map(([k, v]) => [k, Array.from(v)])
            ),
          },
        ])
      )
    );
  }, [filters]);
  return (
    <div
      style={{
        width: "100%",
        minWidth: 256,
      }}
    >
      {Object.entries(filters).map(([column, data]) => (
        <Filter
          column={column}
          key={column}
          data={data}
          onFilterAdd={({ text, type }) => {
            data[type].values.add(text);
            const newFilters = {
              ...filters,
            };
            setFilters(newFilters);
            extensionAPI.settings.set("default-filters", newFilters);
            return Promise.resolve();
          }}
          onFilterRemove={({ text, type }) => {
            data[type].values.delete(text);
            const newFilters = {
              ...filters,
            };
            setFilters(newFilters);
            extensionAPI.settings.set("default-filters", newFilters);
            return Promise.resolve();
          }}
          onRemove={() => {
            const newFilters = Object.fromEntries(
              Object.entries(filters).filter(([col, d]) => col !== column)
            );
            setFilters(newFilters);
            extensionAPI.settings.set("default-filters", newFilters);
            return Promise.resolve();
          }}
        />
      ))}
      <div className="flex justify-between items-center gap-2">
        <InputGroup
          value={newColumn}
          onChange={(e) => setNewColumn(e.target.value)}
          inputRef={inputRef}
        />
        <Button
          text={"Column"}
          rightIcon={"add"}
          intent={Intent.PRIMARY}
          onClick={() => {
            const newFilters = {
              ...filters,
              [newColumn]: {
                includes: { values: new Set<string>() },
                excludes: { values: new Set<string>() },
              },
            };
            setFilters(newFilters);
            extensionAPI.settings.set("default-filters", newFilters);
            setNewColumn("");
          }}
        />
      </div>
    </div>
  );
};

export default DefaultFilters;
