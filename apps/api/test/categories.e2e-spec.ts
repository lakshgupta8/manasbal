import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { categoryTreeSchema } from "@manasbal/types";
import { CatalogModule } from "../src/catalog/catalog.module.js";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

// Needs Docker: a throwaway Postgres with the migrations applied.
describe("GET /categories (e2e)", () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    database = await startTestDatabase();

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

  beforeEach(async () => {
    await database.sql("delete from categories");
  });

  it("answers the categories as a tree", async () => {
    const clothing = await database.db.orm.public.Category.select("id").create({
      name: "Clothing",
      slug: "clothing",
    });
    const shirts = await database.db.orm.public.Category.select("id").create({
      name: "Shirts",
      slug: "shirts",
      parentId: clothing.id,
    });
    const shoes = await database.db.orm.public.Category.select("id").create({
      name: "Shoes",
      slug: "shoes",
    });

    const response = await app.inject({ method: "GET", url: "/categories" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: clothing.id,
        name: "Clothing",
        slug: "clothing",
        children: [{ id: shirts.id, name: "Shirts", slug: "shirts", children: [] }],
      },
      { id: shoes.id, name: "Shoes", slug: "shoes", children: [] },
    ]);
    expect(categoryTreeSchema.safeParse(response.json()).success).toBe(true);
  });

  it("answers an empty list when there are no categories", async () => {
    const response = await app.inject({ method: "GET", url: "/categories" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });
});
