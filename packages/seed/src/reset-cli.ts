import { createDb } from "./db.ts";
import { migrateDatabase, reset } from "./reset.ts";

await reset(process.argv.slice(2), {
  env: process.env,
  connect: () => createDb(),
  migrate: () => migrateDatabase(),
});
