import { StoreController } from "./store.controller.js";

describe("StoreController", () => {
  const service = { rename: vi.fn() };
  const controller = new StoreController(service);
  const who = { userId: "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d", requestId: "req-1" };

  it("renames the signed-in seller's store", async () => {
    const store = { storeName: "Quill Threads", slug: "quill-threads", status: "approved" };
    service.rename.mockResolvedValue(store);

    await expect(controller.rename(who, { storeName: "Quill Threads" })).resolves.toBe(store);
    expect(service.rename).toHaveBeenCalledWith(who, { storeName: "Quill Threads" });
  });
});
