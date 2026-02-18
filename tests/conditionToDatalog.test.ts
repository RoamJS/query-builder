import { expect, test } from "@playwright/test";
import conditionToDatalog from "../src/utils/conditionToDatalog";

test("has title {date} compiles to :log/id clause", () => {
  const clauses = conditionToDatalog({
    type: "clause",
    uid: "test",
    relation: "has title",
    source: "node",
    target: "{date}",
  });

  expect(clauses).toEqual([
    {
      type: "data-pattern",
      arguments: [
        { type: "variable", value: "node" },
        { type: "constant", value: ":log/id" },
        { type: "variable", value: "node-log-id" },
      ],
    },
  ]);
});
