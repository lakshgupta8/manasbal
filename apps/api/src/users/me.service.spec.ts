import { UnauthorizedException } from "@nestjs/common";
import { MeService } from "./me.service.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";

const filters: object[] = [];
const first = vi.fn<() => Promise<unknown>>();
const collection = {
  where(filter: object) {
    filters.push(filter);
    return collection;
  },
  select: () => collection,
  first,
};

vi.mock("../prisma/db.js", () => ({
  getDb: () => ({ orm: { public: { User: collection } } }),
}));

describe("MeService", () => {
  const service = new MeService();

  beforeEach(() => {
    filters.length = 0;
    first.mockReset();
  });

  const user = {
    id: USER_ID,
    name: "Test Buyer",
    email: "test.buyer@example.test",
    role: "customer",
  };

  it("answers the user's id, name, email and role, with two-step off", async () => {
    first.mockResolvedValue({ ...user, totpEnabledAt: null });

    await expect(service.get(USER_ID)).resolves.toStrictEqual({ ...user, twoStep: false });
    expect(filters).toEqual([{ id: USER_ID }]);
  });

  // Only the yes or no leaves the service, never when two-step was switched on.
  it("says two-step is on without saying when", async () => {
    first.mockResolvedValue({ ...user, totpEnabledAt: Temporal.Now.instant() });

    await expect(service.get(USER_ID)).resolves.toStrictEqual({ ...user, twoStep: true });
  });

  it("asks to sign in again when the account is gone", async () => {
    first.mockResolvedValue(null);

    await expect(service.get(USER_ID)).rejects.toThrow(new UnauthorizedException("Sign in again"));
  });
});
