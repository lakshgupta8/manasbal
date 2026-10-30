import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import contractJson from "../../../apps/api/src/prisma/contract.json" with { type: "json" };
import { generateDataset, insertDataset, rowsByTable, type Dataset } from "./dataset.ts";
import type { createDb } from "./db.ts";
import { assertResetAllowed, hasMarker } from "./guard.ts";
import { getProfile } from "./profiles.ts";

type Db = ReturnType<typeof createDb>;

export interface ResetDeps {
  env: NodeJS.ProcessEnv;
  // Connects only for a real reset; a dry run never opens a connection.
  connect: () => Db;
  migrate: () => void;
}

// Postgres stores more than the JSON of a row: a header per row, page overhead and the indexes.
// Checked against pg_database_size after the first real reset.
export const SIZE_OVERHEAD = 2;
const MB = 1024 * 1024;

const IS_WINDOWS = process.platform === "win32";

// Brings the database up to the contract the seed is built against, with the API's own Prisma
// CLI. DATABASE_URL comes from the environment rather than the command line, so a connection
// string with "&" in it survives the Windows shell.
export function migrateDatabase(run: typeof execFileSync = execFileSync): void {
  run("pnpm", ["--filter", "@manasbal/api", "exec", "prisma", "db", "migrate"], {
    stdio: "inherit",
    shell: IS_WINDOWS,
  });
}

// Every table in the API's contract, so a table added later is never left out of the reset.
// Prisma keeps its own migration records outside the contract, so they are never touched.
export function contractTables(): string[] {
  return Object.keys(contractJson.storage.namespaces.public.entries.table).sort();
}

export function truncateSql(tables = contractTables()): string {
  const list = tables.map((table) => `"${table}"`).join(", ");
  return `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`;
}

// Rows per table and an estimated size in bytes.
export function estimate(data: Dataset): { counts: Record<string, number>; bytes: number } {
  const counts: Record<string, number> = {};
  let bytes = 0;
  for (const [table, rows] of Object.entries(rowsByTable(data))) {
    counts[table] = rows.length;
    for (const row of rows) bytes += JSON.stringify(row).length;
  }
  return { counts, bytes: bytes * SIZE_OVERHEAD };
}

function report(profile: string, data: Dataset): void {
  const { counts, bytes } = estimate(data);
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(14)} ${count}`);
  }
  console.log(`Profile "${profile}": about ${(bytes / MB).toFixed(1)} MB`);
}

// Wipes the database and seeds one profile again, in this order: guard, migrate, then truncate
// and seed in one transaction. If seeding fails the truncate rolls back with it.
// Usage: pnpm seed:reset --profile demo [--dry-run]
export async function reset(args: string[], deps: ResetDeps): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      profile: { type: "string", default: "demo" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const data = generateDataset(getProfile(values.profile));
  if (values["dry-run"]) {
    console.log(`Dry run: nothing is written. Rows per table:`);
    report(values.profile, data);
    return;
  }

  const db = deps.connect();
  try {
    await assertResetAllowed(deps.env, () => hasMarker(db.orm));
    deps.migrate();
    const text = truncateSql();
    const strings = Object.assign([text], { raw: [text] }) as unknown as TemplateStringsArray;
    const truncate = db.raw.sql(strings).affectedCount().build();
    await db.transaction(async (tx) => {
      await tx.execute(truncate);
      await insertDataset(tx.orm, data);
    });
    console.log(`Reset to "${values.profile}":`);
    report(values.profile, data);
  } finally {
    await db.close();
  }
}
