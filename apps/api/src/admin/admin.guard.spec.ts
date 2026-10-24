import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { AdminGuard } from "./admin.guard.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";

// The guard only asks the database for the user's role.
const first = vi.fn<() => Promise<{ role: string } | null>>();
const where = vi.fn(() => ({ select: () => ({ first }) }));
vi.mock("../prisma/db.js", () => ({
  getDb: () => ({ orm: { public: { User: { where } } } }),
}));

const context = {
  switchToHttp: () => ({ getRequest: () => ({ userId: USER_ID }) }),
} as unknown as ExecutionContext;

describe("AdminGuard", () => {
  const guard = new AdminGuard();

  beforeEach(() => {
    first.mockReset();
    where.mockClear();
  });

  it("lets an admin in", async () => {
    first.mockResolvedValue({ role: "admin" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(where).toHaveBeenCalledWith({ id: USER_ID });
  });

  it("refuses a buyer with 403", async () => {
    first.mockResolvedValue({ role: "buyer" });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it("refuses a user that is gone with 403", async () => {
    first.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
