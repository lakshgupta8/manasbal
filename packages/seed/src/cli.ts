import { createDb } from "./db.ts";
import { seed } from "./seed.ts";

await seed(process.argv.slice(2), createDb());
