import { ReviewsController } from "./reviews.controller.js";

describe("ReviewsController", () => {
  it("passes the slug and query to the service and answers its page", async () => {
    const page = { items: [], nextCursor: null };
    const service = { list: vi.fn().mockResolvedValue(page) };
    const controller = new ReviewsController(service);

    await expect(controller.list("striped-tee", "abc", "5")).resolves.toBe(page);
    expect(service.list).toHaveBeenCalledWith("striped-tee", { cursor: "abc", limit: "5" });
  });
});
