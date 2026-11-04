import { isValidElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/test/intl";
import LocaleLayout, { generateMetadata, generateStaticParams } from "./layout";

vi.mock("next-intl/server", () => import("@/test/intl"));
vi.mock("next/font/google", () => {
  const font = (variable: string) => () => ({ variable });
  return {
    Geist: font("geist"),
    Geist_Mono: font("geist-mono"),
    Noto_Sans_Devanagari: font("devanagari"),
  };
});
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

type LayoutArgs = Parameters<typeof LocaleLayout>[0];
const args = (locale: string) =>
  ({ params: Promise.resolve({ locale }), children: "page" }) as unknown as LayoutArgs;

describe("LocaleLayout", () => {
  it("renders both languages at build time", () => {
    expect(generateStaticParams()).toEqual([{ locale: "en" }, { locale: "hi" }]);
  });

  it.each(["en", "hi"] as const)(
    "titles and describes the %s pages in that language",
    async (locale) => {
      await expect(generateMetadata(args(locale))).resolves.toEqual({
        title: MESSAGES[locale].Metadata.title,
        description: MESSAGES[locale].Metadata.description,
      });
    },
  );

  it("sets <html lang> to the address's language, with the Devanagari font ready", async () => {
    const html = (await LocaleLayout(args("hi"))) as ReactElement<{
      lang: string;
      className: string;
    }>;

    expect(isValidElement(html)).toBe(true);
    expect(html.props.lang).toBe("hi");
    expect(html.props.className).toContain("devanagari");
  });

  it("answers 404 for a language the shop doesn't have", async () => {
    await expect(LocaleLayout(args("fr"))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
