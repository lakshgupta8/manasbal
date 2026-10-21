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
});
