import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { productDetailSchema } from "@manasbal/types";
import { CatalogModule } from "../src/catalog/catalog.module.js";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

// Needs Docker: a throwaway Postgres with the migrations applied.
describe("GET /products/:slug (e2e)", () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;

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

    const product = await orm.Product.select("id").create({
      sellerId: seller.id,
      categoryId: category.id,
      name: "Red tee",
      slug: "red-tee",
      description: "A plain red tee",
    });
    const medium = await orm.Variant.select("id").create({
      productId: product.id,
      sku: "TSHIRT-RED-M",
      size: "M",
      colour: "Red",
      pricePaise: 52900,
    });
    await orm.Variant.select("id").create({
      productId: product.id,
      sku: "TSHIRT-RED-L",
      size: "L",
      colour: "Red",
      pricePaise: 49900,
    });
    // 5 - 1 in one place and 4 - 1 in another: 7 can be bought.
    await orm.Inventory.select("id").create({
      variantId: medium.id,
      location: "north",
      quantity: 5,
      reserved: 1,
    });
    await orm.Inventory.select("id").create({
      variantId: medium.id,
      location: "south",
      quantity: 4,
      reserved: 1,
    });

    const moduleRef = await Test.createTestingModule({
      imports: [CatalogModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await database?.stop();
  });

  it("answers the product with its category and seller, and no seller internals", async () => {
    const response = await get("/products/red-tee");

    expect(response.statusCode).toBe(200);
    const body = productDetailSchema.parse(response.json());
    expect(body.description).toBe("A plain red tee");
    expect(body.category).toEqual({ slug: "shirts", name: "Shirts" });
    expect(body.seller).toEqual({ slug: "test-store", storeName: "Test Store" });
    expect(Object.keys(response.json<{ seller: object }>().seller)).not.toContain("userId");
  });

  it("answers the variants in sku order, with price and stock, and the cheapest price", async () => {
    const body = productDetailSchema.parse((await get("/products/red-tee")).json());

    expect(
      body.variants.map(({ sku, pricePaise, available }) => ({ sku, pricePaise, available })),
    ).toEqual([
      { sku: "TSHIRT-RED-L", pricePaise: 49900, available: 0 },
      { sku: "TSHIRT-RED-M", pricePaise: 52900, available: 7 },
    ]);
    expect(body.pricePaise).toBe(49900);
  });

  it("answers 404 problem+json for an unknown slug", async () => {
    const response = await get("/products/no-such-product");

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });
});
