import { describe, expect, it } from "vitest";
import { returnPath, signInFor } from "./return-path";

describe("returnPath", () => {
  it("keeps a page of this shop in the same language, with its query", () => {
    expect(returnPath("/en/account", "en")).toBe("/en/account");
    expect(returnPath("/en/account/addresses?x=1", "en")).toBe("/en/account/addresses?x=1");
    expect(returnPath("/hi/account", "hi")).toBe("/hi/account");
    expect(returnPath("/en", "en")).toBe("/en");
  });

  it("goes home when there is nothing to go back to", () => {
    expect(returnPath(undefined, "en")).toBe("/en");
    expect(returnPath(["/en/account", "/en"], "en")).toBe("/en");
    expect(returnPath("", "en")).toBe("/en");
  });

  it("never leaves the shop", () => {
    for (const next of [
      "https://evil.example/en/account",
      "//evil.example/en",
      "/\\evil.example",
      "/en\\..\\..\\evil",
      "/en/\u0000x",
      "/en/\nx",
      "javascript:alert(1)",
      "en/account",
    ]) {
      expect(returnPath(next, "en"), next).toBe("/en");
    }
  });

  it("stays in the page's language, even through dot segments", () => {
    expect(returnPath("/hi/account", "en")).toBe("/en");
    expect(returnPath("/english", "en")).toBe("/en");
    expect(returnPath("/en/../hi/account", "en")).toBe("/en");
    expect(returnPath("/en/./account", "en")).toBe("/en/account");
    expect(returnPath("/en/..", "en")).toBe("/en");
  });

  it("drops a fragment", () => {
    expect(returnPath("/en/account#top", "en")).toBe("/en/account");
  });
});

describe("signInFor", () => {
  it("asks sign-in to come back to the page", () => {
    expect(signInFor("en", "/en/account/addresses")).toBe(
      "/en/sign-in?next=%2Fen%2Faccount%2Faddresses",
    );
  });
});
