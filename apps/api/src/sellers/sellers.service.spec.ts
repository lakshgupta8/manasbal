import { NotFoundException } from "@nestjs/common";
import { APPROVED, SellersService } from "./sellers.service.js";

interface SellerRow {
  id: string;
  slug: string;
  storeName: string;
  products: number;
}

const { sellers } = vi.hoisted(() => {
  // Stands in for the ORM's query builder; the include callback is run so the service's own arrow
  // function is exercised.
  const sellers = {
    where: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    include: vi.fn(function (
      this: unknown,
      _relation: string,
      shape: (q: { count(): string }) => string,
    ) {
      shape({ count: () => "count" });
      return this;
    }),
    first: vi.fn<() => Promise<SellerRow | null>>(),
  };
  return { sellers };
});

// The query itself needs a real database and is covered in test/sellers.e2e-spec.ts.
vi.mock("../prisma/db.js", () => ({
  getDb: () => ({ orm: { public: { Seller: sellers } } }),
}));

describe("SellersService", () => {
  const service = new SellersService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("answers an approved store with its product count", async () => {
    sellers.first.mockResolvedValue({
      id: "s1",
      slug: "test-store",
      storeName: "Test Store",
      products: 3,
    });

    await expect(service.store("test-store")).resolves.toEqual({
      slug: "test-store",
      storeName: "Test Store",
      productCount: 3,
    });
    expect(sellers.where).toHaveBeenCalledWith({ slug: "test-store", status: APPROVED });
    expect(sellers.select).toHaveBeenCalledWith("id", "slug", "storeName");
  });

  it("answers 404 when there is no approved store with the slug", async () => {
    sellers.first.mockResolvedValue(null);

    await expect(service.store("nope")).rejects.toThrow(
      new NotFoundException("No store with this slug"),
    );
  });
});
