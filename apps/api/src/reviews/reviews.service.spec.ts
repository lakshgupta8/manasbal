import { NotFoundException } from "@nestjs/common";
import { encodeCursor } from "../pagination/pagination.js";
import { ReviewsService } from "./reviews.service.js";

interface ReviewRow {
  id: string;
  rating: number;
  body: string;
  createdAt: { toString(): string };
  user: { name: string } | null;
}

type Order = (r: { createdAt: { desc(): string }; id: { desc(): string } }) => string;

const { reviews, productFirst, productWhere } = vi.hoisted(() => {
  // Stands in for the ORM's query builder: each step records its call and returns the same query.
  // The callbacks are run so the service's own arrow functions are exercised.
  const reviews = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn(function (this: unknown, orders: Order[]) {
      for (const order of orders) {
        order({ createdAt: { desc: () => "desc" }, id: { desc: () => "desc" } });
      }
      return this;
    }),
    cursor: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    include: vi.fn(function (
      this: unknown,
      _relation: string,
      shape: (q: { select(...fields: string[]): string }) => string,
    ) {
      shape({ select: () => "select" });
      return this;
    }),
    all: vi.fn<() => Promise<ReviewRow[]>>(),
  };
  const productFirst = vi.fn<() => Promise<{ id: string } | null>>();
  const productWhere = vi.fn(() => ({ select: () => ({ first: productFirst }) }));
  return { reviews, productFirst, productWhere };
});

// The query itself needs a real database and is covered in test/reviews.e2e-spec.ts.
vi.mock("../prisma/db.js", () => ({
  getDb: () => ({ orm: { public: { Product: { where: productWhere }, Review: reviews } } }),
}));

const PRODUCT_ID = "1a2b3c4d-0000-4000-8000-0000000000a1";
const FIRST = "1a2b3c4d-0000-4000-8000-000000000001";
const SECOND = "1a2b3c4d-0000-4000-8000-000000000002";
const WHEN = "2026-10-24T08:46:07.123Z";
const EARLIER = "2026-10-23T08:46:07.123Z";

function row(id: string, createdAt: string, name: string | null = "Asha Rao"): ReviewRow {
  return {
    id,
    rating: 4,
    body: `Review ${id.slice(-1)}`,
    createdAt: { toString: () => createdAt },
    user: name === null ? null : { name },
  };
}

describe("ReviewsService", () => {
  const service = new ReviewsService();

  beforeEach(() => {
    vi.clearAllMocks();
    productFirst.mockResolvedValue({ id: PRODUCT_ID });
  });

  it("answers 404 for an unknown product, without reading reviews", async () => {
    productFirst.mockResolvedValue(null);

    await expect(service.list("no-such-product", {})).rejects.toThrow(
      new NotFoundException("No product with this slug"),
    );
    expect(productWhere).toHaveBeenCalledWith({ slug: "no-such-product" });
    expect(reviews.all).not.toHaveBeenCalled();
  });

  it("answers the first page, with a cursor when more remain and first names only", async () => {
    reviews.all.mockResolvedValue([row(SECOND, WHEN), row(FIRST, EARLIER)]);

    const page = await service.list("striped-tee", { limit: "1" });

    expect(reviews.where).toHaveBeenCalledWith({ productId: PRODUCT_ID });
    expect(reviews.cursor).not.toHaveBeenCalled();
    // One row more than the limit, to tell whether another page exists.
    expect(reviews.limit).toHaveBeenCalledWith(2);
    expect(reviews.select).toHaveBeenCalledWith("id", "rating", "body", "createdAt");
    expect(page).toEqual({
      items: [{ id: SECOND, rating: 4, body: "Review 2", authorName: "Asha", createdAt: WHEN }],
      nextCursor: encodeCursor(`${WHEN}|${SECOND}`),
    });
  });

  it("answers the last page after the cursor, with no next cursor", async () => {
    reviews.all.mockResolvedValue([row(FIRST, EARLIER, null)]);

    const page = await service.list("striped-tee", {
      cursor: encodeCursor(`${WHEN}|${SECOND}`),
      limit: "1",
    });

    expect(reviews.cursor).toHaveBeenCalledWith({
      createdAt: Temporal.Instant.from(WHEN),
      id: SECOND,
    });
    expect(page.items.map((item) => item.id)).toEqual([FIRST]);
    expect(page.items[0]?.authorName).toBe("");
    expect(page.nextCursor).toBeNull();
  });
});
