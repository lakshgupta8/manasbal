import { SellersController } from "./sellers.controller.js";

describe("SellersController", () => {
  it("asks the service for the store with that slug and answers it", async () => {
    const store = { slug: "test-store", storeName: "Test Store", productCount: 2 };
    const service = { store: vi.fn().mockResolvedValue(store) };
    const controller = new SellersController(service);

    await expect(controller.store("test-store")).resolves.toBe(store);
    expect(service.store).toHaveBeenCalledWith("test-store");
  });
});
