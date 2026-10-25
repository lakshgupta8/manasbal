import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { orderPageSchema } from "@manasbal/types";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { OrdersModule } from "../src/orders/orders.module.js";
import { DEMO_USER_HEADER } from "../src/users/demo-user.guard.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

interface Shopper {
  id: string;
  addressId: string;
}

// Needs Docker: a throwaway Postgres with the migrations applied.
describe("GET /orders (e2e)", () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;
  let buyer: Shopper;
  let other: Shopper;

  const get = (userId: string, url: string) =>
    app.inject({ method: "GET", url, headers: { [DEMO_USER_HEADER]: userId } });

  async function createShopper(email: string): Promise<Shopper> {
    const orm = database.db.orm.public;
    // These users never sign in.
    const user = await orm.User.select("id").create({ email, passwordHash: "", name: "Test User" });
    const address = await orm.Address.select("id").create({
      userId: user.id,
      name: "Test User",
      line1: "1 Test Road",
      city: "Pune",
      state: "MH",
      pincode: "411001",
    });
    return { id: user.id, addressId: address.id };
  }

  // An order placed the given number of hours ago.
  async function createOrder(shopper: Shopper, key: string, hoursAgo: number): Promise<string> {
    const order = await database.db.orm.public.Order.select("id").create({
      userId: shopper.id,
      addressId: shopper.addressId,
      status: "placed",
      totalPaise: 49900,
      idempotencyKey: key,
    });
    await database.sql(
      `UPDATE orders SET created_at = now() - interval '${hoursAgo} hours' WHERE id = '${order.id}'`,
    );
    return order.id;
  }

  beforeAll(async () => {
    database = await startTestDatabase();
    buyer = await createShopper("buyer@example.test");
    other = await createShopper("other@example.test");

    const moduleRef = await Test.createTestingModule({
      imports: [OrdersModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await database?.stop();
  });

  // The second test adds the orders, so this one has to run first.
  it("answers an empty page to a buyer with no orders", async () => {
    const response = await get(buyer.id, "/orders");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], nextCursor: null });
  });

  it("pages the buyer's own orders, newest first, and never shows another user's", async () => {
    const older = await createOrder(buyer, "buyer-older", 3);
    const newer = await createOrder(buyer, "buyer-newer", 2);
    // The newest of all, but not the buyer's.
    await createOrder(other, "other-order", 1);

    const first = orderPageSchema.parse((await get(buyer.id, "/orders?limit=1")).json());
    expect(first.items.map((order) => order.id)).toEqual([newer]);
    expect(first.nextCursor).not.toBeNull();

    const second = orderPageSchema.parse(
      (await get(buyer.id, `/orders?limit=1&cursor=${first.nextCursor}`)).json(),
    );
    expect(second.items.map((order) => order.id)).toEqual([older]);
    expect(second.nextCursor).toBeNull();
  });

  it("answers 400 for a bad cursor", async () => {
    const bad = Buffer.from("yesterday|nope").toString("base64url");

    expect((await get(buyer.id, `/orders?cursor=${bad}`)).statusCode).toBe(400);
  });

  it.each(["0", "101"])("answers 400 for a limit of %s", async (limit) => {
    expect((await get(buyer.id, `/orders?limit=${limit}`)).statusCode).toBe(400);
  });

  it("answers 401 without the demo header", async () => {
    const response = await app.inject({ method: "GET", url: "/orders" });

    expect(response.statusCode).toBe(401);
  });
});
