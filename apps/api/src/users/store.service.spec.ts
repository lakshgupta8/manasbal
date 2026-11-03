import { ConflictException, NotFoundException } from "@nestjs/common";
import { NO_STORE, SLUG_TAKEN, StoreService } from "./store.service.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const SELLER_ID = "2c3d4e5f-0000-4000-8000-000000000001";
const OTHER_SELLER = "2c3d4e5f-0000-4000-8000-000000000002";
const WHO = { userId: USER_ID, requestId: "req-1" };

// A stand-in for the sellers collection: where() records its filters; first() answers in turn.
function fakeSellers() {
  const sellers = {
    filters: [] as object[],
    where(filter: object) {
      sellers.filters.push(filter);
      return sellers;
    },
    select: () => sellers,
    first: vi.fn<() => Promise<unknown>>(),
    update: vi.fn<(patch: object) => Promise<unknown>>(),
  };
  return sellers;
}

let Seller = fakeSellers();
const work = vi.fn((run: (tx: object) => Promise<unknown>) => run({ orm: { public: { Seller } } }));

vi.mock("../prisma/db.js", () => ({
  getDb: () => ({ orm: { public: { Seller } }, transaction: work }),
}));

describe("StoreService", () => {
  const audit = { record: vi.fn<() => Promise<void>>() };
  const service = new StoreService(audit);

  beforeEach(() => {
    Seller = fakeSellers();
    work.mockClear();
    audit.record.mockReset().mockResolvedValue(undefined);
  });

  it("renames the seller's own store, moves the slug, and records it", async () => {
    const updated = {
      storeName: "Kadamora Velvet & Co",
      slug: "kadamora-velvet-co",
      status: "approved",
    };
    Seller.first.mockResolvedValueOnce({ id: SELLER_ID }).mockResolvedValueOnce(null);
    Seller.update.mockResolvedValue(updated);

    await expect(service.rename(WHO, { storeName: "Kadamora Velvet & Co" })).resolves.toBe(updated);

    expect(Seller.filters).toEqual([
      { userId: USER_ID },
      { slug: "kadamora-velvet-co" },
      { id: SELLER_ID },
    ]);
    expect(Seller.update).toHaveBeenCalledWith({
      storeName: "Kadamora Velvet & Co",
      slug: "kadamora-velvet-co",
    });
    expect(audit.record).toHaveBeenCalledWith(
      WHO,
      "store.update",
      { type: "seller", id: SELLER_ID },
      { public: { Seller } },
    );
  });

  it("keeps the slug when only the case or punctuation changes", async () => {
    Seller.first.mockResolvedValueOnce({ id: SELLER_ID }).mockResolvedValueOnce({ id: SELLER_ID });
    Seller.update.mockResolvedValue({});

    await service.rename(WHO, { storeName: "QUILL threads!" });

    expect(Seller.update).toHaveBeenCalledWith({
      storeName: "QUILL threads!",
      slug: "quill-threads",
    });
  });

  it("answers 404 when the account has no store", async () => {
    Seller.first.mockResolvedValue(null);

    await expect(service.rename(WHO, { storeName: "Quill Threads" })).rejects.toThrow(
      new NotFoundException(NO_STORE),
    );
    expect(Seller.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("answers 409 when another store has the slug", async () => {
    Seller.first
      .mockResolvedValueOnce({ id: SELLER_ID })
      .mockResolvedValueOnce({ id: OTHER_SELLER })
      .mockResolvedValueOnce({ userId: "another-user" });

    await expect(service.rename(WHO, { storeName: "Quill Threads" })).rejects.toThrow(
      new ConflictException(SLUG_TAKEN),
    );
    expect(Seller.update).not.toHaveBeenCalled();
  });

  it("answers 409 when a rename racing for the same slug wins", async () => {
    Seller.first
      .mockResolvedValueOnce({ id: SELLER_ID })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: "another-user" });
    Seller.update.mockRejectedValue(new Error("unique violation"));

    await expect(service.rename(WHO, { storeName: "Quill Threads" })).rejects.toThrow(
      new ConflictException(SLUG_TAKEN),
    );
  });

  it("rethrows a failure that is not a taken slug", async () => {
    const failure = new Error("connection lost");
    Seller.first
      .mockResolvedValueOnce({ id: SELLER_ID })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    Seller.update.mockRejectedValue(failure);

    await expect(service.rename(WHO, { storeName: "Quill Threads" })).rejects.toBe(failure);
  });

  it("rethrows when the slug turns out to be the seller's own", async () => {
    const failure = new Error("connection lost");
    Seller.first
      .mockResolvedValueOnce({ id: SELLER_ID })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: USER_ID });
    Seller.update.mockRejectedValue(failure);

    await expect(service.rename(WHO, { storeName: "Quill Threads" })).rejects.toBe(failure);
  });
});
