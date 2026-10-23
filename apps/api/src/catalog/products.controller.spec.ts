import { ProductsController } from "./products.controller.js";

describe("ProductsController", () => {
  it("passes the query to the service and answers its page", async () => {
    const page = { items: [], nextCursor: null };
    const service = { list: vi.fn().mockResolvedValue(page) };
    const controller = new ProductsController(service);

    await expect(controller.list("shirts", "abc", "5")).resolves.toBe(page);
    expect(service.list).toHaveBeenCalledWith({ category: "shirts", cursor: "abc", limit: "5" });
  });
});
