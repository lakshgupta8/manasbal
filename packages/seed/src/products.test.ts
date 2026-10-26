import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import categories from "../data/categories.json" with { type: "json" };
import variantRules from "../data/variants.json" with { type: "json" };
import { assertAllowed } from "./guardrails.ts";
import { generatePeople } from "./people.ts";
import { PROFILES } from "./profiles.ts";
import {
  generateCatalog,
  insertCatalog,
  loadItems,
  TEXT_FILES,
  type CategoryNode,
} from "./products.ts";
import { createRandom } from "./random.ts";

function leaves(nodes: CategoryNode[]): string[] {
  return nodes.flatMap((node) => (node.children.length ? leaves(node.children) : [node.slug]));
}

function demoCatalog() {
  const faker = createRandom();
  const people = generatePeople(faker, PROFILES.demo);
  return { people, catalog: generateCatalog(faker, PROFILES.demo, people.sellers) };
}

const { people, catalog } = demoCatalog();

describe("the product text files", () => {
  const dir = new URL("../data/products/", import.meta.url);

  it("passes the guardrail words in every text, brands included", () => {
    for (const file of readdirSync(dir)) {
      const { brands, items } = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
      for (const brand of brands) assertAllowed(brand, `${file} brand`);
      for (const [leaf, entries] of Object.entries<any[]>(items)) {
        for (const { name, description, reviews } of entries) {
          for (const text of [name, description, ...reviews.map((r: any) => r.body)]) {
            expect(() => assertAllowed(text, `${file} ${leaf}`)).not.toThrow();
          }
        }
      }
    }
  });

  it("covers every leaf category, with two reviews and two sentences per item", () => {
    const items = loadItems();

    expect(new Set(items.map((item) => item.leaf))).toEqual(new Set(leaves(categories)));
    expect(Object.keys(variantRules.leaves).sort()).toEqual(leaves(categories).sort());
    for (const item of items) {
      expect(item.brands.length).toBeGreaterThanOrEqual(8);
      expect(item.reviews).toHaveLength(2);
      expect(item.description.match(/[.!?](\s|$)/g)).toHaveLength(2);
      expect(item.reviews.every((r) => r.rating >= 1 && r.rating <= 5)).toBe(true);
    }
  });

  it("mostly has reviews of 4 or 5 stars", () => {
    const ratings = loadItems().flatMap((item) => item.reviews.map((r) => r.rating));

    expect(ratings.filter((rating) => rating >= 4).length / ratings.length).toBeGreaterThan(0.8);
  });

  it("refuses a text with a forbidden word", () => {
    const bad = structuredClone(TEXT_FILES[0]!);
    const first = Object.values(bad.items)[0]![0]!;
    first.description = "A guaranteed fit. Soft cotton.";

    expect(() => loadItems([bad])).toThrow('"guaranteed"');
  });
});

