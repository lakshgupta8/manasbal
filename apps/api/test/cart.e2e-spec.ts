import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { cartSchema } from "@manasbal/types";
import { CartModule } from "../src/cart/cart.module.js";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { DEMO_USER_HEADER } from "../src/users/demo-user.guard.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

const MISSING_VARIANT = "00000000-0000-4000-8000-0000000000ff";

// Needs Docker: a throwaway Postgres with the migrations applied.
describe("/cart (e2e)", () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;
  let buyer: string;
  let variantId: string;

  const add = (userId: string | undefined, payload: object) =>
    app.inject({
      method: "POST",
      url: "/cart/items",
      payload,
      headers: userId === undefined ? {} : { [DEMO_USER_HEADER]: userId },
    });

  beforeAll(async () => {
    database = await startTestDatabase();
    const orm = database.db.orm.public;

    const sellerUser = await orm.User.select("id").create({
      email: "seller@example.test",
      // These users never sign in.
      passwordHash: "",
      name: "Test Seller",
    });
    const seller = await orm.Seller.select("id").create({
      userId: sellerUser.id,
      storeName: "Test Store",
      slug: "test-store",
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
    const user = await orm.User.select("id").create({
      email: "buyer@example.test",
      passwordHash: "",
      name: "Test Buyer",
    });
    buyer = user.id;

    const moduleRef = await Test.createTestingModule({
      imports: [CartModule],
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

  // The steps share one cart, so they run in order.
  it("answers an empty cart to a user who has none, and makes no row", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/cart",
      headers: { [DEMO_USER_HEADER]: buyer },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], subtotalPaise: 0 });
    expect(await database.sql("SELECT count(*) FROM carts")).toContain("0");
  });

  it("adds a variant, pricing it from the database", async () => {
    const response = await add(buyer, { variantId, quantity: 1 });

    expect(response.statusCode).toBe(201);
    expect(cartSchema.parse(response.json())).toEqual({
      items: [
        {
          variantId,
          productName: "Striped Tee",
          sku: "TEE-M",
          quantity: 1,
          unitPricePaise: 49900,
          linePaise: 49900,
        },
      ],
      subtotalPaise: 49900,
    });
  });

  it("raises the quantity of the same line when the variant is added again", async () => {
    const response = await add(buyer, { variantId, quantity: 1 });

    expect(response.statusCode).toBe(201);
    const cart = cartSchema.parse(response.json());
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.quantity).toBe(2);
    expect(cart.subtotalPaise).toBe(99800);
  });

  it("answers 409 when the cart would hold more than is available", async () => {
    const response = await add(buyer, { variantId, quantity: 1 });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ detail: "Only 2 left" });
  });

  it("answers 404 for an unknown variant", async () => {
    const response = await add(buyer, { variantId: MISSING_VARIANT, quantity: 1 });

    expect(response.statusCode).toBe(404);
  });

  it("refuses a price in the body", async () => {
    const response = await add(buyer, { variantId, quantity: 1, pricePaise: 1 });

    expect(response.statusCode).toBe(400);
  });

  it("answers 401 without the demo header", async () => {
    expect((await add(undefined, { variantId, quantity: 1 })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/cart" })).statusCode).toBe(401);
  });
});
