import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import contractJson from "../../../apps/api/src/prisma/contract.json" with { type: "json" };
import { generateDataset, insertDataset } from "./dataset.ts";
import { PROFILES } from "./profiles.ts";
import {
  contractTables,
  estimate,
  migrateDatabase,
  reset,
  truncateSql,
  type ResetDeps,
} from "./reset.ts";

vi.mock("./dataset.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./dataset.ts")>()),
  insertDataset: vi.fn(async () => undefined),
}));

const MB = 1024 * 1024;

// A client whose every step records itself, so the tests can check the order.
function fakeDeps(env: NodeJS.ProcessEnv = { SEED_ALLOW_RESET: "true" }, marker = true) {
  const steps: string[] = [];
  vi.mocked(insertDataset).mockImplementation(async () => {
    steps.push("seed");
  });
  const tx = {
    orm: { fake: "transaction orm" },
    execute: vi.fn(async (plan: unknown) => {
      steps.push("truncate");
      return plan;
    }),
  };
  const db = {
    orm: {
      public: {
        DemoMarker: {
          select: () => ({
            first: async () => {
              steps.push("guard");
              return marker ? { id: "m" } : null;
            },
          }),
        },
      },
    },
    raw: {
      sql: vi.fn((_strings: TemplateStringsArray) => ({
        affectedCount: () => ({ build: () => "truncate plan" }),
      })),
    },
    transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    close: vi.fn(async () => undefined),
  };
  const deps = {
    env,
    connect: vi.fn(() => db as unknown as ReturnType<ResetDeps["connect"]>),
    migrate: vi.fn(() => {
      steps.push("migrate");
    }),
  };
  return { deps, db, tx, steps };
}

describe("reset", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("guards, migrates, then truncates and seeds in one transaction, then closes", async () => {
    const { deps, db, tx, steps } = fakeDeps();

    await reset(["--profile", "minimal"], deps);

    expect(steps).toEqual(["guard", "migrate", "truncate", "seed"]);
    expect(tx.execute).toHaveBeenCalledWith("truncate plan");
    expect([...vi.mocked(db.raw.sql).mock.calls[0]![0]]).toEqual([truncateSql()]);
    expect(insertDataset).toHaveBeenCalledWith(
      tx.orm,
      expect.objectContaining({ marker: expect.anything() }),
    );
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.close).toHaveBeenCalled();
  });

  it("resets the demo profile by default", async () => {
    const { deps } = fakeDeps();

    await reset([], deps);

    expect(vi.mocked(insertDataset).mock.calls[0]![1].people.customers).toHaveLength(300);
  });

  it("on a dry run, prints the counts and never connects, migrates, truncates or seeds", async () => {
    const { deps, steps } = fakeDeps();

    await reset(["--profile", "minimal", "--dry-run"], deps);

    expect(deps.connect).not.toHaveBeenCalled();
    expect(deps.migrate).not.toHaveBeenCalled();
    expect(insertDataset).not.toHaveBeenCalled();
    expect(steps).toEqual([]);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^ {2}orders +5$/));
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^Profile "minimal": about/));
  });

  it("stops everything when the guard refuses, and still closes", async () => {
    for (const [env, marker] of [
      [{}, true],
      [{ SEED_ALLOW_RESET: "true" }, false],
    ] as const) {
      const { deps, db, steps } = fakeDeps(env, marker);

      await expect(reset(["--profile", "minimal"], deps)).rejects.toThrow("Refusing to reset");
      expect(deps.migrate).not.toHaveBeenCalled();
      expect(db.transaction).not.toHaveBeenCalled();
      expect(steps).not.toContain("truncate");
      expect(db.close).toHaveBeenCalled();
    }
  });
});

describe("the table list", () => {
  it("is every table in the API's contract", () => {
    expect(contractTables()).toEqual(
      Object.keys(contractJson.storage.namespaces.public.entries.table).sort(),
    );
    expect(contractTables()).toContain("_demo_marker");
  });

  it("truncates them all in one statement", () => {
    expect(truncateSql(["a", "b"])).toBe('TRUNCATE TABLE "a", "b" RESTART IDENTITY CASCADE');
    for (const table of contractTables()) {
      expect(truncateSql()).toContain(`"${table}"`);
    }
  });
});

describe("estimate", () => {
  it("keeps the demo profile under 100 MB", () => {
    const { counts, bytes } = estimate(generateDataset(PROFILES.demo));

    expect(counts["orders"]).toBe(6_000);
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThan(100 * MB);
  });
});

describe("migrateDatabase", () => {
  it("runs the API's Prisma migrate, with the connection string left in the environment", () => {
    const run = vi.fn();

    migrateDatabase(run as never);

    expect(run).toHaveBeenCalledWith(
      "pnpm",
      ["--filter", "@manasbal/api", "exec", "prisma", "db", "migrate"],
      { stdio: "inherit", shell: process.platform === "win32" },
    );
  });
});
