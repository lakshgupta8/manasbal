import { NotFoundException } from "@nestjs/common";
import { StockService } from "./stock.service.js";

interface VariantRow {
  id: string;
  sku: string;
  size: string | null;
  colour: string | null;
  inventory: { quantity: number; reserved: number }[];
}

const { productFirst, variants } = vi.hoisted(() => {
  // Stands in for the ORM's query builder; the callbacks are run so the service's own arrow
  // functions are exercised.
  const productFirst = vi.fn<() => Promise<{ id: string } | null>>();
  const variants = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn(function (this: unknown, order: (v: { sku: { asc(): string } }) => string) {
      order({ sku: { asc: () => "sku asc" } });
      return this;
    }),
    select: vi.fn().mockReturnThis(),
    include: vi.fn(function (
      this: unknown,
      _relation: string,
      shape: (q: { select(...fields: string[]): string }) => string,
    ) {
      shape({ select: () => "select" });
      return this;
    }),
    all: vi.fn<() => Promise<VariantRow[]>>(),
  };
  return { productFirst, variants };
});

// The queries need a real database and are covered in test/stock.e2e-spec.ts.
vi.mock("../prisma/db.js", () => ({
  getDb: () => ({
    orm: {
      public: {
        Product: { where: () => ({ select: () => ({ first: productFirst }) }) },
        Variant: variants,
      },
    },
  }),
}));

const PRODUCT_ID = "1a2b3c4d-0000-4000-8000-0000000000a1";
const VARIANT_ID = "1a2b3c4d-0000-4000-8000-0000000000b1";

function variant(inventory: VariantRow["inventory"]): VariantRow {
  return { id: VARIANT_ID, sku: "TSHIRT-RED-M", size: "M", colour: "Red", inventory };
}

describe("StockService", () => {
  const service = new StockService();

  beforeEach(() => {
    vi.clearAllMocks();
    productFirst.mockResolvedValue({ id: PRODUCT_ID });
  });

  it("adds up quantity minus reserved over every location", async () => {
    variants.all.mockResolvedValue([
      variant([
        { quantity: 5, reserved: 1 },
        { quantity: 4, reserved: 1 },
      ]),
    ]);

    await expect(service.forProduct(PRODUCT_ID)).resolves.toEqual({
      productId: PRODUCT_ID,
      variants: [
        { variantId: VARIANT_ID, sku: "TSHIRT-RED-M", size: "M", colour: "Red", available: 7 },
      ],
    });
    expect(variants.where).toHaveBeenCalledWith({ productId: PRODUCT_ID });
  });

  it("answers 0 for a variant with no inventory rows", async () => {
    variants.all.mockResolvedValue([variant([])]);

    const stock = await service.forProduct(PRODUCT_ID);

    expect(stock.variants[0]?.available).toBe(0);
  });

  it("never answers below 0 when more is reserved than held", async () => {
    variants.all.mockResolvedValue([variant([{ quantity: 2, reserved: 5 }])]);

    const stock = await service.forProduct(PRODUCT_ID);

    expect(stock.variants[0]?.available).toBe(0);
  });

  it("answers no variants for a product without any", async () => {
    variants.all.mockResolvedValue([]);

    await expect(service.forProduct(PRODUCT_ID)).resolves.toEqual({
      productId: PRODUCT_ID,
      variants: [],
    });
  });

  it("refuses an unknown product with 404, without reading variants", async () => {
    productFirst.mockResolvedValue(null);

    await expect(service.forProduct(PRODUCT_ID)).rejects.toThrow(NotFoundException);
    expect(variants.all).not.toHaveBeenCalled();
  });
});
