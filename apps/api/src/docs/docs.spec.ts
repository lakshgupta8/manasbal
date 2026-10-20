import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { HealthController } from "../health/health.controller.js";
import { DOCS_JSON_PATH, DOCS_PATH, setupDocs } from "./docs.js";

describe("setupDocs", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
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
});
