import { Controller, Get } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { corsOptions, webOrigins } from "./web-origins.js";

@Controller("ping")
class PingController {
  @Get()
  ping() {
    return { pong: true };
  }
}

const SHOP = "https://shop.example";
const OTHER = "https://other.example";

// CORS as main.ts sets it up, on a real Fastify app: the browser's rules decide whether a page on
// another site may read the answer, and these headers are what it goes by.
describe("CORS", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [PingController] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.enableCors(corsOptions(webOrigins({ WEB_ORIGINS: `${SHOP},http://localhost:3000` })));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("lets the shop read answers, with credentials", async () => {
    const response = await app.inject({ method: "GET", url: "/ping", headers: { origin: SHOP } });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(SHOP);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  // The browser lets a page read a cross-site answer only when Access-Control-Allow-Origin names
  // its origin. @fastify/cors sends Access-Control-Allow-Credentials on every answer, but without a
  // matching origin it grants nothing.
  it("never names another site as allowed, so its pages can't read the answer", async () => {
    const response = await app.inject({ method: "GET", url: "/ping", headers: { origin: OTHER } });

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers the shop's preflight, allowing the method and credentials", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/ping",
      headers: {
        origin: SHOP,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(SHOP);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("allows nothing in another site's preflight", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/ping",
      headers: { origin: OTHER, "access-control-request-method": "POST" },
    });

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("corsOptions", () => {
  it("allows exactly the given origins, with credentials, on a copy of the list", () => {
    const origins = [SHOP];
    const options = corsOptions(origins);

    expect(options).toEqual({ origin: [SHOP], credentials: true });
    expect(options.origin).not.toBe(origins);
  });
});
