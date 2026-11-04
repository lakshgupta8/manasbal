import { verify } from "@node-rs/argon2";
import { DEMO_EMAILS, ROLES } from "@manasbal/types";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  startTestDatabase,
  type TestDatabase,
} from "../../../apps/api/test/support/test-database.ts";
import { dumpTables, firstDifference } from "../src/compare.ts";
import { generateDataset, rowsByTable } from "../src/dataset.ts";
import { DEMO_PASSWORD } from "../src/demo-logins.ts";
import { createDb } from "../src/db.ts";
import { PROFILES } from "../src/profiles.ts";
import { contractTables, truncatePlan } from "../src/reset.ts";
import { seed } from "../src/seed.ts";

// Seeds the minimal profile into a fresh, fully migrated Postgres through the same code path as
// `pnpm seed`, checks every table's row count and the demo logins, then seeds again and checks
// nothing changed. The one column that may change is users.password_hash: the demo logins'
// argon2id hashes use a random salt (see IGNORED_COLUMNS in src/compare.ts).
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

  it("writes one confirmed demo login per role whose hash verifies the public password", async () => {
    const logins = JSON.parse(
      await database.sql(
        `SELECT json_agg(u ORDER BY u.email) FROM (SELECT email, role, password_hash, is_sample, created_by_visitor, email_verified_at, totp_enabled_at FROM users WHERE email_verified_at IS NOT NULL) u`,
      ),
    ) as {
      email: string;
      role: string;
      password_hash: string;
      is_sample: boolean;
      created_by_visitor: boolean;
      email_verified_at: string | null;
      totp_enabled_at: string | null;
    }[];

    expect(logins.map(({ email, role }) => [email, role])).toEqual(
      Object.entries(DEMO_EMAILS)
        .map(([role, email]) => [email, role])
        .sort(([a], [b]) => a!.localeCompare(b!)),
    );
    expect(logins.map((login) => login.role).sort((a, b) => a.localeCompare(b))).toEqual(
      [...ROLES].sort((a, b) => a.localeCompare(b)),
    );
    const verified = await Promise.all(
      logins.map((login) => verify(login.password_hash, DEMO_PASSWORD)),
    );
    expect(verified).toEqual(logins.map(() => true));
    for (const login of logins) {
      expect(login.email).toMatch(/@example\.com$/);
      expect(login.password_hash).toMatch(/^\$argon2id\$/);
      expect(login).toMatchObject({
        is_sample: true,
        created_by_visitor: false,
        totp_enabled_at: null,
      });
    }
    // The demo seller owns a store.
    expect(
      await database.sql(
        `SELECT count(*) FROM sellers s JOIN users u ON u.id = s.user_id WHERE u.email = 'seller@example.com'`,
      ),
    ).toBe("1");
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
