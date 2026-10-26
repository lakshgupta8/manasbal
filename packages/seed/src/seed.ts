import { parseArgs } from "node:util";
import type { createDb } from "./db.ts";
import { generatePeople, insertPeople } from "./people.ts";
import { getProfile } from "./profiles.ts";
import { generateCatalog, insertCatalog } from "./products.ts";
import { createRandom } from "./random.ts";

// Fills the database with one profile's data in a single transaction, then closes the client.
// Usage: pnpm --filter @manasbal/seed seed --profile minimal
export async function seed(args: string[], db: ReturnType<typeof createDb>): Promise<void> {
  try {
    const { values } = parseArgs({
      args,
      options: { profile: { type: "string", default: "minimal" } },
    });
    const profile = getProfile(values.profile);
    const faker = createRandom();
    const people = generatePeople(faker, profile);
    const catalog = generateCatalog(faker, profile, people.sellers);

    await db.transaction(async (tx) => {
      await insertPeople(tx.orm, people);
      await insertCatalog(tx.orm, catalog);
    });
    console.log(
      `Seeded "${values.profile}": ${people.customers.length} customers, ${people.sellers.length} sellers, ${people.addresses.length} addresses, ${catalog.products.length} products, ${catalog.variants.length} variants`,
    );
  } finally {
    await db.close();
  }
}
