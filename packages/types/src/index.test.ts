import { describe, expect, it } from "vitest";
// Through the index, so the test also checks that every schema is exported and loads.
import { addressPatchSchema, categoryTreeSchema, demoPanSchema } from "./index.js";

describe("@manasbal/types", () => {
  it("exports the demo ID schemas", () => {
    expect(demoPanSchema.safeParse("DEMO-PAN-123456").success).toBe(true);
  });

  it("refuses an address edit that changes nothing", () => {
    expect(addressPatchSchema.safeParse({}).success).toBe(false);
    expect(addressPatchSchema.safeParse({ city: "Sampleton" }).success).toBe(true);
  });

  it("reads categories nested at any depth", () => {
    const leaf = { id: crypto.randomUUID(), name: "Leaf", slug: "leaf", children: [] };
    const tree = [{ id: crypto.randomUUID(), name: "Root", slug: "root", children: [leaf] }];

    expect(categoryTreeSchema.parse(tree)).toEqual(tree);
    expect(categoryTreeSchema.safeParse([{ ...tree[0], children: [{ name: "x" }] }]).success).toBe(
      false,
    );
  });
});
