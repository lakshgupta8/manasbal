import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  startTestDatabase,
  type TestDatabase,
} from "../../../apps/api/test/support/test-database.ts";
import { dumpTables, firstDifference } from "../src/compare.ts";
import { generateDataset, rowsByTable } from "../src/dataset.ts";
import { createDb } from "../src/db.ts";
import { PROFILES } from "../src/profiles.ts";
import { contractTables, truncatePlan } from "../src/reset.ts";
import { seed } from "../src/seed.ts";

// Seeds the minimal profile into a fresh, fully migrated Postgres through the same code path as
// `pnpm seed`, checks every table's row count, then seeds again and checks nothing changed.
describe("the seed against a real database", () => {
  let database: TestDatabase;
  const expected = rowsByTable(generateDataset(PROFILES.minimal));

  beforeAll(async () => {
    database = await startTestDatabase();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await seed(["--profile", "minimal"], createDb(database.url));
  });

  afterAll(async () => {
    await database?.stop();
  });

  it("writes the expected number of rows to every table, and one marker", async () => {
    for (const table of contractTables()) {
      const count = Number(await database.sql(`SELECT count(*) FROM "${table}"`));
      expect(count, table).toBe(expected[table]?.length ?? 0);
    }
    expect(await database.sql(`SELECT count(*) FROM "_demo_marker"`)).toBe("1");
  });

  it("writes exactly the same rows when it runs again", async () => {
    const first = await dumpTables(database.sql);

    const db = createDb(database.url);
    try {
      await db.transaction((tx) => tx.execute(truncatePlan(db)));
    } finally {
      await db.close();
    }
    await seed(["--profile", "minimal"], createDb(database.url));
    const second = await dumpTables(database.sql);

    const difference = firstDifference(first, second);
    if (difference) {
      const { table, index, left, right } = difference;
      expect.fail(
        `${table} row ${index} differs:\n${JSON.stringify(left)}\n${JSON.stringify(right)}`,
      );
    }
    expect(first["orders"]).toHaveLength(5);
  });
});
