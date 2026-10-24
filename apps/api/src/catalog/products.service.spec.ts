import { BadRequestException, NotFoundException } from "@nestjs/common";
import { encodeCursor } from "../pagination/pagination.js";
import { availableOf, ProductsService } from "./products.service.js";

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  variants: number | null;
  category: { slug: string; name: string } | null;
}

interface VariantQuery {
  select(...fields: string[]): VariantQuery;
  min(field: string): VariantQuery;
  orderBy(order: (v: { sku: { asc(): string } }) => string): VariantQuery;
  include(relation: string, shape: (q: VariantQuery) => unknown): VariantQuery;
}

interface StockRow {
  id: string;
  variants: {
    id: string;
    sku: string;
    size: string | null;
    colour: string | null;
    inventory: { quantity: number; reserved: number }[];
  }[];
}

const { products, categoryWhere, categoryFirst } = vi.hoisted(() => {
  // Stands in for the ORM's query builder: each step records its call and returns the same query.
  // The callbacks are run so the service's own arrow functions are exercised.
  const products = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn(function (this: unknown, order: (p: { id: { asc(): string } }) => string) {
      order({ id: { asc: () => "id asc" } });
      return this;
    }),
    cursor: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    include: vi.fn(function (
      this: unknown,
      _relation: string,
      shape: (q: VariantQuery) => unknown,
    ) {
      // One fake serves every include: the variants query chains orderBy/select/include itself.
      const query: VariantQuery = {
        select: () => query,
        min: () => query,
        orderBy: (order) => {
          order({ sku: { asc: () => "sku asc" } });
          return query;
        },
        include: (_nested, nestedShape) => {
          nestedShape(query);
          return query;
        },
      };
      shape(query);
      return this;
    }),
    first: vi.fn<() => Promise<StockRow | null>>(),
    all: vi.fn<() => Promise<ProductRow[]>>(),
  };
  const categoryFirst = vi.fn<() => Promise<{ id: string } | null>>();
  const categoryWhere = vi.fn(() => ({ select: () => ({ first: categoryFirst }) }));
  return { products, categoryWhere, categoryFirst };
});

// The query itself needs a real database and is covered in test/products.e2e-spec.ts.
vi.mock("../prisma/db.js", () => ({
  getDb: () => ({ orm: { public: { Product: products, Category: { where: categoryWhere } } } }),
}));

const SHIRTS_ID = "1a2b3c4d-0000-4000-8000-0000000000c1";
const FIRST = "1a2b3c4d-0000-4000-8000-000000000001";
const SECOND = "1a2b3c4d-0000-4000-8000-000000000002";
const THIRD = "1a2b3c4d-0000-4000-8000-000000000003";

function row(id: string, variants: number | null = 49900): ProductRow {
  return {
    id,
    slug: `product-${id.slice(-1)}`,
    name: `Product ${id.slice(-1)}`,
    variants,
    category: { slug: "shirts", name: "Shirts" },
  };
}

describe("ProductsService", () => {
  const service = new ProductsService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("answers the first page of every product, with a cursor when more remain", async () => {
    products.all.mockResolvedValue([row(FIRST), row(SECOND), row(THIRD)]);

    const page = await service.list({ limit: "2" });

    expect(categoryWhere).not.toHaveBeenCalled();
    expect(products.where).not.toHaveBeenCalled();
    expect(products.cursor).not.toHaveBeenCalled();
    // One row more than the limit, to tell whether another page exists.
    expect(products.limit).toHaveBeenCalledWith(3);
    expect(products.select).toHaveBeenCalledWith("id", "slug", "name");
    expect(page).toEqual({
      items: [
        {
          id: FIRST,
          slug: "product-1",
          name: "Product 1",
          pricePaise: 49900,
          category: { slug: "shirts", name: "Shirts" },
        },
        {
          id: SECOND,
          slug: "product-2",
          name: "Product 2",
          pricePaise: 49900,
          category: { slug: "shirts", name: "Shirts" },
        },
      ],
      nextCursor: encodeCursor(SECOND),
    });
  });

  it("answers the last page after the cursor, with no next cursor", async () => {
    products.all.mockResolvedValue([row(THIRD)]);

    const page = await service.list({ cursor: encodeCursor(SECOND), limit: "2" });

    expect(products.cursor).toHaveBeenCalledWith({ id: SECOND });
    expect(page.items.map((item) => item.id)).toEqual([THIRD]);
    expect(page.nextCursor).toBeNull();
  });

  it("keeps only the products of a known category", async () => {
    categoryFirst.mockResolvedValue({ id: SHIRTS_ID });
    products.all.mockResolvedValue([row(FIRST)]);

    const page = await service.list({ category: "shirts" });

    expect(categoryWhere).toHaveBeenCalledWith({ slug: "shirts" });
    expect(products.where).toHaveBeenCalledWith({ categoryId: SHIRTS_ID });
    expect(page.items).toHaveLength(1);
  });

  it("answers an empty page for an unknown category, without reading products", async () => {
    categoryFirst.mockResolvedValue(null);

    const page = await service.list({ category: "no-such-category" });

    expect(page).toEqual({ items: [], nextCursor: null });
    expect(products.all).not.toHaveBeenCalled();
  });

  it("refuses a cursor that doesn't hold a product id", async () => {
    await expect(service.list({ cursor: encodeCursor("not-a-product") })).rejects.toThrow(
      new BadRequestException("cursor is not valid"),
    );
    expect(products.all).not.toHaveBeenCalled();
  });

  it("answers a null price for a product with no variants", async () => {
    products.all.mockResolvedValue([row(FIRST, null)]);

    const page = await service.list({});

    expect(page.items[0]?.pricePaise).toBeNull();
  });

  it("fails loudly on a product row without its category", async () => {
    products.all.mockResolvedValue([{ ...row(FIRST), category: null }]);

    await expect(service.list({})).rejects.toThrow(`product ${FIRST} has no category`);
  });

  describe("stock", () => {
    it("answers what is available per variant", async () => {
      products.first.mockResolvedValue({
        id: FIRST,
        variants: [
          {
            id: SECOND,
            sku: "TSHIRT-RED-M",
            size: "M",
            colour: "Red",
            inventory: [
              { quantity: 5, reserved: 1 },
              { quantity: 4, reserved: 1 },
            ],
          },
        ],
      });

      await expect(service.stock(FIRST)).resolves.toEqual({
        productId: FIRST,
        variants: [
          { variantId: SECOND, sku: "TSHIRT-RED-M", size: "M", colour: "Red", available: 7 },
        ],
      });
      expect(products.where).toHaveBeenCalledWith({ id: FIRST });
      expect(products.select).toHaveBeenCalledWith("id");
    });

    it("answers no variants for a product without any", async () => {
      products.first.mockResolvedValue({ id: FIRST, variants: [] });

      await expect(service.stock(FIRST)).resolves.toEqual({ productId: FIRST, variants: [] });
    });

    it("refuses an unknown product with 404", async () => {
      products.first.mockResolvedValue(null);

      await expect(service.stock(FIRST)).rejects.toThrow(
        new NotFoundException("No product with this id"),
      );
    });
  });
});

describe("availableOf", () => {
  it("adds up quantity minus reserved over every location", () => {
    expect(
      availableOf([
        { quantity: 5, reserved: 1 },
        { quantity: 4, reserved: 1 },
      ]),
    ).toBe(7);
  });

  it("is 0 without inventory rows", () => {
    expect(availableOf([])).toBe(0);
  });

  it("never goes below 0 when more is reserved than held", () => {
    expect(availableOf([{ quantity: 2, reserved: 5 }])).toBe(0);
  });
});
