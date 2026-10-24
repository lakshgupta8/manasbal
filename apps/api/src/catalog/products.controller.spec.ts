import { ProductsController } from "./products.controller.js";

describe("ProductsController", () => {
  it("passes the query to the service and answers its page", async () => {
    const page = { items: [], nextCursor: null };
    const service = { list: vi.fn().mockResolvedValue(page), stock: vi.fn() };
    const controller = new ProductsController(service);

    await expect(controller.list("shirts", "abc", "5")).resolves.toBe(page);
    expect(service.list).toHaveBeenCalledWith({ category: "shirts", cursor: "abc", limit: "5" });
  });

  it("asks the service for the product's stock and answers it", async () => {
    const stock = { productId: "p1", variants: [] };
    const service = { list: vi.fn(), stock: vi.fn().mockResolvedValue(stock) };
    const controller = new ProductsController(service);

    await expect(controller.stock("p1")).resolves.toBe(stock);
    expect(service.stock).toHaveBeenCalledWith("p1");
  });
});