describe("generateCatalog", () => {
  it("makes about 1,200 products for the demo profile", () => {
    expect(catalog.products).toHaveLength(1_200);
    expect(catalog.variants.length).toBeGreaterThanOrEqual(1_200);
    expect(catalog.inventory).toHaveLength(catalog.variants.length);
  });

  it("adds the whole allow-list, parents before children", () => {
    const seen = new Set<string>();
    for (const category of catalog.categories) {
      expect(category.parentId === null || seen.has(category.parentId)).toBe(true);
      seen.add(category.id);
    }
    expect(catalog.categories.length).toBeGreaterThanOrEqual(55);
  });

  it("puts every product in a leaf category, with a seller, a unique slug and a brand name", () => {
    const leafIds = new Set(
      catalog.categories
        .filter((c) => !catalog.categories.some((other) => other.parentId === c.id))
        .map((c) => c.id),
    );
    const sellerIds = new Set(people.sellers.map((seller) => seller.id));

    expect(new Set(catalog.products.map((p) => p.slug)).size).toBe(1_200);
    for (const product of catalog.products) {
      expect(leafIds.has(product.categoryId)).toBe(true);
      expect(sellerIds.has(product.sellerId)).toBe(true);
      expect(product.name.split(" ").length).toBeGreaterThanOrEqual(2);
      expect(() => assertAllowed(`${product.name} ${product.description}`)).not.toThrow();
    }
  });

  it("gives the first seller the biggest share", () => {
    const counts = new Map<string, number>();
    for (const { sellerId } of catalog.products) {
      counts.set(sellerId, (counts.get(sellerId) ?? 0) + 1);
    }

    expect(Math.max(...counts.values())).toBe(counts.get(people.sellers[0]!.id));
  });

  it("prices in whole paise ending in 9 rupees, with 1 to 3 variants each", () => {
    for (const variant of catalog.variants) {
      expect(Number.isInteger(variant.pricePaise)).toBe(true);
      expect((variant.pricePaise / 100) % 10).toBe(9);
    }
    const perProduct = new Map<string, number>();
    for (const { productId } of catalog.variants) {
      perProduct.set(productId, (perProduct.get(productId) ?? 0) + 1);
    }
    expect(perProduct.size).toBe(1_200);
    expect(Math.max(...perProduct.values())).toBeLessThanOrEqual(3);
    expect(new Set(catalog.variants.map((v) => v.sku)).size).toBe(catalog.variants.length);
  });

  it("makes about 5% of variants out of stock and about 10% low", () => {
    const total = catalog.inventory.length;
    const out = catalog.inventory.filter((row) => row.quantity === 0).length;
    const low = catalog.inventory.filter((row) => row.quantity > 0 && row.quantity <= 5).length;

    expect(out / total).toBeGreaterThan(0.02);
    expect(out / total).toBeLessThan(0.09);
    expect(low / total).toBeGreaterThan(0.06);
    expect(low / total).toBeLessThan(0.14);
  });

  it("flags everything it makes as sample data and keeps the review texts", () => {
    const rows = [...catalog.products, ...catalog.variants, ...catalog.inventory];

    expect(rows.every((row) => row.isSample)).toBe(true);
    expect(Object.keys(catalog.reviewTexts)).toHaveLength(1_200);
  });

  it("makes the same catalog from the same seed", () => {
    expect(demoCatalog().catalog).toEqual(catalog);
  });

  it("numbers the slug of a repeated name, once the brands run out", () => {
    const faker = createRandom();
    const crowd = { ...PROFILES.minimal, products: loadItems().length * 9 };
    const big = generateCatalog(faker, crowd, generatePeople(faker, crowd).sellers);

    expect(new Set(big.products.map((p) => p.slug)).size).toBe(crowd.products);
    expect(big.products.some((p) => /-2$/.test(p.slug))).toBe(true);
  });
});

describe("insertCatalog", () => {
  it("inserts categories, products, variants and stock in that order, in batches of 500", async () => {
    const calls: [string, number][] = [];
    const table = (name: string) => ({
      createAndCount: vi.fn(async (batch: unknown[]) => {
        calls.push([name, batch.length]);
        return batch.length;
      }),
    });
    const orm = {
      public: {
        Category: table("Category"),
        Product: table("Product"),
        Variant: table("Variant"),
        Inventory: table("Inventory"),
      },
    };

    await insertCatalog(orm as unknown as Parameters<typeof insertCatalog>[0], catalog);

    const order = calls.map(([name]) => name);
    expect(calls.every(([, size]) => size <= 500)).toBe(true);
    expect(order.indexOf("Product")).toBeGreaterThan(order.lastIndexOf("Category"));
    expect(order.indexOf("Variant")).toBeGreaterThan(order.lastIndexOf("Product"));
    expect(order.indexOf("Inventory")).toBeGreaterThan(order.lastIndexOf("Variant"));
    expect(calls.filter(([name]) => name === "Product").reduce((n, [, s]) => n + s, 0)).toBe(1_200);
  });
});
