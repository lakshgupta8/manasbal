import { Controller, Get, Module } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { DEMO_EMAILS } from "@manasbal/types";
import { AUTH_RATE_LIMIT, RATE_LIMIT } from "../src/rate-limit/rate-limit.module.js";
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

  it("limits an /auth route to 10 a minute per visitor, apart from the overall 100", async () => {
    // A malformed sign-in: the limit counts it before the body is checked, so no database is needed.
    const signIn = () =>
      app.inject({ method: "POST", url: "/auth/sign-in", remoteAddress: "10.0.0.4", payload: {} });

    for (let i = 1; i <= AUTH_RATE_LIMIT; i++) expect((await signIn()).statusCode).toBe(400);
    const eleventh = await signIn();

    expect(eleventh.statusCode).toBe(429);
    expect(eleventh.headers["content-type"]).toContain("application/problem+json");
    expect(Number(eleventh.headers["retry-after"])).toBeGreaterThan(0);
    // The same visitor is still well inside the overall limit elsewhere.
    const elsewhere = await app.inject({ method: "GET", url: "/ping", remoteAddress: "10.0.0.4" });
    expect(elsewhere.statusCode).toBe(200);
  });

  it("limits an /auth/2fa route to 10 a minute per visitor too", async () => {
    // Without a token each try answers 401, after the limit has counted it.
    const setup = () =>
      app.inject({ method: "POST", url: "/auth/2fa/setup", remoteAddress: "10.0.0.5" });

    for (let i = 1; i <= AUTH_RATE_LIMIT; i++) expect((await setup()).statusCode).toBe(401);

    expect((await setup()).statusCode).toBe(429);
  });

  it("limits asking for a new confirmation link to 10 a minute, even for a demo login", async () => {
    // Mail is off in these tests, so each answer is the plain 202 and no database is needed. The
    // demo logins skip only the per-account lockout, never this per-visitor limit.
    const resend = () =>
      app.inject({
        method: "POST",
        url: "/auth/resend-verification",
        remoteAddress: "10.0.0.6",
        payload: { email: DEMO_EMAILS.customer },
      });

    for (let i = 1; i <= AUTH_RATE_LIMIT; i++) expect((await resend()).statusCode).toBe(202);
    const eleventh = await resend();

    expect(eleventh.statusCode).toBe(429);
    expect(Number(eleventh.headers["retry-after"])).toBeGreaterThan(0);
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
