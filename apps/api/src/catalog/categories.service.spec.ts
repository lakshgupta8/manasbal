import { buildCategoryTree, type CategoryRow } from "./categories.service.js";

const CLOTHING = "1a2b3c4d-0000-4000-8000-000000000001";
const SHIRTS = "1a2b3c4d-0000-4000-8000-000000000002";
const FORMAL = "1a2b3c4d-0000-4000-8000-000000000003";
const SHOES = "1a2b3c4d-0000-4000-8000-000000000004";

function row(id: string, name: string, parentId: string | null): CategoryRow {
  return { id, name, slug: name.toLowerCase().replace(/ /g, "-"), parentId };
}

describe("buildCategoryTree", () => {
  it("nests each category under its parent, at any depth", () => {
    const tree = buildCategoryTree([
      row(CLOTHING, "Clothing", null),
      row(SHIRTS, "Shirts", CLOTHING),
      row(FORMAL, "Formal Shirts", SHIRTS),
      row(SHOES, "Shoes", null),
    ]);

    expect(tree).toEqual([
      {
        id: CLOTHING,
        name: "Clothing",
        slug: "clothing",
        children: [
          {
            id: SHIRTS,
            name: "Shirts",
            slug: "shirts",
            children: [{ id: FORMAL, name: "Formal Shirts", slug: "formal-shirts", children: [] }],
          },
        ],
      },
      { id: SHOES, name: "Shoes", slug: "shoes", children: [] },
    ]);
  });

  it("keeps the input order among siblings", () => {
    const tree = buildCategoryTree([
      row(SHOES, "Shoes", null),
      row(CLOTHING, "Clothing", null),
      row(SHIRTS, "Shirts", CLOTHING),
    ]);

    expect(tree.map((node) => node.name)).toEqual(["Shoes", "Clothing"]);
  });

  it("keeps a category whose parent is missing at the top", () => {
    const tree = buildCategoryTree([row(SHIRTS, "Shirts", CLOTHING)]);

    expect(tree).toEqual([{ id: SHIRTS, name: "Shirts", slug: "shirts", children: [] }]);
  });

  it("answers an empty list when there are no categories", () => {
    expect(buildCategoryTree([])).toEqual([]);
  });
});
