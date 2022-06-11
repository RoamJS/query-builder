import { Button, Intent, InputGroup } from "@blueprintjs/core";
import { useState } from "react";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import type { RoamBasicNode } from "roamjs-components/types";
import getSubTree from "roamjs-components/util/getSubTree";
import createBlock from "roamjs-components/writes/createBlock";

type FilterData = {
  includes: { values: Set<string> };
  excludes: { values: Set<string> };
  uid: string;
};

export const getFilterEntries = (
  n: Pick<RoamBasicNode, "children">
): [string, FilterData][] =>
  n.children.map((c) => [
    c.text,
    {
      includes: {
        values: new Set(
          getSubTree({ tree: c.children, key: "includes" }).children.map(
            (t) => t.text
          )
        ),
      },
      excludes: {
        values: new Set(
          getSubTree({ tree: c.children, key: "excludes" }).children.map(
            (t) => t.text
          )
        ),
      },
      uid: c.uid,
    },
  ]);

const Filter = ({
  column,
  data,
  onFilterAdd,
  onFilterRemove,
  onRemove,
}: {
  column: string;
  data: FilterData;
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
            text={"Add Include"}
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
            text={"Add Exclude"}
            rightIcon={"add"}
            intent={Intent.WARNING}
            onClick={() => {
              onFilterAdd({ text: newFilter, type: "excludes" }).then(() =>
                setNewFilter("")
              );
            }}
          />
        </div>
      </div>
    </div>
  );
};

const DefaultFilters = ({ uid }: { uid: string }) => {
  const [newColumn, setNewColumn] = useState("");
  const [filters, setFilters] = useState(() =>
    Object.fromEntries(
      getFilterEntries({ children: getBasicTreeByParentUid(uid) })
    )
  );
  return (
    <>
      {Object.entries(filters).map(([column, data]) => (
        <Filter
          column={column}
          key={column}
          data={data}
          onFilterAdd={({ text, type }) =>
            createBlock({
              parentUid: getSubTree({ parentUid: data.uid, key: type }).uid,
              node: { text },
            }).then(() => {
              data[type].values.add(text);
              setFilters({
                ...filters,
              });
            })
          }
          onFilterRemove={({ text, type }) =>
            deleteBlock(
              getSubTree({ parentUid: data.uid, key: type }).children.find(
                (t) => t.text === text
              )?.uid
            ).then(() => {
              data[type].values.delete(text);
              setFilters({
                ...filters,
              });
            })
          }
          onRemove={() =>
            deleteBlock(data.uid).then(() =>
              setFilters(
                Object.fromEntries(
                  Object.entries(filters).filter(([, d]) => d.uid !== data.uid)
                )
              )
            )
          }
        />
      ))}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <InputGroup
          value={newColumn}
          onChange={(e) => setNewColumn(e.target.value)}
        />
        <Button
          text={"Add Column"}
          rightIcon={"add"}
          intent={Intent.PRIMARY}
          onClick={() => {
            createBlock({
              parentUid: uid,
              node: {
                text: newColumn,
                children: [{ text: "includes" }, { text: "excludes" }],
              },
            }).then((fuid) => {
              setFilters({
                ...filters,
                [newColumn]: {
                  includes: { values: new Set() },
                  excludes: { values: new Set() },
                  uid: fuid,
                },
              });
              setNewColumn("");
            });
          }}
        />
      </div>
    </>
  );
};

export default DefaultFilters;
