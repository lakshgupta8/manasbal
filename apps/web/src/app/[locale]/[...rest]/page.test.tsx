import { describe, expect, it, vi } from "vitest";
import UnknownPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

describe("UnknownPage", () => {
  it("shows the not-found page for any address under a language", () => {
    expect(() => UnknownPage()).toThrow("NEXT_NOT_FOUND");
  });
});
