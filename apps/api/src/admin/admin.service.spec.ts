import { encodeCursor } from "../pagination/pagination.js";
import { AdminService } from "./admin.service.js";

interface AuditRow {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  requestId: string;
  createdAt: { toString(): string };
}

const FIRST = "1a2b3c4d-0000-4000-8000-000000000001";
const SECOND = "1a2b3c4d-0000-4000-8000-000000000002";
const ACTOR = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const WHEN = "2026-10-24T08:46:07.123Z";
const EARLIER = "2026-10-23T08:46:07.123Z";

type Order = (row: Record<string, { desc(): string }>) => string;

// Stands in for the ORM's query builder: each step records its call and returns the same query.
// orderBy runs its callbacks so the service's own arrow functions are exercised.
const { logs } = vi.hoisted(() => {
  const logs = {
    orderBy: vi.fn(function (this: unknown, callbacks: Order[]) {
      const row = new Proxy({}, { get: (_, field) => ({ desc: () => `${String(field)} desc` }) });
      for (const callback of callbacks) callback(row);
      return this;
    }),
    cursor: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    all: vi.fn<() => Promise<AuditRow[]>>(),
  };
  return { logs };
});

// The query itself needs a real database and is covered in test/admin.e2e-spec.ts.
vi.mock("../prisma/db.js", () => ({
  getDb: () => ({ orm: { public: { AuditLog: logs } } }),
}));

function row(id: string, createdAt: string, actorId: string | null = ACTOR): AuditRow {
  return {
    id,
    actorId,
    action: "address.create",
    targetType: "address",
    targetId: FIRST,
    requestId: "req-1",
    createdAt: { toString: () => createdAt },
  };
}

describe("AdminService", () => {
  const service = new AdminService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("answers the first page of the log, with a cursor when more remain", async () => {
    logs.all.mockResolvedValue([row(SECOND, WHEN), row(FIRST, EARLIER)]);

    const page = await service.list({ limit: "1" });

    expect(logs.cursor).not.toHaveBeenCalled();
    // One row more than the limit, to tell whether another page exists.
    expect(logs.limit).toHaveBeenCalledWith(2);
    expect(logs.select).toHaveBeenCalledWith(
      "id",
      "actorId",
      "action",
      "targetType",
      "targetId",
      "requestId",
      "createdAt",
    );
    expect(page).toEqual({
      items: [
        {
          id: SECOND,
          actorId: ACTOR,
          action: "address.create",
          targetType: "address",
          targetId: FIRST,
          requestId: "req-1",
          createdAt: WHEN,
        },
      ],
      nextCursor: encodeCursor(`${WHEN}|${SECOND}`),
    });
  });

  it("passes the cursor on and answers the last page with no next cursor", async () => {
    logs.all.mockResolvedValue([row(FIRST, EARLIER, null)]);

    const page = await service.list({ cursor: encodeCursor(`${WHEN}|${SECOND}`), limit: "1" });

    expect(logs.cursor).toHaveBeenCalledWith({
      createdAt: Temporal.Instant.from(WHEN),
      id: SECOND,
    });
    expect(page.items.map((item) => item.actorId)).toEqual([null]);
    expect(page.nextCursor).toBeNull();
  });

  it("refuses a cursor that isn't a time and an id, without reading the log", async () => {
    await expect(service.list({ cursor: encodeCursor("not-a-key") })).rejects.toThrow(
      "cursor is not valid",
    );
    expect(logs.all).not.toHaveBeenCalled();
  });
});
