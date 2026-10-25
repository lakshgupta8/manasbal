import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { CategoriesController } from "../catalog/categories.controller.js";
import { CategoriesService } from "../catalog/categories.service.js";
import { HealthController } from "../health/health.controller.js";
import { DOCS_JSON_PATH, DOCS_PATH, setupDocs } from "./docs.js";

describe("setupDocs", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      // Categories too: its schema refers to itself, which only resolves while building a document.
      controllers: [HealthController, CategoriesController],
      providers: [{ provide: CategoriesService, useValue: {} }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    setupDocs(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves the docs page at /docs", async () => {
    const response = await app.inject({ method: "GET", url: `/${DOCS_PATH}` });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
  });

  it("serves the OpenAPI description at /docs-json", async () => {
    const response = await app.inject({ method: "GET", url: `/${DOCS_JSON_PATH}` });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ paths: object }>().paths).toHaveProperty("/health");
  });

  it("declares a server and every tag it uses", async () => {
    const response = await app.inject({ method: "GET", url: `/${DOCS_JSON_PATH}` });
    const document = response.json<{ servers: { url: string }[]; tags: { name: string }[] }>();

    expect(document.servers).toEqual([expect.objectContaining({ url: "/" })]);
    expect(document.tags.map((tag) => tag.name)).toContain("Health");
  });

  it("describes a category's children as categories", async () => {
    const response = await app.inject({ method: "GET", url: `/${DOCS_JSON_PATH}` });
    const { schemas } = response.json<{
      components: { schemas: { Category: { properties: { children: { items: object } } } } };
    }>().components;

    expect(schemas.Category.properties.children.items).toEqual({
      $ref: "#/components/schemas/Category",
    });
  });
});
