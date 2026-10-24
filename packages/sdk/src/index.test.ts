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
    demoUser?: string,
  ) {
    const fetch = vi.fn<(request: Request) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } }),
    );
    return { fetch, api: createApiClient({ baseUrl: "http://api.test", fetch, demoUser }) };
  }

  const ID = "00000000-0000-4000-8000-000000000001";
  // The OpenAPI description lists the header as required on these calls, so the types ask for it.
  const AS = { "x-demo-user": ID };
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

    await api.GET("/orders", { params: { header: AS, query: { limit: "5", cursor: "abc" } } });

    expect(fetch.mock.calls[0]![0].url).toBe("http://api.test/orders?limit=5&cursor=abc");
  });

  it("posts a JSON body", async () => {
    const { api, fetch } = fakeApi({ items: [], subtotalPaise: 0 }, 201);

    await api.POST("/cart/items", {
      params: { header: AS },
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
      params: { header: AS, path: { id: ID } },
      body: { city: "Pune" },
    });
    await api.DELETE("/me/addresses/{id}", { params: { header: AS, path: { id: ID } } });

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

    await api.GET("/admin/audit-log", { params: { header: AS } });

    expect(fetch.mock.calls[0]![0].url).toBe("http://api.test/admin/audit-log");
  });

  // The header comes from the option here, so the call leaves out its own.
  it("sends the demo user header only when given one", async () => {
    const withUser = fakeApi({ items: [], subtotalPaise: 0 }, 200, "application/json", ID);
    const without = fakeApi({ items: [], subtotalPaise: 0 });

    await withUser.api.GET("/cart", { params: { header: {} as never } });
    await without.api.GET("/cart", { params: { header: {} as never } });

    expect(withUser.fetch.mock.calls[0]![0].headers.get("x-demo-user")).toBe(ID);
    expect(without.fetch.mock.calls[0]![0].headers.has("x-demo-user")).toBe(false);
  });
});
