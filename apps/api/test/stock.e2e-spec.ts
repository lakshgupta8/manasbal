import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { productStockSchema, type ProductStock } from "@manasbal/types";
import { CatalogModule } from "../src/catalog/catalog.module.js";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

// Needs Docker: a throwaway Postgres with the migrations applied.
describe("GET /products/:id/stock (e2e)", () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;
  let stocked: string;
  let bare: string;
  let oversold: string;

  function get(url: string) {
    return app.inject({ method: "GET", url });
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
    const category = await orm.Category.select("id").create({ name: "Shirts", slug: "shirts" });

    async function product(slug: string): Promise<string> {
      const created = await orm.Product.select("id").create({
        sellerId: seller.id,
        categoryId: category.id,
        name: slug,
        slug,
      });
      return created.id;
    }
    async function variant(productId: string, sku: string, size: string): Promise<string> {
      const created = await orm.Variant.select("id").create({
        productId,
        sku,
        size,
        colour: "Red",
        pricePaise: 49900,
      });
      return created.id;
    }
    async function inventory(
      variantId: string,
      location: string,
      quantity: number,
      reserved: number,
    ) {
      await orm.Inventory.select("id").create({ variantId, location, quantity, reserved });
    }

    stocked = await product("stocked");
    const medium = await variant(stocked, "TSHIRT-RED-M", "M");
    // 5 - 1 in one place and 4 - 1 in another: 7 can be bought.
    await inventory(medium, "north", 5, 1);
    await inventory(medium, "south", 4, 1);
    // A variant that was never stocked.
    await variant(stocked, "TSHIRT-RED-L", "L");

    bare = await product("bare");

    oversold = await product("oversold");
    const small = await variant(oversold, "OVERSOLD-S", "S");
    await inventory(small, "north", 2, 5);

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

  it("answers what is available per variant, summed over locations", async () => {
    const response = await get(`/products/${stocked}/stock`);

    expect(response.statusCode).toBe(200);
    const stock = response.json<ProductStock>();
    expect(productStockSchema.safeParse(stock).success).toBe(true);
    expect(stock.productId).toBe(stocked);
    expect(
      stock.variants.map(({ sku, size, colour, available }) => ({ sku, size, colour, available })),
    ).toEqual([
      { sku: "TSHIRT-RED-L", size: "L", colour: "Red", available: 0 },
      { sku: "TSHIRT-RED-M", size: "M", colour: "Red", available: 7 },
    ]);
  });

  it("answers no variants for a product without any", async () => {
    const response = await get(`/products/${bare}/stock`);

    expect(response.statusCode).toBe(200);
    expect(response.json<ProductStock>().variants).toEqual([]);
  });

  it("never answers below 0 when more is reserved than held", async () => {
    const response = await get(`/products/${oversold}/stock`);

    expect(response.json<ProductStock>().variants[0]?.available).toBe(0);
  });

  it("answers 404 problem+json for an unknown product", async () => {
    const response = await get("/products/1a2b3c4d-0000-4000-8000-000000000000/stock");

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });

  it("answers 400 for an id that is not a uuid", async () => {
    const response = await get("/products/not-a-uuid/stock");

    expect(response.statusCode).toBe(400);
  });
});
