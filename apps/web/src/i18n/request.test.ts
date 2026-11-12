import { describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/test/intl";

// getRequestConfig hands back the function Next.js calls for each request, and next/root-params
// (filled in by Next.js's compiler) answers the address's [locale] segment.
vi.mock("next-intl/server", () => ({ getRequestConfig: <T>(make: T) => make }));
const root = vi.hoisted(() => ({ locale: "en" }));
vi.mock("next/root-params", () => ({ locale: () => Promise.resolve(root.locale) }));

const { default: requestConfig } = await import("./request");
const configFor = (named?: string) =>
  (requestConfig as unknown as (params: { locale?: string }) => Promise<unknown>)({
    locale: named,
  });

describe("request config", () => {
  it.each(["en", "hi"] as const)(
    "loads the %s messages for the address's language",
    async (locale) => {
      root.locale = locale;

      await expect(configFor()).resolves.toEqual({ locale, messages: MESSAGES[locale] });
    },
  );

  it("prefers a language the caller names over the address's", async () => {
    root.locale = "en";

    await expect(configFor("hi")).resolves.toEqual({ locale: "hi", messages: MESSAGES.hi });
  });

  it.each(["fr", "api"])("falls back to English for %j", async (unknown) => {
    root.locale = unknown;

    await expect(configFor()).resolves.toEqual({ locale: "en", messages: MESSAGES.en });
  });
});
