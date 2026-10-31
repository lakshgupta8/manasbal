import type { Faker } from "@faker-js/faker";
// Prisma reads and writes timestamps as Temporal.Instant, which Node 24 doesn't have yet.
import "temporal-polyfill/global";
import places from "../data/places.json" with { type: "json" };
import storeNames from "../data/store-names.json" with { type: "json" };
import { insertInBatches } from "./batches.ts";
import type { createDb } from "./db.ts";
import type { SeedProfile } from "./profiles.ts";

// The orm of a client, or of a transaction.
type Orm = ReturnType<typeof createDb>["orm"];

export interface UserRow {
  id: string;
  email: string;
  // Empty until sign-in exists (Week 5); the demo logins get real hashes in Week 6.
  passwordHash: string;
  name: string;
  role: "buyer" | "seller";
  isSample: true;
  createdAt: Temporal.Instant;
}

export interface SellerRow {
  id: string;
  userId: string;
  storeName: string;
  slug: string;
  status: "approved";
  isSample: true;
}

// No phone number: the column was dropped, so the app holds none.
export interface AddressRow {
  id: string;
  userId: string;
  name: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  isSample: true;
}

export interface People {
  customers: UserRow[];
  sellerUsers: UserRow[];
  sellers: SellerRow[];
  addresses: AddressRow[];
}

const STREETS = [
  "Main Road",
  "Station Road",
  "Market Road",
  "Temple Street",
  "Lake View Road",
  "Park Avenue",
  "Church Lane",
  "Hill Road",
  "Canal Road",
  "Garden Street",
];

// Reserved for documentation, so a seeded email can never reach anyone.
const EMAIL_DOMAIN = "example.com";

// Lower case, with anything but letters and digits turned into single hyphens.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
}

function makeUser(faker: Faker, role: UserRow["role"], number: number): UserRow {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  return {
    id: faker.string.uuid(),
    // The number keeps two people with the same name apart.
    email: `${slugify(firstName)}.${slugify(lastName)}.${number}@${EMAIL_DOMAIN}`,
    passwordHash: "",
    name: `${firstName} ${lastName}`,
    role,
    isSample: true,
    createdAt: Temporal.Instant.fromEpochMilliseconds(faker.date.past({ years: 2 }).getTime()),
  };
}

function makeAddress(faker: Faker, user: UserRow, isDefault: boolean): AddressRow {
  const place = faker.helpers.arrayElement(places);
  const prefix = faker.helpers.arrayElement(place.pincodePrefixes);
  return {
    id: faker.string.uuid(),
    userId: user.id,
    name: user.name,
    line1: `${faker.number.int({ min: 1, max: 299 })}, ${faker.helpers.arrayElement(STREETS)}`,
    city: faker.helpers.arrayElement(place.cities),
    state: place.state,
    // A real area prefix and three made-up digits: it looks right but points at no one.
    pincode: `${prefix}${faker.string.numeric(3)}`,
    isDefault,
    isSample: true,
  };
}

// Every combination of the two word lists, shuffled, so each store gets its own invented name.
function storeNamesFor(faker: Faker, count: number): string[] {
  const all = storeNames.first.flatMap((first) =>
    storeNames.second.map((second) => `${first} ${second}`),
  );
  if (count > all.length) {
    throw new Error(`Only ${all.length} store names exist, but ${count} sellers were asked for`);
  }
  return faker.helpers.shuffle(all).slice(0, count);
}

// Customers with one or two addresses each, and the sellers with their own user accounts.
export function generatePeople(faker: Faker, profile: SeedProfile): People {
  const customers = Array.from({ length: profile.customers }, (_, i) =>
    makeUser(faker, "buyer", i + 1),
  );
  const addresses = customers.flatMap((customer) =>
    Array.from({ length: faker.number.int({ min: 1, max: 2 }) }, (_, i) =>
      makeAddress(faker, customer, i === 0),
    ),
  );
  const sellerUsers = Array.from({ length: profile.sellers }, (_, i) =>
    makeUser(faker, "seller", profile.customers + i + 1),
  );
  const sellers = storeNamesFor(faker, profile.sellers).map((storeName, i): SellerRow => ({
    id: faker.string.uuid(),
    userId: sellerUsers[i]!.id,
    storeName,
    slug: slugify(storeName),
    status: "approved",
    isSample: true,
  }));
  return { customers, sellerUsers, sellers, addresses };
}

// The share of products each seller gets, largest first: the first seller is the big one and the
// rest form a long tail (seller n gets 1/n of the first one's share). The shares add up to 1.
export function sellerShares(count: number): number[] {
  const weights = Array.from({ length: count }, (_, i) => 1 / (i + 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => weight / total);
}

// Users first, because sellers and addresses point at them.
export async function insertPeople(orm: Orm, people: People): Promise<void> {
  const db = orm.public;
  await insertInBatches([...people.customers, ...people.sellerUsers], (batch) =>
    db.User.createAndCount(batch),
  );
  await insertInBatches(people.sellers, (batch) => db.Seller.createAndCount(batch));
  await insertInBatches(people.addresses, (batch) => db.Address.createAndCount(batch));
}
