import { describe, expect, it } from "vitest";
import categories from "../data/categories.json" with { type: "json" };
import { FORBIDDEN_WORDS, assertAllowed } from "./guardrails.ts";

interface Category {
  name: string;
  slug: string;
  children: Category[];
}

function flatten(nodes: Category[], depth = 1): (Category & { depth: number })[] {
  return nodes.flatMap((node) => [{ ...node, depth }, ...flatten(node.children, depth + 1)]);
}

const all = flatten(categories);

describe("category allow-list", () => {
  it("has about 60 categories, three levels deep", () => {
    expect(all.length).toBeGreaterThanOrEqual(55);
    expect(all.length).toBeLessThanOrEqual(65);
    expect(Math.max(...all.map((category) => category.depth))).toBe(3);
    expect(all.filter((c) => c.depth === 3).every((c) => c.children.length === 0)).toBe(true);
  });

  it("gives every category its own slug", () => {
    expect(new Set(all.map((category) => category.slug)).size).toBe(all.length);
  });

  it("passes the guardrails", () => {
    for (const { name, slug } of all) {
      expect(() => assertAllowed(name, slug)).not.toThrow();
      expect(() => assertAllowed(slug, slug)).not.toThrow();
    }
  });
});

describe("assertAllowed", () => {
  it("fails on a forbidden word, in any form or case", () => {
    expect(() => assertAllowed("This oil cures hair fall", "product 7")).toThrow(
      'product 7 contains the forbidden word "cure"',
    );
    expect(() => assertAllowed("Results GUARANTEED")).toThrow('"guaranteed"');
    expect(() => assertAllowed("Refills for e cigarettes")).toThrow('"e-cigarette"');
  });

  it("fails on every forbidden word", () => {
    for (const word of FORBIDDEN_WORDS) {
      expect(() => assertAllowed(`A ${word} for sale`)).toThrow(`"${word}"`);
    }
  });

  it("passes words that only contain a forbidden one", () => {
    expect(() => assertAllowed("A secure lock for a manicure kit")).not.toThrow();
  });
});
