import { Controller, Get, Module } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { AUTH_RATE_LIMIT, RATE_LIMIT } from "../src/rate-limit/rate-limit.module.js";
import { AppModule } from "../src/app.module.js";
import { fastifyOptions } from "../src/logging/logging.config.js";
import { trustedProxyHops, trustProxy } from "../src/proxy/trusted-proxy.js";
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

// Every request reaches the API from the same proxy, as on Render.
const PROXY = "10.0.0.9";

// Builds the API as main.ts does, with TRUSTED_PROXY_HOPS set to `hops`.
async function startApi(hops: string): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({
      ...fastifyOptions,
      trustProxy: trustProxy(trustedProxyHops({ TRUSTED_PROXY_HOPS: hops })),
    }),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

function ping(app: NestFastifyApplication, visitor: string) {
  return app.inject({
    method: "GET",
    url: "/ping",
    remoteAddress: PROXY,
    headers: { "x-forwarded-for": visitor },
  });
}

// A malformed sign-in: the auth rate limit counts it before the body is checked.
function signIn(app: NestFastifyApplication, visitor: string) {
  return app.inject({
    method: "POST",
    url: "/auth/sign-in",
    remoteAddress: PROXY,
    headers: { "x-forwarded-for": visitor },
    payload: {},
  });
}

// Needs Docker: a real Valkey holds the counts, as in production. Each test uses its own
// addresses, so the counts never mix.
describe("visitor address behind the proxy (e2e)", () => {
  let valkey: TestValkey;
  let behindProxy: NestFastifyApplication;
  let direct: NestFastifyApplication;

  beforeAll(async () => {
    valkey = await startTestValkey();
    behindProxy = await startApi("1");
    direct = await startApi("0");
  }, 120_000);

  afterAll(async () => {
    await behindProxy?.close();
    await direct?.close();
    await valkey?.stop();
  });

  it("with 1 hop, counts two visitors separately by the rate limit", async () => {
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect((await ping(behindProxy, "203.0.113.1")).statusCode).toBe(200);
    }

    expect((await ping(behindProxy, "203.0.113.1")).statusCode).toBe(429);
    expect((await ping(behindProxy, "203.0.113.2")).statusCode).toBe(200);
  });

  it("with 1 hop, counts two visitors separately by the auth rate limit", async () => {
    for (let i = 0; i < AUTH_RATE_LIMIT; i++) {
      expect((await signIn(behindProxy, "203.0.113.3")).statusCode).toBe(400);
    }

    expect((await signIn(behindProxy, "203.0.113.3")).statusCode).toBe(429);
    expect((await signIn(behindProxy, "203.0.113.4")).statusCode).toBe(400);
  });

  it("with 0 hops, ignores the header: a new X-Forwarded-For each time is still one visitor", async () => {
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect((await ping(direct, `198.51.100.${i}`)).statusCode).toBe(200);
    }

    expect((await ping(direct, "198.51.100.200")).statusCode).toBe(429);
  });
});
