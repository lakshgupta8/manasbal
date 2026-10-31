import { describe, expect, it } from "vitest";
import { createRandom } from "./random.ts";

function firstNames(count: number): string[] {
  const faker = createRandom();
  return Array.from({ length: count }, () => faker.person.fullName());
}

describe("createRandom", () => {
  it("makes the same first 10 names on every run", () => {
    const first = firstNames(10);

    expect(firstNames(10)).toEqual(first);
    expect(new Set(first).size).toBeGreaterThan(1);
  });

  it("makes the same dates on every run, whatever today is", () => {
    expect(createRandom().date.recent().toISOString()).toBe(
      createRandom().date.recent().toISOString(),
    );
  });
});
