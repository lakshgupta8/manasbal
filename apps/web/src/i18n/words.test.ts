import { describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/test/intl";
import { wordsFor } from "./words";

vi.mock("next-intl/server", () => import("@/test/intl"));

describe("wordsFor", () => {
  it.each(["en", "hi"] as const)("answers a namespace's %s words as written", async (locale) => {
    const words = await wordsFor(locale, "ForgotPassword");

    expect(words).toEqual(MESSAGES[locale].ForgotPassword);
    expect(words.tooManyTriesMinutes).toContain("{minutes}");
  });
});
