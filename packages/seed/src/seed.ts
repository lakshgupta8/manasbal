import { parseArgs } from "node:util";
import { generateDataset, insertDataset } from "./dataset.ts";
import type { createDb } from "./db.ts";
import { getProfile } from "./profiles.ts";

// Fills the database with one profile's data in a single transaction, then closes the client.
// The last row written is the demo marker, which lets the reset command run on this database.
// Usage: pnpm --filter @manasbal/seed seed --profile minimal
export async function seed(args: string[], db: ReturnType<typeof createDb>): Promise<void> {
  try {
    const { values } = parseArgs({
      args,
      options: { profile: { type: "string", default: "minimal" } },
    });
    const data = generateDataset(getProfile(values.profile));
    const { people, catalog, orders } = data;

    await db.transaction((tx) => insertDataset(tx.orm, data));
    console.log(
      `Seeded "${values.profile}": ${people.customers.length} customers, ${people.sellers.length} sellers, ${people.addresses.length} addresses, ${catalog.products.length} products, ${catalog.variants.length} variants, ${orders.coupons.length} coupons, ${orders.orders.length} orders, ${orders.reviews.length} reviews, ${data.settlements.length} settlements`,
    );
  } finally {
    await db.close();
  }
}
