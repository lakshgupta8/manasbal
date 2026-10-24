import { AuditService } from "./audit.service.js";

const WHO = { userId: "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d", requestId: "req-1" };
const TARGET = { type: "address", id: "0f1e2d3c-4b5a-4968-8776-655443322110" };

const row = {
  actorId: WHO.userId,
  action: "address.create",
  targetType: "address",
  targetId: TARGET.id,
  requestId: "req-1",
  createdByVisitor: true,
};

const { defaultCreate } = vi.hoisted(() => ({ defaultCreate: vi.fn() }));

vi.mock("../prisma/db.js", () => ({
  getDb: () => ({ orm: { public: { AuditLog: { create: defaultCreate } } } }),
}));

describe("AuditService", () => {
  const service = new AuditService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes who did what to which record, through the default orm", async () => {
    await service.record(WHO, "address.create", TARGET);

    expect(defaultCreate).toHaveBeenCalledWith(row);
  });

  it("writes through the orm it is given, such as a transaction's", async () => {
    const create = vi.fn();
    const orm = { public: { AuditLog: { create } } };

    await service.record(WHO, "address.create", TARGET, orm as never);

    expect(create).toHaveBeenCalledWith(row);
    expect(defaultCreate).not.toHaveBeenCalled();
  });
});
