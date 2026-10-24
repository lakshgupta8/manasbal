import { encodeCursor } from "../pagination/pagination.js";
import { OrdersService } from "./orders.service.js";

interface OrderRow {
  id: string;
  status: string;
  totalPaise: number;
  createdAt: { toString(): string };
}

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const FIRST = "1a2b3c4d-0000-4000-8000-000000000001";
const SECOND = "1a2b3c4d-0000-4000-8000-000000000002";
const WHEN = "2026-10-24T08:46:07.123Z";
const EARLIER = "2026-10-23T08:46:07.123Z";

type Order = (row: Record<string, { desc(): string }>) => string;

// Stands in for the ORM's query builder: each step records its call and returns the same query.
// orderBy runs its callbacks so the service's own arrow functions are exercised.
const { orders } = vi.hoisted(() => {
  const orders = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn(function (this: unknown, callbacks: Order[]) {
      const row = new Proxy({}, { get: (_, field) => ({ desc: () => `${String(field)} desc` }) });
      for (const callback of callbacks) callback(row);
      return this;
    }),
    cursor: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    all: vi.fn<() => Promise<OrderRow[]>>(),
  };
  return { orders };
});

// The query itself needs a real database and is covered in test/orders.e2e-spec.ts.
vi.mock("../prisma/db.js", () => ({
  getDb: () => ({ orm: { public: { Order: orders } } }),
}));

function row(id: string, createdAt: string): OrderRow {
  return { id, status: "placed", totalPaise: 49900, createdAt: { toString: () => createdAt } };
}

describe("OrdersService", () => {
  const service = new OrdersService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("answers the user's first page, with a cursor when more remain", async () => {
    orders.all.mockResolvedValue([row(SECOND, WHEN), row(FIRST, EARLIER)]);

    const page = await service.list(USER_ID, { limit: "1" });

    expect(orders.where).toHaveBeenCalledWith({ userId: USER_ID });
    expect(orders.cursor).not.toHaveBeenCalled();
    // One row more than the limit, to tell whether another page exists.
    expect(orders.limit).toHaveBeenCalledWith(2);
    expect(orders.select).toHaveBeenCalledWith("id", "status", "totalPaise", "createdAt");
    expect(page).toEqual({
      items: [{ id: SECOND, status: "placed", totalPaise: 49900, createdAt: WHEN }],
      nextCursor: encodeCursor(`${WHEN}|${SECOND}`),
    });
  });

  it("passes the cursor on and answers the last page with no next cursor", async () => {
    orders.all.mockResolvedValue([row(FIRST, EARLIER)]);

    const page = await service.list(USER_ID, {
      cursor: encodeCursor(`${WHEN}|${SECOND}`),
      limit: "1",
    });

    expect(orders.cursor).toHaveBeenCalledWith({
      createdAt: Temporal.Instant.from(WHEN),
      id: SECOND,
    });
    expect(page.items.map((item) => item.id)).toEqual([FIRST]);
    expect(page.nextCursor).toBeNull();
  });

  it("answers an empty page for a user with no orders", async () => {
    orders.all.mockResolvedValue([]);

    await expect(service.list(USER_ID, {})).resolves.toEqual({ items: [], nextCursor: null });
  });

  it("refuses a cursor that isn't a time and an id, without reading orders", async () => {
    await expect(service.list(USER_ID, { cursor: encodeCursor("not-a-key") })).rejects.toThrow(
      "cursor is not valid",
    );
    expect(orders.all).not.toHaveBeenCalled();
  });
});
