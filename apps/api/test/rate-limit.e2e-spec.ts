import { Controller, Get, Module } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { RATE_LIMIT } from "../src/rate-limit/rate-limit.module.js";
import { AppModule } from "../src/app.module.js";
import { startTestValkey, type TestValkey } from "./support/test-valkey.js";

@Controller("ping")
class PingController {
  @Get()
  ping() {
    return { pong: true };
  }
}

@Module({ imports: [AppModule], controllers: [PingController] })
class TestAppModule {}

// Needs Docker: a real Valkey holds the counts, as in production.
describe("rate limiting (e2e)", () => {
  let valkey: TestValkey;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    valkey = await startTestValkey();

    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await valkey?.stop();
  });

  it("answers the first 100 requests and rejects the 101st with 429", async () => {
    for (let i = 1; i <= RATE_LIMIT; i++) {
      const response = await app.inject({ method: "GET", url: "/ping", remoteAddress: "10.0.0.1" });
      expect(response.statusCode).toBe(200);
    }

    const response = await app.inject({ method: "GET", url: "/ping", remoteAddress: "10.0.0.1" });

    expect(response.statusCode).toBe(429);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("counts each visitor separately", async () => {
    const response = await app.inject({ method: "GET", url: "/ping", remoteAddress: "10.0.0.2" });

    expect(response.statusCode).toBe(200);
  });

  it("never limits /health", async () => {
    for (let i = 0; i < RATE_LIMIT + 5; i++) {
      const response = await app.inject({
        method: "GET",
        url: "/health",
        remoteAddress: "10.0.0.3",
      });
      expect(response.statusCode).toBe(200);
    }
  });
});
