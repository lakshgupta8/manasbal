import type { Faker } from "@faker-js/faker";
// Prisma reads and writes timestamps as Temporal.Instant, which Node 24 doesn't have yet.
import "temporal-polyfill/global";
import categoryTree from "../data/categories.json" with { type: "json" };
import booksStationery from "../data/products/books-stationery.json" with { type: "json" };
import clothing from "../data/products/clothing.json" with { type: "json" };
import electronicsAccessories from "../data/products/electronics-accessories.json" with { type: "json" };
import footwear from "../data/products/footwear.json" with { type: "json" };
import homeKitchen from "../data/products/home-kitchen.json" with { type: "json" };
import sportsFitness from "../data/products/sports-fitness.json" with { type: "json" };
import variantRules from "../data/variants.json" with { type: "json" };
import { insertInBatches } from "./batches.ts";
import type { createDb } from "./db.ts";
import { assertAllowed } from "./guardrails.ts";
import { sellerShares, slugify, type SellerRow } from "./people.ts";
import type { SeedProfile } from "./profiles.ts";

// The orm of a client, or of a transaction.
type Orm = ReturnType<typeof createDb>["orm"];

export interface ReviewText {
  rating: number;
  body: string;
}

// One file in data/products: invented brands, and the texts of six or eight products per leaf
// category, written with agents and read by a person before they were committed.
interface TextFile {
  brands: string[];
  items: Record<string, { name: string; description: string; reviews: ReviewText[] }[]>;
}

export const TEXT_FILES: TextFile[] = [
  clothing,
  footwear,
  homeKitchen,
  electronicsAccessories,
  booksStationery,
  sportsFitness,
];

export interface CategoryNode {
  name: string;
  slug: string;
  children: CategoryNode[];
}

export interface CategoryRow {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
}

// No sample flag on categories: the column doesn't exist, and the allow-list is the same on every
// database anyway.
export interface ProductRow {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  isSample: true;
  createdAt: Temporal.Instant;
}

export interface VariantRow {
  id: string;
  productId: string;
  sku: string;
  size: string | null;
  colour: string | null;
  pricePaise: number;
  isSample: true;
}

export interface InventoryRow {
  id: string;
  variantId: string;
  location: string;
  quantity: number;
  reserved: number;
  isSample: true;
}

export interface Catalog {
  categories: CategoryRow[];
  products: ProductRow[];
  variants: VariantRow[];
  inventory: InventoryRow[];
  // The two sample reviews written for each product, by product id: used when reviews are seeded.
  reviewTexts: Record<string, ReviewText[]>;
}

interface Item {
  leaf: string;
  brands: string[];
  name: string;
  description: string;
  reviews: ReviewText[];
}

interface VariantRule {
  sizes: string[] | null;
  colours: boolean;
  rupees: number[];
}

const RULES: Record<string, VariantRule> = variantRules.leaves;
const STOCK_LOCATION = "main";
const MAX_VARIANTS = 3;
// About 5% of variants are out of stock and about 10% are low.
const OUT_OF_STOCK_SHARE = 0.05;
const LOW_STOCK_SHARE = 0.15;

// Every text of every product item, checked against the guardrail words.
export function loadItems(files: TextFile[] = TEXT_FILES): Item[] {
  return files.flatMap(({ brands, items }) =>
    Object.entries(items).flatMap(([leaf, entries]) =>
      entries.map((entry) => {
        for (const text of [entry.name, entry.description, ...entry.reviews.map((r) => r.body)]) {
          assertAllowed(text, `${leaf} / ${entry.name}`);
        }
        return { leaf, brands, ...entry };
      }),
    ),
  );
}

// Parents come before their children, so each row's parent already has an id.
function flattenCategories(
  faker: Faker,
  nodes: CategoryNode[],
  parentId: string | null = null,
): CategoryRow[] {
  return nodes.flatMap((node) => {
    const row = { id: faker.string.uuid(), parentId, name: node.name, slug: node.slug };
    return [row, ...flattenCategories(faker, node.children, row.id)];
  });
}

