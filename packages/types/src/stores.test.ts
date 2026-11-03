import { describe, expect, it } from "vitest";
import { storeUpdateInputSchema } from "./stores.js";

describe("storeUpdateInputSchema", () => {
  it("trims the store name", () => {
    expect(storeUpdateInputSchema.parse({ storeName: "  Quill Threads " })).toEqual({
      storeName: "Quill Threads",
    });
  });

  it.each([
    { case: "a 1-character name", input: { storeName: "Q" } },
    { case: "a 61-character name", input: { storeName: "Q".repeat(61) } },
    { case: "a name with no letter or digit", input: { storeName: "!!!" } },
    { case: "an unknown field", input: { storeName: "Quill Threads", slug: "x" } },
    { case: "no name", input: {} },
  ])("refuses $case", ({ input }) => {
    expect(storeUpdateInputSchema.safeParse(input).success).toBe(false);
  });
});
