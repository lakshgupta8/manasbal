import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { reviewPageSchema, type ReviewPage } from "@manasbal/types";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { ReviewsModule } from "../src/reviews/reviews.module.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

// Needs Docker: a throwaway Postgres with the migrations applied.
describe("GET /products/:slug/reviews (e2e)", () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;
  const ids: string[] = [];

  async function get(url: string) {
    const response = await app.inject({ method: "GET", url });
    return { status: response.statusCode, body: response.json<unknown>() };
  }

  async function page(url: string): Promise<ReviewPage> {
    const { status, body } = await get(url);
    expect(status).toBe(200);
    return reviewPageSchema.parse(body);
  }

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
      name: "Tee",
      slug: "tee",
    });
    await orm.Product.select("id").create({
      sellerId: seller.id,
      categoryId: category.id,
      name: "Unreviewed",
      slug: "unreviewed",
    });
    const variant = await orm.Variant.select("id").create({
      productId: product.id,
      sku: "TEE-M",
      size: "M",
      colour: "Red",
      pricePaise: 49900,
    });

    const buyer = await orm.User.select("id").create({
      email: "asha@example.test",
      passwordHash: "",
      name: "Asha Rao",
    });
    const address = await orm.Address.select("id").create({
      userId: buyer.id,
      name: "Asha Rao",
      line1: "1 Test Road",
      city: "Pune",
      state: "MH",
      pincode: "411001",
    });
    const order = await orm.Order.select("id").create({
      userId: buyer.id,
      addressId: address.id,
      status: "delivered",
      totalPaise: 149700,
      idempotencyKey: "reviews-e2e-order",
    });
    const subOrder = await orm.SubOrder.select("id").create({
      orderId: order.id,
      sellerId: seller.id,
      status: "delivered",
      subtotalPaise: 149700,
    });

    // Three reviews, one per order item. The last two share a timestamp, so the id has to break
    // the tie for page boundaries to be stable.
    for (let n = 1; n <= 3; n++) {
      const item = await orm.OrderItem.select("id").create({
        subOrderId: subOrder.id,
        variantId: variant.id,
        quantity: 1,
        unitPricePaise: 49900,
      });
      const review = await orm.Review.select("id").create({
        orderItemId: item.id,
        userId: buyer.id,
        productId: product.id,
        rating: n + 1,
        body: `Review ${n}`,
        // Only the first review is one the demo seed wrote; the others take the default.
        ...(n === 1 ? { isSample: true } : {}),
      });
      ids.push(review.id);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await database.sql(
      `UPDATE reviews SET created_at = (SELECT created_at FROM reviews WHERE id = '${ids[1]}') WHERE id = '${ids[2]}'`,
    );

    const moduleRef = await Test.createTestingModule({
      imports: [ReviewsModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await database?.stop();
  });

  it("pages newest first, shows first names only, and ends with a null cursor", async () => {
    const first = await page("/products/tee/reviews?limit=1");
    expect(first.items).toHaveLength(1);
    expect(first.items[0]?.authorName).toBe("Asha");
    expect(first.nextCursor).not.toBeNull();

    // Walk the whole list one review at a time: nothing repeats and nothing is skipped.
    const seen = [first.items[0]!];
    let cursor = first.nextCursor;
    while (cursor !== null) {
      const next = await page(`/products/tee/reviews?limit=1&cursor=${cursor}`);
      seen.push(...next.items);
      cursor = next.nextCursor;
    }
    expect(seen.map((r) => r.body).sort()).toEqual(["Review 1", "Review 2", "Review 3"]);
    expect(new Set(seen.map((r) => r.id)).size).toBe(3);
    // The oldest review is the one that is alone at its timestamp, and it comes last.
    expect(seen.at(-1)?.body).toBe("Review 1");
    // Only the seeded review says it is a sample.
    expect(seen.map((r) => [r.body, r.isSample]).sort()).toEqual([
      ["Review 1", true],
      ["Review 2", false],
      ["Review 3", false],
    ]);
    const times = seen.map((r) => r.createdAt);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("answers an empty page for a product with no reviews", async () => {
    expect(await page("/products/unreviewed/reviews")).toEqual({ items: [], nextCursor: null });
  });

  it("answers 404 for an unknown slug and 400 for a bad cursor", async () => {
    expect((await get("/products/no-such-product/reviews")).status).toBe(404);
    const bad = Buffer.from("yesterday|nope").toString("base64url");
    expect((await get(`/products/tee/reviews?cursor=${bad}`)).status).toBe(400);
  });

  it.each(["0", "101"])("answers 400 for a limit of %s", async (limit) => {
    expect((await get(`/products/tee/reviews?limit=${limit}`)).status).toBe(400);
  });
});
