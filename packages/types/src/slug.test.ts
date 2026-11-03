import { describe, expect, it } from "vitest";
import { slugify } from "./slug.js";

describe("slugify", () => {
  it("lower-cases and joins words with single hyphens", () => {
    expect(slugify("Kadamora Velvet & Co.")).toBe("kadamora-velvet-co");
    expect(slugify("  --Quill   Threads--  ")).toBe("quill-threads");
  });

  it("leaves nothing of a name without letters or digits", () => {
    expect(slugify("!!")).toBe("");
  });
});
