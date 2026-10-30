// Prisma reads and writes timestamps as Temporal.Instant, which Node 24 doesn't have yet.
import "temporal-polyfill/global";
import { insertInBatches } from "./batches.ts";
import { generateCoupons } from "./coupons.ts";
import type { createDb } from "./db.ts";
import { generateOrders, insertOrders, type Orders } from "./orders.ts";
import { generatePeople, insertPeople, type People } from "./people.ts";
import { generateCatalog, insertCatalog, type Catalog } from "./products.ts";
import type { SeedProfile } from "./profiles.ts";
import { createRandom, REFERENCE_DATE } from "./random.ts";
import { generateSettlements, type SettlementRow } from "./settlements.ts";

// The orm of a client, or of a transaction.
type Orm = ReturnType<typeof createDb>["orm"];

// The row that marks a database as a demo one. The reset command refuses to run without it.
export interface MarkerRow {
  id: string;
  name: string;
  createdAt: Temporal.Instant;
}

export const MARKER_NAME = "manasbal-demo";

export interface Dataset {
  people: People;
  catalog: Catalog;
  orders: Orders;
  settlements: SettlementRow[];
  marker: MarkerRow;
}

// Everything one profile writes, made in memory from the fixed seed, so it is the same every run.
export function generateDataset(profile: SeedProfile): Dataset {
  const faker = createRandom();
  const people = generatePeople(faker, profile);
  const catalog = generateCatalog(faker, profile, people.sellers);
  const coupons = generateCoupons(faker);
  const orders = generateOrders(faker, profile, people, catalog, coupons);
  const settlements = generateSettlements(faker, orders);
  const marker = {
    id: faker.string.uuid(),
    name: MARKER_NAME,
    createdAt: Temporal.Instant.from(REFERENCE_DATE),
  };
  return { people, catalog, orders, settlements, marker };
}

// The rows of each table, by table name, for counting and sizing.
export function rowsByTable(data: Dataset): Record<string, readonly object[]> {
  const { people, catalog, orders } = data;
  return {
    users: [...people.customers, ...people.sellerUsers],
    sellers: people.sellers,
    addresses: people.addresses,
    categories: catalog.categories,
    products: catalog.products,
    variants: catalog.variants,
    inventory: catalog.inventory,
    coupons: orders.coupons,
    orders: orders.orders,
    sub_orders: orders.subOrders,
    order_items: orders.orderItems,
    payments: orders.payments,
    reviews: orders.reviews,
    settlements: data.settlements,
    _demo_marker: [data.marker],
  };
}

// In foreign-key order. The marker goes in last, so only a complete seed marks the database.
export async function insertDataset(orm: Orm, data: Dataset): Promise<void> {
  await insertPeople(orm, data.people);
  await insertCatalog(orm, data.catalog);
  await insertOrders(orm, data.orders);
  await insertInBatches(data.settlements, (batch) => orm.public.Settlement.createAndCount(batch));
  await orm.public.DemoMarker.createAndCount([data.marker]);
}
