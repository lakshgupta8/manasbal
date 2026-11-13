import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCurrency } from "./currency-action";

const set = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe("setCurrency", () => {
  beforeEach(() => {
    set.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the choice in a cookie for a year, for the whole shop, out of scripts' reach", async () => {
    await setCurrency(form({ currency: "USD" }));

    expect(set).toHaveBeenCalledWith("currency", "USD", {
      path: "/",
      maxAge: 31_536_000,
      sameSite: "lax",
      httpOnly: true,
      secure: false,
    });
  });

  it("only ever stores INR or USD", async () => {
    await setCurrency(form({ currency: "<script>" }));
    await setCurrency(form({}));
    const file = new FormData();
    file.set("currency", new Blob(["USD"]));
    await setCurrency(file);

    expect(set.mock.calls.map(([, value]) => value)).toEqual(["INR", "INR", "INR"]);
  });

  it("is a secure cookie in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await setCurrency(form({ currency: "INR" }));

    expect(set.mock.calls[0]![2]).toMatchObject({ secure: true });
  });
});
