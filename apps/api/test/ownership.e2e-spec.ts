import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { cartSchema, orderPageSchema, type Role } from "@manasbal/types";
import { AdminModule } from "../src/admin/admin.module.js";
import { AuditModule } from "../src/audit/audit.module.js";
import { CartModule } from "../src/cart/cart.module.js";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { OrdersModule } from "../src/orders/orders.module.js";
import { SLUG_TAKEN } from "../src/users/store.service.js";
import { UsersModule } from "../src/users/users.module.js";
import { bearer } from "./support/auth.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

// Needs Docker: a throwaway Postgres with the migrations applied. User B must never reach user
// A's data: another user's record answers exactly like a missing one (404), and lists only ever
// hold the caller's own rows. Staff can read any order, and every such view is audited.
describe("ownership (e2e)", () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;
  const ids: Record<string, string> = {};

  const send = async (
    who: string,
    role: Role,
    method: "GET" | "PATCH" | "DELETE",
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url,
      headers: await bearer(ids[who]!, role),
      ...(payload === undefined ? {} : { payload }),
    });

  beforeAll(async () => {
    database = await startTestDatabase();
    const orm = database.db.orm.public;
    const user = async (key: string, role: Role) => {
      const created = await orm.User.select("id").create({
        email: `${key}@example.test`,
        passwordHash: "",
        name: "Test User",
        role,
      });
      ids[key] = created.id;
    };
    await user("userA", "customer");
    await user("userB", "customer");
    await user("sellerA", "seller");
    await user("sellerB", "seller");
    await user("support", "support");

    const storeA = await orm.Seller.select("id").create({
      userId: ids["sellerA"]!,
      storeName: "First Store",
      slug: "first-store",
      status: "approved",
    });
    await orm.Seller.create({
      userId: ids["sellerB"]!,
      storeName: "Second Store",
      slug: "second-store",
      status: "approved",
    });

    // User A's address, order and cart line.
    const address = await orm.Address.select("id").create({
      userId: ids["userA"]!,
      name: "Test User",
      line1: "1 Test Road",
      city: "Pune",
      state: "MH",
      pincode: "411001",
    });
    ids["addressA"] = address.id;
    const order = await orm.Order.select("id").create({
      userId: ids["userA"]!,
      addressId: address.id,
      status: "placed",
      totalPaise: 49900,
      idempotencyKey: "ownership-order",
    });
    ids["orderA"] = order.id;
    const category = await orm.Category.select("id").create({ name: "Shirts", slug: "shirts" });
    const product = await orm.Product.select("id").create({
      sellerId: storeA.id,
      categoryId: category.id,
      name: "Striped Tee",
      slug: "striped-tee",
    });
    const variant = await orm.Variant.select("id").create({
      productId: product.id,
      sku: "TEE-M",
      size: "M",
      pricePaise: 49900,
    });
    const cart = await orm.Cart.select("id").create({ userId: ids["userA"]! });
    await orm.CartItem.create({ cartId: cart.id, variantId: variant.id, quantity: 2 });

    const moduleRef = await Test.createTestingModule({
      imports: [AuditModule, UsersModule, CartModule, OrdersModule, AdminModule],
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

  it("answers 404 when user B edits or deletes user A's address, and leaves it alone", async () => {
    const url = `/me/addresses/${ids["addressA"]}`;

    const edit = await send("userB", "customer", "PATCH", url, { city: "Elsewhere" });
    const remove = await send("userB", "customer", "DELETE", url);

    for (const response of [edit, remove]) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ detail: "No address with this id" });
    }
    expect(await database.sql(`select city from addresses where id = '${ids["addressA"]}'`)).toBe(
      "Pune",
    );
  });

  it("shows user B only their own cart and orders", async () => {
    const cartB = cartSchema.parse((await send("userB", "customer", "GET", "/cart")).json());
    const cartA = cartSchema.parse((await send("userA", "customer", "GET", "/cart")).json());
    const ordersB = orderPageSchema.parse(
      (await send("userB", "customer", "GET", "/orders")).json(),
    );

    expect(cartB.items).toEqual([]);
    expect(cartA.items).toHaveLength(1);
    expect(ordersB.items).toEqual([]);
  });

  it("lets a seller rename only their own store, and audits it", async () => {
    const response = await send("sellerB", "seller", "PATCH", "/me/store", {
      storeName: "  Second Store Renamed ",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      storeName: "Second Store Renamed",
      slug: "second-store-renamed",
      status: "approved",
    });
    expect(await database.sql("select slug from sellers order by slug")).toBe(
      "first-store\nsecond-store-renamed",
    );
    expect(
      await database.sql(
        `select count(*) from audit_logs where action = 'store.update' and actor_id = '${ids["sellerB"]}'`,
      ),
    ).toBe("1");
  });

  it("answers 409 when the name would take another store's slug", async () => {
    const response = await send("sellerB", "seller", "PATCH", "/me/store", {
      storeName: "First Store!",
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ detail: SLUG_TAKEN });
    expect(await database.sql("select store_name from sellers where slug = 'first-store'")).toBe(
      "First Store",
    );
  });

  it("answers 404 to a seller account without a store", async () => {
    const response = await send("userB", "seller", "PATCH", "/me/store", {
      storeName: "No Store Here",
    });

    expect(response.statusCode).toBe(404);
  });

  it("lets support read user A's order, and records the view with support as the actor", async () => {
    const response = await send("support", "support", "GET", `/admin/orders/${ids["orderA"]}`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: ids["orderA"],
      status: "placed",
      totalPaise: 49900,
    });
    expect(
      await database.sql(
        `select actor_id || ',' || target_type || ',' || target_id from audit_logs where action = 'order.view'`,
      ),
    ).toBe(`${ids["support"]},order,${ids["orderA"]}`);
  });

  it("answers 404 for an unknown order and records no view", async () => {
    const before = await database.sql(
      "select count(*) from audit_logs where action = 'order.view'",
    );

    const response = await send(
      "support",
      "support",
      "GET",
      "/admin/orders/00000000-0000-4000-8000-000000000000",
    );

    expect(response.statusCode).toBe(404);
    expect(await database.sql("select count(*) from audit_logs where action = 'order.view'")).toBe(
      before,
    );
  });
});
