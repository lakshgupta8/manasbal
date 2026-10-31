import { Faker, base, en, en_IN } from "@faker-js/faker";

// The same seed and the same "today" on every run, so the seed always writes identical data.
const SEED = 20261109;
export const REFERENCE_DATE = "2026-11-09T00:00:00.000Z";

// Indian names and places first, falling back to English for anything en_IN doesn't define.
export function createRandom(): Faker {
  const faker = new Faker({ locale: [en_IN, en, base] });
  faker.seed(SEED);
  faker.setDefaultRefDate(REFERENCE_DATE);
  return faker;
}
