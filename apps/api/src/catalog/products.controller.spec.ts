import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { ProductsController } from "./products.controller.js";
import { ProductsService } from "./products.service.js";

describe("ProductsController", () => {
  it("passes the query to the service and answers its page", async () => {
    const page = { items: [], nextCursor: null };
    const service = { list: vi.fn().mockResolvedValue(page), stock: vi.fn(), detail: vi.fn() };
    const controller = new ProductsController(service);

    await expect(controller.list("shirts", "abc", "5")).resolves.toBe(page);
    expect(service.list).toHaveBeenCalledWith({ category: "shirts", cursor: "abc", limit: "5" });
  });

  it("asks the service for the product's stock and answers it", async () => {
    const stock = { productId: "p1", variants: [] };
    const service = { list: vi.fn(), stock: vi.fn().mockResolvedValue(stock), detail: vi.fn() };
    const controller = new ProductsController(service);

    await expect(controller.stock("p1")).resolves.toBe(stock);
    expect(service.stock).toHaveBeenCalledWith("p1");
  });

  it("asks the service for the product with that slug and answers it", async () => {
    const detail = { slug: "red-tee" };
    const service = { list: vi.fn(), stock: vi.fn(), detail: vi.fn().mockResolvedValue(detail) };
    const controller = new ProductsController(service);

    await expect(controller.detail("red-tee")).resolves.toBe(detail);
    expect(service.detail).toHaveBeenCalledWith("red-tee");
  });

  it("refuses an id that is not a uuid with 400, without calling the service", async () => {
    const service = { list: vi.fn(), stock: vi.fn(), detail: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: service }],
    }).compile();
    const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await app.inject({ method: "GET", url: "/products/not-a-uuid/stock" });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(service.stock).not.toHaveBeenCalled();
  });
});
