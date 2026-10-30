import type { createDb } from "./db.ts";

// The orm of a client, or of a transaction.
type Orm = ReturnType<typeof createDb>["orm"];

// A reset deletes every row in every table, so it needs both a flag set on purpose and a marker
// row that only the seed writes. The flag is checked first, so a missing flag never reaches the
// database.
export async function assertResetAllowed(
  env: NodeJS.ProcessEnv,
  hasMarker: () => Promise<boolean>,
): Promise<void> {
  if (env["SEED_ALLOW_RESET"] !== "true") {
    throw new Error(
      "Refusing to reset: set SEED_ALLOW_RESET=true to confirm this database may be wiped",
    );
  }
  if (!(await hasMarker())) {
    throw new Error(
      "Refusing to reset: this database has no _demo_marker row, so it may not be a demo database",
    );
  }
}

// Whether the marker row exists. A database the seed never touched has no marker table, so the
// read fails; that, like any other failure, counts as "no marker" and the reset refuses.
export async function hasMarker(orm: Orm): Promise<boolean> {
  try {
    return Boolean(await orm.public.DemoMarker.select("id").first());
  } catch {
    return false;
  }
}
