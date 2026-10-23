import { CategoriesController } from "./categories.controller.js";

describe("CategoriesController", () => {
  it("answers the tree the service builds", async () => {
    const tree = [
      { id: "1a2b3c4d-0000-4000-8000-000000000001", name: "Shoes", slug: "shoes", children: [] },
    ];
    const service = { tree: vi.fn().mockResolvedValue(tree) };
    const controller = new CategoriesController(service);

    await expect(controller.list()).resolves.toBe(tree);
  });
});