// A price in whole paise whose rupees end in 9, inside the category's range.
function makePrice(faker: Faker, [min, max]: number[]): number {
  const rupees = faker.number.int({ min: min!, max: max! });
  return (Math.round((rupees + 1) / 10) * 10 - 1) * 100;
}

function makeStock(faker: Faker): number {
  const roll = faker.number.float();
  if (roll < OUT_OF_STOCK_SHARE) return 0;
  if (roll < LOW_STOCK_SHARE) return faker.number.int({ min: 1, max: 5 });
  return faker.number.int({ min: 20, max: 200 });
}

// Up to three size and colour combinations of one product.
function pickOptions(
  faker: Faker,
  rule: VariantRule,
): { size: string | null; colour: string | null }[] {
  const sizes = rule.sizes ?? [null];
  const colours = rule.colours ? variantRules.colours : [null];
  const combinations = sizes.flatMap((size) => colours.map((colour) => ({ size, colour })));
  const count = faker.number.int({ min: 1, max: Math.min(MAX_VARIANTS, combinations.length) });
  return faker.helpers.arrayElements(combinations, count);
}

// Products spread over the leaf categories and the sellers (the first seller is the big one), each
// with one to three variants and a stock row per variant. A product is an invented brand in front
// of one written item, so the same item comes back with a different brand.
export function generateCatalog(
  faker: Faker,
  profile: SeedProfile,
  sellers: SellerRow[],
  files: TextFile[] = TEXT_FILES,
): Catalog {
  const categories = flattenCategories(faker, categoryTree);
  const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));
  const items = faker.helpers.shuffle(loadItems(files));
  const shares = sellerShares(sellers.length);
  const weightedSellers = sellers.map((value, i) => ({ value, weight: shares[i]! }));
  const slugs = new Set<string>();
  const catalog: Catalog = {
    categories,
    products: [],
    variants: [],
    inventory: [],
    reviewTexts: {},
  };

  for (let i = 0; i < profile.products; i++) {
    const index = i % items.length;
    const item = items[index]!;
    // Each round through the items moves every item on to its next brand.
    const brand = item.brands[(Math.floor(i / items.length) + index) % item.brands.length]!;
    const name = `${brand} ${item.name}`;
    const product: ProductRow = {
      id: faker.string.uuid(),
      sellerId: faker.helpers.weightedArrayElement(weightedSellers).id,
      categoryId: categoryIds.get(item.leaf)!,
      name,
      slug: uniqueSlug(slugs, name),
      description: item.description,
      isSample: true,
      createdAt: Temporal.Instant.fromEpochMilliseconds(faker.date.past({ years: 1 }).getTime()),
    };
    catalog.products.push(product);
    catalog.reviewTexts[product.id] = item.reviews;

    const rule = RULES[item.leaf]!;
    const pricePaise = makePrice(faker, rule.rupees);
    pickOptions(faker, rule).forEach((option, v) => {
      const variant: VariantRow = {
        id: faker.string.uuid(),
        productId: product.id,
        sku: `SKU-${String(i + 1).padStart(5, "0")}-${v + 1}`,
        ...option,
        pricePaise,
        isSample: true,
      };
      catalog.variants.push(variant);
      catalog.inventory.push({
        id: faker.string.uuid(),
        variantId: variant.id,
        location: STOCK_LOCATION,
        quantity: makeStock(faker),
        reserved: 0,
        isSample: true,
      });
    });
  }
  return catalog;
}

// The slug of the name, with a number added when a product with the same name came before.
function uniqueSlug(taken: Set<string>, name: string): string {
  const base = slugify(name);
  let slug = base;
  for (let n = 2; taken.has(slug); n++) {
    slug = `${base}-${n}`;
  }
  taken.add(slug);
  return slug;
}

// Categories first, then products, then the variants and stock that point at them.
export async function insertCatalog(orm: Orm, catalog: Catalog): Promise<void> {
  const db = orm.public;
  await insertInBatches(catalog.categories, (batch) => db.Category.createAndCount(batch));
  await insertInBatches(catalog.products, (batch) => db.Product.createAndCount(batch));
  await insertInBatches(catalog.variants, (batch) => db.Variant.createAndCount(batch));
  await insertInBatches(catalog.inventory, (batch) => db.Inventory.createAndCount(batch));
}
