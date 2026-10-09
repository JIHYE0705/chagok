// @vitest-environment node
import { expect, test } from "vitest";
import { prepareTest, checkResults } from "../../scripts/test-linked-db";

test("remote tests collect every assertion and roll back pending schema too", () => {
  const sql = prepareTest("begin;\nselect is(1,1,'works');\nselect * from finish();\nrollback;", "create function fixture() returns integer language sql as $$select 1$$;");
  expect(sql).toContain("insert into pg_temp.tap_results select is");
  expect(sql).toContain("insert into pg_temp.tap_results select * from finish()");
  expect(sql).toContain("select array_agg(line) as tap");
  expect(sql).toContain("as $$select 1$$;");
  expect(sql.trim()).toMatch(/rollback;$/);
  expect(() => prepareTest("delete from items;")).toThrow("roll back");
});

test("failed, missing and incomplete pgTAP results cannot pass", () => {
  expect(checkResults([{ tap: ["ok 1 - works", "1..1"] }])).toBe(1);
  expect(() => checkResults([{ tap: ["not ok 1 - broken", "1..1"] }])).toThrow("broken");
  expect(() => checkResults([{ tap: ["ok 1 - works", "1..2"] }])).toThrow("Incomplete");
  expect(() => checkResults([])).toThrow("Missing");
});
