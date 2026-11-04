import type { Faker } from "@faker-js/faker";
import { hash } from "@node-rs/argon2";
import { slugify, type Role } from "@manasbal/types";
// Prisma reads and writes timestamps as Temporal.Instant, which Node 24 doesn't have yet.
import "temporal-polyfill/global";
import { ARGON2_OPTIONS } from "../../../apps/api/src/auth/argon2-options.ts";
import places from "../data/places.json" with { type: "json" };
import storeNames from "../data/store-names.json" with { type: "json" };
import { insertInBatches } from "./batches.ts";
import { DEMO_EMAILS, DEMO_PASSWORD, DEMO_STAFF } from "./demo-logins.ts";
import type { createDb } from "./db.ts";
import type { SeedProfile } from "./profiles.ts";
import { REFERENCE_DATE } from "./random.ts";

// The orm of a client, or of a transaction.
type Orm = ReturnType<typeof createDb>["orm"];

export interface UserRow {
  id: string;
  email: string;
  // Empty, so no one can sign in, except for the demo logins: they get a real argon2id hash of
  // DEMO_PASSWORD when they are written (see insertPeople).
  passwordHash: string;
  name: string;
  role: Role;
  isSample: true;
  createdAt: Temporal.Instant;
  // Set only on the demo logins, so they can sign in while mail is on.
  emailVerifiedAt: Temporal.Instant | null;
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
  // The demo logins for the roles above seller: seller staff, support and admin.
  staff: UserRow[];
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
    emailVerifiedAt: null,
  };
}

// Turns a generated user into the demo login of its role: the same person, orders and store,
// with the role's public email, confirmed so it can sign in.
function asDemoLogin(user: UserRow): UserRow {
  return { ...user, email: DEMO_EMAILS[user.role], emailVerifiedAt: user.createdAt };
}

// The demo logins for the roles no generated person has.
function demoStaff(): UserRow[] {
  const createdAt = Temporal.Instant.from(REFERENCE_DATE);
  return DEMO_STAFF.map(({ id, role, name }) => ({
    id,
    email: DEMO_EMAILS[role],
    passwordHash: "",
    name,
    role,
    isSample: true,
    createdAt,
    emailVerifiedAt: createdAt,
  }));
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

// Customers with one or two addresses each, and the sellers with their own user accounts. The
// first customer and the first (biggest) seller are the demo customer and seller logins, so those
// logins come with orders, addresses and a full store.
export function generatePeople(faker: Faker, profile: SeedProfile): People {
  const customers = Array.from({ length: profile.customers }, (_, i) =>
    makeUser(faker, "customer", i + 1),
  );
  customers[0] = asDemoLogin(customers[0]!);
  const addresses = customers.flatMap((customer) =>
    Array.from({ length: faker.number.int({ min: 1, max: 2 }) }, (_, i) =>
      makeAddress(faker, customer, i === 0),
    ),
  );
  const sellerUsers = Array.from({ length: profile.sellers }, (_, i) =>
    makeUser(faker, "seller", profile.customers + i + 1),
  );
  sellerUsers[0] = asDemoLogin(sellerUsers[0]!);
  const sellers = storeNamesFor(faker, profile.sellers).map((storeName, i): SellerRow => ({
    id: faker.string.uuid(),
    userId: sellerUsers[i]!.id,
    storeName,
    slug: slugify(storeName),
    status: "approved",
    isSample: true,
  }));
  return { customers, sellerUsers, staff: demoStaff(), sellers, addresses };
}

// The share of products each seller gets, largest first: the first seller is the big one and the
// rest form a long tail (seller n gets 1/n of the first one's share). The shares add up to 1.
export function sellerShares(count: number): number[] {
  const weights = Array.from({ length: count }, (_, i) => 1 / (i + 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => weight / total);
}

// Every user of the dataset, demo logins included.
export function allUsers(people: People): UserRow[] {
  return [...people.customers, ...people.sellerUsers, ...people.staff];
}

// Hashes DEMO_PASSWORD for each demo login with the API's sign-up settings, so the API's verify
// accepts it. Argon2 picks a random salt, so the hash differs on every run (the determinism
// check skips this column). Every other user keeps its empty hash.
export async function withDemoPasswords(users: UserRow[]): Promise<UserRow[]> {
  const demoEmails = new Set(Object.values(DEMO_EMAILS));
  return Promise.all(
    users.map(async (user) =>
      demoEmails.has(user.email)
        ? { ...user, passwordHash: await hash(DEMO_PASSWORD, ARGON2_OPTIONS) }
        : user,
    ),
  );
}

// Users first, because sellers and addresses point at them.
export async function insertPeople(orm: Orm, people: People): Promise<void> {
  const db = orm.public;
  const users = await withDemoPasswords(allUsers(people));
  await insertInBatches(users, (batch) => db.User.createAndCount(batch));
  await insertInBatches(people.sellers, (batch) => db.Seller.createAndCount(batch));
  await insertInBatches(people.addresses, (batch) => db.Address.createAndCount(batch));
}
