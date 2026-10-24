import { StockController } from "./stock.controller.js";

describe("StockController", () => {
  it("asks the service for the product's stock and answers it", async () => {
    const stock = { productId: "p1", variants: [] };
    const service = { list: vi.fn(), stock: vi.fn().mockResolvedValue(stock) };
    const controller = new StockController(service);

    await expect(controller.get("p1")).resolves.toBe(stock);
    expect(service.stock).toHaveBeenCalledWith("p1");
  });
});
