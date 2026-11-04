import { describe, expect, it } from "vitest";
import { API_PREFIX, AUTH_PREFIX } from "@/lib/api-routes";
import { LANGUAGE_NAMES, localizedPath, otherLocale, routing } from "./routing";

describe("routing", () => {
  it("has English first, as the default, and Hindi", () => {
    expect(routing.locales).toEqual(["en", "hi"]);
    expect(routing.defaultLocale).toBe("en");
  });

  it("never uses a language code that is also a path to the API", () => {
    const apiSegments = [API_PREFIX, AUTH_PREFIX].map((prefix) => prefix.slice(1));
    expect(routing.locales.filter((locale) => apiSegments.includes(locale))).toEqual([]);
  });

  it("names each language in itself", () => {
    expect(LANGUAGE_NAMES).toEqual({ en: "English", hi: "हिन्दी" });
  });
});

describe("otherLocale", () => {
  it("swaps English and Hindi", () => {
    expect(otherLocale("en")).toBe("hi");
    expect(otherLocale("hi")).toBe("en");
  });
});

describe("localizedPath", () => {
  it.each([
    ["/en", "hi", "/hi"],
    ["/en/", "hi", "/hi"],
    ["/hi/no-such-page", "en", "/en/no-such-page"],
    ["/en/a/b", "hi", "/hi/a/b"],
  ] as const)("sends %s to %s as %s", (pathname, locale, expected) => {
    expect(localizedPath(pathname, locale)).toBe(expected);
  });
});
