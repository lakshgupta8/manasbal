import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertDataset } from "./dataset.ts";
import { seed } from "./seed.ts";

vi.mock("./dataset.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./dataset.ts")>()),
  insertDataset: vi.fn(async () => undefined),
}));

function fakeDb() {
  const tx = { orm: { fake: "transaction orm" } };
  return {
    tx,
    transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    close: vi.fn(async () => undefined),
  };
}

type Db = Parameters<typeof seed>[1];

describe("seed", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("seeds the minimal profile by default, inside a transaction, then closes", async () => {
    const db = fakeDb();

    await seed([], db as unknown as Db);

    expect(insertDataset).toHaveBeenCalledWith(
      db.tx.orm,
      expect.objectContaining({ marker: expect.objectContaining({ name: "manasbal-demo" }) }),
    );
    const data = vi.mocked(insertDataset).mock.calls[0]![1];
    expect(data.people.customers).toHaveLength(3);
    expect(data.catalog.products).toHaveLength(10);
    expect(data.orders.orders).toHaveLength(5);
    expect(db.close).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Seeded "minimal": 3 customers, 2 sellers, 4 addresses, 10 products, \d+ variants, 15 coupons, 5 orders, \d+ reviews, \d+ settlements$/,
      ),
    );
  });

  it("seeds the profile it is given", async () => {
    await seed(["--profile", "demo"], fakeDb() as unknown as Db);

    expect(vi.mocked(insertDataset).mock.calls[0]![1].people.customers).toHaveLength(300);
  });

  it("still closes the client when the profile doesn't exist", async () => {
    const db = fakeDb();

    await expect(seed(["--profile", "huge"], db as unknown as Db)).rejects.toThrow(
      'Unknown seed profile "huge"',
    );
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.close).toHaveBeenCalled();
  });
});
