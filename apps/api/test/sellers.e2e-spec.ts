import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { sellerStoreSchema } from "@manasbal/types";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { SellersModule } from "../src/sellers/sellers.module.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

// Needs Docker: a throwaway Postgres with the migrations applied.
describe("GET /sellers/:slug (e2e)", () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;

  function get(url: string) {
    return app.inject({ method: "GET", url });
  }

  beforeAll(async () => {
    database = await startTestDatabase();
    const orm = database.db.orm.public;

    const category = await orm.Category.select("id").create({ name: "Shirts", slug: "shirts" });
    async function store(slug: string, status: string, products: number) {
      const user = await orm.User.select("id").create({
        email: `${slug}@example.test`,
        // This user never signs in.
        passwordHash: "",
        name: slug,
      });
      const seller = await orm.Seller.select("id").create({
        userId: user.id,
        storeName: `Store ${slug}`,
        slug,
        status,
      });
      for (let i = 0; i < products; i++) {
        await orm.Product.select("id").create({
          sellerId: seller.id,
          categoryId: category.id,
          name: `${slug}-${i}`,
          slug: `${slug}-${i}`,
        });
      }
    }
    await store("open-store", "approved", 2);
    await store("waiting-store", "pending", 1);
    await store("turned-down-store", "rejected", 1);
    await store("empty-store", "approved", 0);

    const moduleRef = await Test.createTestingModule({
      imports: [SellersModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await database?.stop();
  });

  it("answers an approved store with its product count", async () => {
    const response = await get("/sellers/open-store");

    expect(response.statusCode).toBe(200);
    const body = sellerStoreSchema.parse(response.json());
    expect(body).toEqual({ slug: "open-store", storeName: "Store open-store", productCount: 2 });
  });

  it("answers 404 for a pending store, exactly like an unknown one", async () => {
    const pending = await get("/sellers/waiting-store");
    const unknown = await get("/sellers/no-such-store");

    expect(pending.statusCode).toBe(404);
    expect(unknown.statusCode).toBe(404);
    expect(pending.headers["content-type"]).toContain("application/problem+json");
    // Only the request id may differ.
    expect({ ...pending.json(), requestId: "" }).toEqual({ ...unknown.json(), requestId: "" });
  });

  it("answers 404 for a store that is neither approved nor pending", async () => {
    const response = await get("/sellers/turned-down-store");

    expect(response.statusCode).toBe(404);
  });

  it("answers an approved store with no products as a count of 0", async () => {
    const response = await get("/sellers/empty-store");

    expect(response.statusCode).toBe(200);
    expect(sellerStoreSchema.parse(response.json()).productCount).toBe(0);
  });
});
