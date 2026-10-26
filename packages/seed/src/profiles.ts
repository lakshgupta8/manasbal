export interface SeedProfile {
  customers: number;
  sellers: number;
  products: number;
  orders: number;
  // Too big for the free database: only ever seeded into a local one.
  localOnly: boolean;
}

const demo: SeedProfile = {
  customers: 300,
  sellers: 30,
  products: 1_200,
  orders: 6_000,
  localOnly: false,
};

export const PROFILES = {
  // Small enough for every test run.
  minimal: { customers: 3, sellers: 2, products: 10, orders: 5, localOnly: false },
  // What the live site shows.
  demo,
  // Ten times demo, for load tests on a local database.
  load: {
    customers: demo.customers * 10,
    sellers: demo.sellers * 10,
    products: demo.products * 10,
    orders: demo.orders * 10,
    localOnly: true,
  },
} satisfies Record<string, SeedProfile>;

export type ProfileName = keyof typeof PROFILES;

export function getProfile(name: string): SeedProfile {
  if (!Object.hasOwn(PROFILES, name)) {
    throw new Error(`Unknown seed profile "${name}": use ${Object.keys(PROFILES).join(", ")}`);
  }
  return PROFILES[name as ProfileName];
}
