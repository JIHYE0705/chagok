import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function prepareTest(sql: string, migrations = "") {
  if (!/^begin;/i.test(sql.trim()) || !/rollback;\s*$/i.test(sql)) throw new Error("DB tests must begin a transaction and roll back.");
  const captured = sql.replace(/^select (?=(?:is|isnt|ok|lives_ok|throws_ok|results_eq)\(|checks\.\*|\* from finish\(\))/gm, "insert into pg_temp.tap_results select ");
  return captured.replace(/^begin;/i, () => `begin;\n${migrations}\ncreate temporary table tap_results (line text);\ngrant select, insert on pg_temp.tap_results to authenticated, anon;`)
    .replace(/rollback;\s*$/i, "select array_agg(line) as tap from pg_temp.tap_results;\nrollback;");
}

export function checkResults(rows: { tap?: string[] }[]) {
  const lines = rows?.[0]?.tap;
  if (!Array.isArray(lines) || !lines.some((line) => /^1\.\.\d+$/.test(line))) throw new Error("Missing pgTAP results.");
  const failed = lines.filter((line) => /^not ok\b|^# Looks like|^Bail out!/m.test(line));
  if (failed.length) throw new Error(failed.join("\n"));
  const tests = lines.filter((line) => /^ok\b/.test(line)).length;
  const plan = Number(lines.find((line) => /^1\.\.\d+$/.test(line))!.slice(3));
  if (!tests || tests !== plan) throw new Error("Incomplete pgTAP results.");
  return tests;
}

function query<T>(args: string[]): { rows: T[] } {
  // SQL fixture contents and credentials never go into the process log.
  return JSON.parse(execFileSync("node_modules/.bin/supabase", ["db", "query", "--linked", ...(process.env.SUPABASE_PROJECT_REF ? ["--project-ref", process.env.SUPABASE_PROJECT_REF] : []), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 4 * 1024 * 1024 }));
}

export function runTests() {
  const applied = new Set(query<{ version: string }>(["select version from supabase_migrations.schema_migrations"]).rows.map(({ version }) => version));
  const pending = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql") && !applied.has(name.split("_")[0]));
  const migrations = pending.map((name) => readFileSync(join("supabase/migrations", name), "utf8").replace(/^begin;\s*/i, "").replace(/commit;\s*$/i, "")).join("\n");
  const directory = mkdtempSync(join(tmpdir(), "chagok-db-tests-"));
  try {
    for (const name of readdirSync("supabase/tests").filter((name) => name.endsWith(".sql")).sort()) {
      const file = join(directory, name);
      writeFileSync(file, prepareTest(readFileSync(join("supabase/tests", name), "utf8"), migrations));
      const tests = checkResults(query<{ tap?: string[] }>(["--file", file]).rows);
      console.log(`${name}: ${tests} passed (linked Supabase, rolled back)`);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { runTests(); } catch (error) { console.error(error instanceof Error ? error.message : "DB test failed"); process.exitCode = 1; }
}
