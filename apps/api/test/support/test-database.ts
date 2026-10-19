import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { getDb, resetDb } from "../../src/prisma/db.js";

const run = promisify(execFile);

export interface TestDatabase {
  url: string;
  db: ReturnType<typeof getDb>;
  /** Runs one SQL statement with psql inside the container and returns its raw output. */
  sql(statement: string): Promise<string>;
  stop(): Promise<void>;
}

// Starts a throwaway Postgres, applies the committed migrations to it and points the Prisma
// client at it. Needs Docker. Call stop() in afterAll: it restores DATABASE_URL and removes
// the container.
export async function startTestDatabase(): Promise<TestDatabase> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    "postgres:17-alpine",
  ).start();
  const url = container.getConnectionUri();

  const previousUrl = process.env["DATABASE_URL"];
  try {
    await run("pnpm", ["exec", "prisma", "db", "migrate", "--db", url], {
      cwd: process.cwd(),
      shell: process.platform === "win32",
      env: { ...process.env, DATABASE_URL: url },
    });
  } catch (error) {
    await container.stop();
    throw error;
  }

  // db.ts creates its client on first use, so setting the variable now is early enough.
  process.env["DATABASE_URL"] = url;
  resetDb();

  return {
    url,
    db: getDb(),
    async sql(statement) {
      const result = await container.exec([
        "psql",
        "-U",
        container.getUsername(),
        "-d",
        container.getDatabase(),
        "-tA",
        "-c",
        statement,
      ]);
      if (result.exitCode !== 0) throw new Error(result.output);
      return result.output.trim();
    },
    async stop() {
      resetDb();
      if (previousUrl === undefined) delete process.env["DATABASE_URL"];
      else process.env["DATABASE_URL"] = previousUrl;
      await container.stop();
    },
  };
}
