import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { productPageSchema, type ProductPage } from "@manasbal/types";
import { CatalogModule } from "../src/catalog/catalog.module.js";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

// Needs Docker: a throwaway Postgres with the migrations applied.
describe("GET /products (e2e)", () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;
  // Product ids by category slug, and the lowest variant price of each priced product.
  const idsByCategory = new Map<string, string[]>();
  const cheapest = new Map<string, number>();

  async function get(url: string): Promise<ProductPage> {
    const response = await app.inject({ method: "GET", url });
    expect(response.statusCode).toBe(200);
    const page = response.json<ProductPage>();
    expect(productPageSchema.safeParse(page).success).toBe(true);
    return page;
  }

  beforeAll(async () => {
    database = await startTestDatabase();
    const orm = database.db.orm.public;

    const user = await orm.User.select("id").create({
      email: "seller@example.test",
      // This user never signs in.
      passwordHash: "",
      name: "Test Seller",
    });
    const seller = await orm.Seller.select("id").create({
      userId: user.id,
      storeName: "Test Store",
      slug: "test-store",
    });
    const shirts = await orm.Category.select("id").create({ name: "Shirts", slug: "shirts" });
    const shoes = await orm.Category.select("id").create({ name: "Shoes", slug: "shoes" });

    // 25 products, alternating between the two categories (13 shirts, 12 shoes). Every third
    // one has two variants, so its price is the cheaper of the two.
    for (let n = 1; n <= 25; n++) {
      const category = n % 2 === 1 ? "shirts" : "shoes";
      const product = await orm.Product.select("id").create({
        sellerId: seller.id,
        categoryId: category === "shirts" ? shirts.id : shoes.id,
        name: `Product ${n}`,
        slug: `product-${n}`,
      });
      idsByCategory.set(category, [...(idsByCategory.get(category) ?? []), product.id]);
      if (n % 3 === 0) {
        const low = n * 1000;
        await orm.Variant.select("id").create({
          productId: product.id,
          sku: `SKU-${n}-A`,
          pricePaise: low + 500,
        });
        await orm.Variant.select("id").create({
          productId: product.id,
          sku: `SKU-${n}-B`,
          pricePaise: low,
        });
        cheapest.set(product.id, low);
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [CatalogModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await database.stop();
  });

  it("pages through every product, 20 at a time", async () => {
    const first = await get("/products");
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();

    const second = await get(`/products?cursor=${first.nextCursor}`);
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();

    const ids = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(25);
  });

  it("answers each product's cheapest variant price, or null without variants", async () => {
    const all = await get("/products?limit=100");

    for (const item of all.items) {
      expect(item.pricePaise).toBe(cheapest.get(item.id) ?? null);
    }
  });

  it("keeps only the products of the given category", async () => {
    const page = await get("/products?category=shoes");

    expect(page.items.map((item) => item.id).sort()).toEqual(
      [...(idsByCategory.get("shoes") ?? [])].sort(),
    );
    expect(page.items.every((item) => item.category.slug === "shoes")).toBe(true);
    expect(page.items.every((item) => item.category.name === "Shoes")).toBe(true);
  });

  it("answers an empty page for an unknown category", async () => {
    const page = await get("/products?category=no-such-category");

    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it("refuses a made-up cursor with 400", async () => {
    const madeUp = Buffer.from("not-a-product", "utf8").toString("base64url");

    const response = await app.inject({ method: "GET", url: `/products?cursor=${madeUp}` });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ detail: string }>().detail).toBe("cursor is not valid");
  });
});
