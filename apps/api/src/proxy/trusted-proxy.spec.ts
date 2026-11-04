import { Controller, Get, Ip } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { trustedProxyHops, trustProxy } from "./trusted-proxy.js";

describe("trustedProxyHops", () => {
  it("is 0 when unset or blank", () => {
    expect(trustedProxyHops({})).toBe(0);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "  " })).toBe(0);
  });

  it("reads a whole number, trimming spaces", () => {
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: " 2 " })).toBe(2);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "0" })).toBe(0);
  });

  it.each(["-1", "1.5", "one", "true", "1,2"])("refuses %s", (value) => {
    expect(() => trustedProxyHops({ TRUSTED_PROXY_HOPS: value })).toThrow(
      `TRUSTED_PROXY_HOPS has "${value}"`,
    );
  });
});

@Controller("ip")
class IpController {
  @Get()
  ip(@Ip() ip: string) {
    return { ip };
  }
}

describe("trustProxy", () => {
  const PROXY = "10.0.0.9";

  async function ipSeen(hops: number, forwardedFor?: string): Promise<string> {
    const moduleRef = await Test.createTestingModule({ controllers: [IpController] }).compile();
    const app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ trustProxy: trustProxy(hops) }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/ip",
        remoteAddress: PROXY,
        headers: forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor },
      });
      return response.json<{ ip: string }>().ip;
    } finally {
      await app.close();
    }
  }

  it("ignores X-Forwarded-For with 0 hops, so nobody can fake their address", async () => {
    expect(await ipSeen(0, "203.0.113.7")).toBe(PROXY);
  });

  it("takes the address the one trusted proxy saw with 1 hop", async () => {
    expect(await ipSeen(1, "198.51.100.1, 203.0.113.7")).toBe("203.0.113.7");
  });

  it("goes one entry further back for each extra hop", async () => {
    expect(await ipSeen(2, "198.51.100.1, 203.0.113.7")).toBe("198.51.100.1");
  });

  it("keeps the proxy's address when it sends no header", async () => {
    expect(await ipSeen(1)).toBe(PROXY);
  });
});
