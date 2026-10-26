import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertPeople } from "./people.ts";
import { insertCatalog } from "./products.ts";
import { seed } from "./seed.ts";

vi.mock("./products.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./products.ts")>()),
  insertCatalog: vi.fn(async () => undefined),
}));

vi.mock("./people.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./people.ts")>()),
  insertPeople: vi.fn(async () => undefined),
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

    expect(insertPeople).toHaveBeenCalledWith(
      db.tx.orm,
      expect.objectContaining({ customers: expect.any(Array) }),
    );
    expect(vi.mocked(insertPeople).mock.calls[0]![1].customers).toHaveLength(3);
    expect(insertCatalog).toHaveBeenCalledWith(
      db.tx.orm,
      expect.objectContaining({ products: expect.any(Array) }),
    );
    expect(vi.mocked(insertCatalog).mock.calls[0]![1].products).toHaveLength(10);
    expect(db.close).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Seeded "minimal": 3 customers, 2 sellers, 4 addresses, 10 products, \d+ variants$/,
      ),
    );
  });

  it("seeds the profile it is given", async () => {
    await seed(["--profile", "demo"], fakeDb() as unknown as Db);

    expect(vi.mocked(insertPeople).mock.calls[0]![1].customers).toHaveLength(300);
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
