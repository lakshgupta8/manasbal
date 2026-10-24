import { Body, Controller, Module, Post } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module.js";
import { startTestValkey, type TestValkey } from "./support/test-valkey.js";

// Counts how often the work really happens.
@Controller("orders")
class OrdersController {
  static created = 0;

  @Post()
  create(@Body() body: { qty: number }) {
    OrdersController.created += 1;
    return { orderNumber: OrdersController.created, qty: body.qty };
  }
}

@Module({ imports: [AppModule], controllers: [OrdersController] })
class TestAppModule {}

// Needs Docker: a real Valkey keeps the answers, as in production.
describe("Idempotency-Key (e2e)", () => {
  let valkey: TestValkey;
  let app: NestFastifyApplication;

  const order = (key: string | undefined, qty = 1) =>
    app.inject({
      method: "POST",
      url: "/orders",
      payload: { qty },
      headers: key === undefined ? {} : { "idempotency-key": key },
    });

  beforeAll(async () => {
    valkey = await startTestValkey();

    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await valkey?.stop();
  });

  beforeEach(() => {
    OrdersController.created = 0;
  });

  it("returns the first answer for a repeated key and does the work once", async () => {
    const first = await order("order-key-1");
    const repeat = await order("order-key-1");

    expect(first.statusCode).toBe(201);
    expect(repeat.statusCode).toBe(201);
    expect(repeat.json()).toEqual(first.json());
    expect(repeat.headers["idempotent-replayed"]).toBe("true");
    expect(OrdersController.created).toBe(1);
  });

  it("does the work again for a new key", async () => {
    await order("order-key-2");
    await order("order-key-3");

    expect(OrdersController.created).toBe(2);
  });

  it("does the work every time without a key", async () => {
    await order(undefined);
    await order(undefined);

    expect(OrdersController.created).toBe(2);
  });

  it("refuses the same key with a different body", async () => {
    await order("order-key-4", 1);
    const response = await order("order-key-4", 5);

    expect(response.statusCode).toBe(422);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });
});
