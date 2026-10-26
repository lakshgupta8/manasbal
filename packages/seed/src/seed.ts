import { parseArgs } from "node:util";
import type { createDb } from "./db.ts";
import { generatePeople, insertPeople } from "./people.ts";
import { getProfile } from "./profiles.ts";
import { createRandom } from "./random.ts";

// Fills the database with one profile's data in a single transaction, then closes the client.
// Usage: pnpm --filter @manasbal/seed seed --profile minimal
export async function seed(args: string[], db: ReturnType<typeof createDb>): Promise<void> {
  try {
    const { values } = parseArgs({
      args,
      options: { profile: { type: "string", default: "minimal" } },
    });
    const people = generatePeople(createRandom(), getProfile(values.profile));

    await db.transaction((tx) => insertPeople(tx.orm, people));
    console.log(
      `Seeded "${values.profile}": ${people.customers.length} customers, ${people.sellers.length} sellers, ${people.addresses.length} addresses`,
    );
  } finally {
    await db.close();
  }
}
