import "dotenv/config";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "./contract.js";
import contractJson from "./contract.json" with { type: "json" };

let client: ReturnType<typeof createClient> | undefined;

function createClient() {
  return postgres<Contract>({ contractJson, url: process.env["DATABASE_URL"]! });
}

// The client is created on first use, so importing this file never reads DATABASE_URL. A test
// can set the variable (for example to a throwaway database) before the first call.
export function getDb() {
  client ??= createClient();
  return client;
}

// Drops the cached client so the next getDb() reads DATABASE_URL again.
export function resetDb(): void {
  client = undefined;
}
