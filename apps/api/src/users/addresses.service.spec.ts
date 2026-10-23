import { ConflictException, NotFoundException } from "@nestjs/common";
import { AddressesService } from "./addresses.service.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const ADDRESS_ID = "0f1e2d3c-4b5a-4968-8776-655443322110";

const input = {
  name: "Test Buyer",
  line1: "12 Sample Lane",
  city: "Sampleton",
  state: "Example State",
  pincode: "190006",
  phone: "9800000000",
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
    orders: [] as string[],
    orderBy(orders: ((row: Record<string, { asc(): string }>) => string)[]) {
      const row = new Proxy({}, { get: (_, field) => ({ asc: () => `${String(field)} asc` }) });
      collection.orders.push(...orders.map((order) => order(row)));
      return collection;
    },
    first: vi.fn<() => Promise<unknown>>(),
    all: vi.fn<() => Promise<unknown[]>>(),
    create: vi.fn<(row: object) => Promise<unknown>>(),
    update: vi.fn<(patch: object) => Promise<unknown>>(),
    updateAndCount: vi.fn<(patch: object) => Promise<number>>(),
    delete: vi.fn<() => Promise<unknown>>(),
  };
  return collection;
}

let Address = fakeCollection();
let Order = fakeCollection();

// The ownership rules against a real database are in test/addresses.e2e-spec.ts. These cover
// the service's own decisions.
vi.mock("../prisma/db.js", () => ({
  getDb: () => {
    const orm = { public: { Address, Order } };
    return { orm, transaction: (work: (tx: { orm: typeof orm }) => unknown) => work({ orm }) };
  },
}));

describe("AddressesService", () => {
  const service = new AddressesService();

  beforeEach(() => {
    Address = fakeCollection();
    Order = fakeCollection();
  });

  it("lists only the user's addresses, the default first", async () => {
    Address.all.mockResolvedValue([
      { id: "a", isDefault: false },
      { id: "b", isDefault: true },
      { id: "c", isDefault: false },
    ]);

    const list = await service.list(USER_ID);

    expect(Address.filters).toEqual([{ userId: USER_ID }]);
    expect(Address.orders).toEqual(["name asc", "id asc"]);
    expect(list.map((a) => a.id)).toEqual(["b", "a", "c"]);
  });

  it("creates a non-default address for the user, marked for the demo reset", async () => {
    Address.create.mockResolvedValue({ id: ADDRESS_ID });

    await service.create(USER_ID, input);

    expect(Address.create).toHaveBeenCalledWith({
      ...input,
      isDefault: false,
      userId: USER_ID,
      createdByVisitor: true,
    });
    expect(Address.updateAndCount).not.toHaveBeenCalled();
  });

  it("clears the user's old default before creating a new one", async () => {
    await service.create(USER_ID, { ...input, isDefault: true });

    expect(Address.filters).toEqual([{ userId: USER_ID, isDefault: true }]);
    expect(Address.updateAndCount).toHaveBeenCalledWith({ isDefault: false });
  });

  it("edits the user's address", async () => {
    Address.first.mockResolvedValue({ id: ADDRESS_ID });
    Address.update.mockResolvedValue({ id: ADDRESS_ID, city: "Othertown" });

    await expect(service.update(USER_ID, ADDRESS_ID, { city: "Othertown" })).resolves.toEqual({
      id: ADDRESS_ID,
      city: "Othertown",
    });
    expect(Address.filters).toContainEqual({ id: ADDRESS_ID, userId: USER_ID });
    expect(Address.updateAndCount).not.toHaveBeenCalled();
  });

  it("clears the old default when an edit makes an address the default", async () => {
    Address.first.mockResolvedValue({ id: ADDRESS_ID });
    Address.update.mockResolvedValue({ id: ADDRESS_ID, isDefault: true });

    await service.update(USER_ID, ADDRESS_ID, { isDefault: true });

    expect(Address.updateAndCount).toHaveBeenCalledWith({ isDefault: false });
  });

  it("answers 404 when editing an address the user doesn't have", async () => {
    Address.first.mockResolvedValue(null);

    await expect(service.update(USER_ID, ADDRESS_ID, { city: "Othertown" })).rejects.toThrow(
      NotFoundException,
    );
    expect(Address.update).not.toHaveBeenCalled();
  });

  it("deletes the user's address", async () => {
    Address.first.mockResolvedValue({ id: ADDRESS_ID });
    Order.first.mockResolvedValue(null);

    await service.remove(USER_ID, ADDRESS_ID);

    expect(Address.delete).toHaveBeenCalled();
  });

  it("answers 404 when deleting an address the user doesn't have", async () => {
    Address.first.mockResolvedValue(null);

    await expect(service.remove(USER_ID, ADDRESS_ID)).rejects.toThrow(NotFoundException);
    expect(Address.delete).not.toHaveBeenCalled();
  });

  it("answers 409 when an order was sent to the address", async () => {
    Address.first.mockResolvedValue({ id: ADDRESS_ID });
    Order.first.mockResolvedValue({ id: "order" });

    await expect(service.remove(USER_ID, ADDRESS_ID)).rejects.toThrow(ConflictException);
    expect(Address.delete).not.toHaveBeenCalled();
  });
});
