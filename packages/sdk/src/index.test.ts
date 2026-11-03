import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./index.js";

describe("createApiClient", () => {
  it("calls the API and returns the typed answer", async () => {
    const fetch = vi.fn<(request: Request) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ status: "ok", service: "manasbal-api", version: "dev" }), {
          headers: { "content-type": "application/json" },
        }),
    );
    const api = createApiClient({ baseUrl: "http://api.test", fetch });

    const { data, error } = await api.GET("/health");

    expect(error).toBeUndefined();
    expect(data?.status).toBe("ok");
    expect(fetch.mock.calls[0]![0].url).toBe("http://api.test/health");
  });

  // Answers every request with the given status and body, and keeps the requests it received.
  function fakeApi(
    body: unknown,
    status = 200,
    contentType = "application/json",
    accessToken?: string,
  ) {
    const fetch = vi.fn<(request: Request) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } }),
    );
    return { fetch, api: createApiClient({ baseUrl: "http://api.test", fetch, accessToken }) };
  }

  const ID = "00000000-0000-4000-8000-000000000001";
  const VARIANT = "00000000-0000-4000-8000-000000000002";

  it("gets a product by slug, with typed variants", async () => {
    const { api, fetch } = fakeApi({
      id: ID,
      slug: "sample-kurta",
      name: "Sample Kurta",
      description: null,
      pricePaise: 49900,
      category: { slug: "kurtas", name: "Kurtas" },
      seller: { slug: "sample-store", storeName: "Sample Store" },
      variants: [
        { id: VARIANT, sku: "KUR-M", size: "M", colour: null, pricePaise: 49900, available: 3 },
      ],
    });

    const { data } = await api.GET("/products/{slug}", {
      params: { path: { slug: "sample-kurta" } },
    });

    expect(fetch.mock.calls[0]![0].url).toBe("http://api.test/products/sample-kurta");
    expect(data?.variants[0]?.sku).toBe("KUR-M");
  });

  it("sends the cursor and limit of a list as a query string", async () => {
    const { api, fetch } = fakeApi({ items: [], nextCursor: null });

    await api.GET("/orders", { params: { query: { limit: "5", cursor: "abc" } } });

    expect(fetch.mock.calls[0]![0].url).toBe("http://api.test/orders?limit=5&cursor=abc");
  });

  it("posts a JSON body", async () => {
    const { api, fetch } = fakeApi({ items: [], subtotalPaise: 0 }, 201);

    await api.POST("/cart/items", {
      body: { variantId: VARIANT, quantity: 1 },
    });

    const request = fetch.mock.calls[0]![0];
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://api.test/cart/items");
    expect(await request.json()).toEqual({ variantId: VARIANT, quantity: 1 });
  });

  it("puts an id in the path of an address edit and delete", async () => {
    const { api, fetch } = fakeApi({}, 200);

    await api.PATCH("/me/addresses/{id}", {
      params: { path: { id: ID } },
      body: { city: "Pune" },
    });
    await api.DELETE("/me/addresses/{id}", { params: { path: { id: ID } } });

    const [patch, remove] = fetch.mock.calls.map(([request]) => request);
    expect([patch!.method, patch!.url]).toEqual(["PATCH", `http://api.test/me/addresses/${ID}`]);
    expect([remove!.method, remove!.url]).toEqual(["DELETE", `http://api.test/me/addresses/${ID}`]);
  });

  it("returns a problem answer as error, with no data", async () => {
    const problem = { type: "about:blank", title: "Not Found", status: 404, detail: "No product" };
    const { api } = fakeApi(problem, 404, "application/problem+json");

    const { data, error } = await api.GET("/products/{slug}", {
      params: { path: { slug: "nope" } },
    });

    expect(data).toBeUndefined();
    expect(error).toEqual(problem);
  });

  it("gets the admin audit log", async () => {
    const { api, fetch } = fakeApi({ items: [], nextCursor: null });

    await api.GET("/admin/audit-log", {});

    expect(fetch.mock.calls[0]![0].url).toBe("http://api.test/admin/audit-log");
  });

  it("starts two-step set-up with the access token and reads the typed answer", async () => {
    const started = { otpauthUrl: "otpauth://totp/Manasbal:x?secret=JBSWY3DP", secret: "JBSWY3DP" };
    const { api, fetch } = fakeApi(started, 200, "application/json", "a.b.c");

    const { data } = await api.POST("/auth/2fa/setup");

    const request = fetch.mock.calls[0]![0];
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://api.test/auth/2fa/setup");
    expect(request.headers.get("authorization")).toBe("Bearer a.b.c");
    expect(data?.otpauthUrl).toBe(started.otpauthUrl);
  });

  it("sends the app's code to enable two-step and gets the recovery codes", async () => {
    const codes = Array.from({ length: 10 }, (_, i) => `abcde-fghj${i}`);
    const { api, fetch } = fakeApi({ recoveryCodes: codes }, 200, "application/json", "a.b.c");

    const { data } = await api.POST("/auth/2fa/enable", { body: { code: "123456" } });

    const request = fetch.mock.calls[0]![0];
    expect(request.url).toBe("http://api.test/auth/2fa/enable");
    expect(await request.json()).toEqual({ code: "123456" });
    expect(data?.recoveryCodes).toHaveLength(10);
  });

  it("tells a two-step challenge from a session after sign-in", async () => {
    const { api } = fakeApi({ twoFactorRequired: true, challengeToken: "c.h.t" });

    const { data } = await api.POST("/auth/sign-in", {
      body: { email: "a@example.test", password: "made-up-password" },
    });

    expect(data && "challengeToken" in data ? data.challengeToken : undefined).toBe("c.h.t");
  });

  it("sends the challenge and a code for the second step and gets the access token", async () => {
    const { api, fetch } = fakeApi({ accessToken: "a.b.c", expiresIn: 900 });

    const { data } = await api.POST("/auth/2fa/verify", {
      body: { challengeToken: "c.h.t", code: "abcde-fghjk" },
    });

    const request = fetch.mock.calls[0]![0];
    expect(request.url).toBe("http://api.test/auth/2fa/verify");
    expect(await request.json()).toEqual({ challengeToken: "c.h.t", code: "abcde-fghjk" });
    expect(data?.accessToken).toBe("a.b.c");
  });

  it("sends a code to switch two-step off", async () => {
    // A 204 has no body, so this answer is made by hand.
    const fetch = vi.fn<(request: Request) => Promise<Response>>(
      async () => new Response(null, { status: 204 }),
    );
    const api = createApiClient({ baseUrl: "http://api.test", fetch, accessToken: "a.b.c" });

    const { error } = await api.POST("/auth/2fa/disable", { body: { code: "123456" } });

    const request = fetch.mock.calls[0]![0];
    expect(error).toBeUndefined();
    expect(request.url).toBe("http://api.test/auth/2fa/disable");
    expect(request.headers.get("authorization")).toBe("Bearer a.b.c");
  });

  it("sends the access token as a bearer token only when given one", async () => {
    const signedIn = fakeApi({ items: [], subtotalPaise: 0 }, 200, "application/json", "a.b.c");
    const without = fakeApi({ items: [], subtotalPaise: 0 });

    await signedIn.api.GET("/cart");
    await without.api.GET("/cart");

    expect(signedIn.fetch.mock.calls[0]![0].headers.get("authorization")).toBe("Bearer a.b.c");
    expect(without.fetch.mock.calls[0]![0].headers.has("authorization")).toBe(false);
  });
});
