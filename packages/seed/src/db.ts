import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../../../apps/api/src/prisma/contract.js";
import contractJson from "../../../apps/api/src/prisma/contract.json" with { type: "json" };

// The API's own contract, so the seed writes exactly the tables the API reads.
export function createDb(url = process.env["DATABASE_URL"]) {
  if (!url) {
    throw new Error("DATABASE_URL is not set: point it at the database to seed");
  }
  return postgres<Contract>({ contractJson, url });
}
