import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { cartSchema, orderPageSchema, reviewPageSchema } from "@manasbal/types";
import { AppModule } from "../src/app.module.js";
import { RATE_LIMIT } from "../src/rate-limit/rate-limit.module.js";
import { DEMO_USER_HEADER } from "../src/users/demo-user.guard.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";
import { startTestValkey, type TestValkey } from "./support/test-valkey.js";

// Needs Docker: the whole app on a throwaway Postgres and a throwaway Valkey, as in production.
describe("shop journey (e2e)", () => {
  let database: TestDatabase;
  let valkey: TestValkey;
  let app: NestFastifyApplication;
  let variantId: string;
  let buyer: string;
  let shopper: string;
  let buyerOrder: string;
  // Every request comes from the same address, so all of them count against one limit.
  let sent = 0;

  const send = (options: Parameters<NestFastifyApplication["inject"]>[0] & object) => {
    sent += 1;
    return app.inject(options);
  };
  const get = (url: string, userId?: string) =>
    send({
      method: "GET",
      url,
      headers: userId === undefined ? {} : { [DEMO_USER_HEADER]: userId },
    });
  const addToCart = (userId: string, payload: object, key: string) =>
    send({
      method: "POST",
      url: "/cart/items",
      payload,
      headers: { [DEMO_USER_HEADER]: userId, "idempotency-key": key },
    });
  const cartLines = () =>
    database.db.orm.public.CartItem.where({ variantId }).select("quantity").all();

  beforeAll(async () => {
    database = await startTestDatabase();
    valkey = await startTestValkey();
    const orm = database.db.orm.public;

    // These users never sign in.
    const user = (email: string, name: string) =>
      orm.User.select("id").create({ email, passwordHash: "", name });

    const sellerUser = await user("seller@example.test", "Test Seller");
    const seller = await orm.Seller.select("id").create({
      userId: sellerUser.id,
      storeName: "Open Store",
      slug: "open-store",
      status: "approved",
    });
    const pendingUser = await user("pending@example.test", "Pending Seller");
    await orm.Seller.select("id").create({
      userId: pendingUser.id,
      storeName: "Waiting Store",
      slug: "waiting-store",
      status: "pending",
    });

    const category = await orm.Category.select("id").create({ name: "Shirts", slug: "shirts" });
    const product = await orm.Product.select("id").create({
      sellerId: seller.id,
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
    variantId = variant.id;
    // 3 held, 1 reserved: 2 can be bought.
    await orm.Inventory.select("id").create({
      variantId,
      location: "north",
      quantity: 3,
      reserved: 1,
    });

    const address = (userId: string, name: string) =>
      orm.Address.select("id").create({
        userId,
        name,
        line1: "1 Test Road",
        city: "Pune",
        state: "MH",
        pincode: "411001",
        phone: "9000000000",
      });
    const buyerUser = await user("asha@example.test", "Asha Rao");
    buyer = buyerUser.id;
    const buyerAddress = await address(buyer, "Asha Rao");
    const shopperUser = await user("ravi@example.test", "Ravi Nair");
    shopper = shopperUser.id;
    const shopperAddress = await address(shopper, "Ravi Nair");

    // The buyer's delivered order, with a review on its one item.
    const order = await orm.Order.select("id").create({
      userId: buyer,
      addressId: buyerAddress.id,
      status: "delivered",
      totalPaise: 49900,
      idempotencyKey: "journey-buyer-order",
    });
    buyerOrder = order.id;
    const subOrder = await orm.SubOrder.select("id").create({
      orderId: order.id,
      sellerId: seller.id,
      status: "delivered",
      subtotalPaise: 49900,
    });
    const item = await orm.OrderItem.select("id").create({
      subOrderId: subOrder.id,
      variantId,
      quantity: 1,
      unitPricePaise: 49900,
    });
    await orm.Review.select("id").create({
      orderItemId: item.id,
      userId: buyer,
      productId: product.id,
      rating: 5,
      body: "Fits well",
    });
    // The other shopper has an order too, which the buyer must never see.
    await orm.Order.select("id").create({
      userId: shopper,
      addressId: shopperAddress.id,
      status: "placed",
      totalPaise: 49900,
      idempotencyKey: "journey-shopper-order",
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await valkey?.stop();
    await database?.stop();
  });

  it("shows an approved store with its product count, and hides a pending one", async () => {
    const open = await get("/sellers/open-store");
    const waiting = await get("/sellers/waiting-store");

    expect(open.statusCode).toBe(200);
    expect(open.json()).toMatchObject({ slug: "open-store", productCount: 1 });
    expect(waiting.statusCode).toBe(404);
  });

  it("lists a product's reviews with the author's first name only", async () => {
    const response = await get("/products/striped-tee/reviews");

    expect(response.statusCode).toBe(200);
    const page = reviewPageSchema.parse(response.json());
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.authorName).toBe("Asha");
    expect(page.nextCursor).toBeNull();
  });

  it("adds to the cart once when the same Idempotency-Key is sent twice", async () => {
    const first = await addToCart(shopper, { variantId, quantity: 1 }, "journey-key");
    const repeat = await addToCart(shopper, { variantId, quantity: 1 }, "journey-key");

    expect(first.statusCode).toBe(201);
    expect(first.headers["idempotent-replayed"]).toBeUndefined();
    expect(repeat.statusCode).toBe(201);
    expect(repeat.headers["idempotent-replayed"]).toBe("true");
    expect(repeat.json()).toEqual(first.json());
    expect(await cartLines()).toEqual([{ quantity: 1 }]);
  });

  it("refuses the same key with a different quantity and leaves the cart alone", async () => {
    const response = await addToCart(shopper, { variantId, quantity: 2 }, "journey-key");

    expect(response.statusCode).toBe(422);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(await cartLines()).toEqual([{ quantity: 1 }]);
  });

  it("prices the cart line from the database", async () => {
    const response = await get("/cart", shopper);

    expect(response.statusCode).toBe(200);
    const cart = cartSchema.parse(response.json());
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ quantity: 1, unitPricePaise: 49900, linePaise: 49900 });
    expect(cart.subtotalPaise).toBe(49900);
  });

  it("lists the buyer's own order and never the other shopper's", async () => {
    const response = await get("/orders", buyer);

    expect(response.statusCode).toBe(200);
    const page = orderPageSchema.parse(response.json());
    expect(page.items.map((order) => order.id)).toEqual([buyerOrder]);
  });

  it("answers 401 as a problem document when the demo header is missing", async () => {
    for (const url of ["/cart", "/orders"]) {
      const response = await get(url);

      expect(response.statusCode).toBe(401);
      expect(response.headers["content-type"]).toContain("application/problem+json");
    }
  });

  it("stays under the rate limit", () => {
    expect(sent).toBeLessThan(RATE_LIMIT);
  });
});
