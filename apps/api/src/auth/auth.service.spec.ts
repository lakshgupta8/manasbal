import { BadRequestException } from "@nestjs/common";
import { AuthService, SIGN_UP_FAILED } from "./auth.service.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const HASH = "$argon2id$v=19$m=19456,t=2,p=1$stub";

const input = {
  email: "test.buyer@example.test",
  password: "a long passphrase",
  name: "Test Buyer",
  confirmAdult: true as const,
};

// A stand-in for one ORM collection: the chain methods record their filters and return the
// same object, and the terminal methods are mocks a test sets the answer of.
function fakeCollection() {
  const collection = {
    filters: [] as object[],
    where(filter: object) {
      collection.filters.push(filter);
      return collection;
    },
    select: () => collection,
    first: vi.fn<() => Promise<unknown>>(),
    create: vi.fn<(row: object) => Promise<unknown>>(),
  };
  return collection;
}

let User = fakeCollection();

// Sign-up against a real database is in test/auth.e2e-spec.ts. These cover the service's own
// decisions.
vi.mock("../prisma/db.js", () => ({
  getDb: () => ({ orm: { public: { User } } }),
}));

describe("AuthService", () => {
  const passwords = { hash: vi.fn<(password: string) => Promise<string>>() };
  const service = new AuthService(passwords);

  beforeEach(() => {
    User = fakeCollection();
    passwords.hash.mockReset().mockResolvedValue(HASH);
  });

  it("creates a buyer with the hash, marked for the demo reset", async () => {
    const created = { id: USER_ID, email: input.email, name: input.name };
    User.first.mockResolvedValue(null);
    User.create.mockResolvedValue(created);

    await expect(service.signUp(input)).resolves.toBe(created);

    expect(passwords.hash).toHaveBeenCalledWith(input.password);
    expect(User.filters).toEqual([{ email: input.email }]);
    expect(User.create).toHaveBeenCalledWith({
      email: input.email,
      name: input.name,
      passwordHash: HASH,
      role: "buyer",
      createdByVisitor: true,
    });
  });

  it("gives the generic answer for a taken email, and creates nothing", async () => {
    User.first.mockResolvedValue({ id: USER_ID });

    await expect(service.signUp(input)).rejects.toThrow(new BadRequestException(SIGN_UP_FAILED));
    expect(passwords.hash).toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
  });

  it("gives the generic answer when a sign-up racing for the same email wins", async () => {
    User.first.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: USER_ID });
    User.create.mockRejectedValue(new Error("unique violation"));

    await expect(service.signUp(input)).rejects.toThrow(new BadRequestException(SIGN_UP_FAILED));
  });

  it("rethrows a create error that is not a taken email", async () => {
    const failure = new Error("connection lost");
    User.first.mockResolvedValue(null);
    User.create.mockRejectedValue(failure);

    await expect(service.signUp(input)).rejects.toBe(failure);
    expect(User.first).toHaveBeenCalledTimes(2);
  });
});
