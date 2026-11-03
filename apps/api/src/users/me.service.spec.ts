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

  it("answers the user's id, name, email and role", async () => {
    const me = {
      id: USER_ID,
      name: "Test Buyer",
      email: "test.buyer@example.test",
      role: "customer",
    };
    first.mockResolvedValue(me);

    await expect(service.get(USER_ID)).resolves.toBe(me);
    expect(filters).toEqual([{ id: USER_ID }]);
  });

  it("asks to sign in again when the account is gone", async () => {
    first.mockResolvedValue(null);

    await expect(service.get(USER_ID)).rejects.toThrow(new UnauthorizedException("Sign in again"));
  });
});
