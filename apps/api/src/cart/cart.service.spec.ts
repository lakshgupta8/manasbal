import { ConflictException, NotFoundException } from "@nestjs/common";
import { CartService } from "./cart.service.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const CART_ID = "0f1e2d3c-4b5a-4968-8776-655443322110";
const VARIANT_ID = "1a2b3c4d-0000-4000-8000-0000000000a1";
const LINE_ID = "1a2b3c4d-0000-4000-8000-0000000000b1";

interface Query {
  select(...fields: string[]): Query;
  include(relation: string, shape: (q: Query) => unknown): Query;
}

// A stand-in for one ORM collection: the chain methods record their filters and return the
// same object, and the terminal methods are mocks a test sets the answer of. include runs its
// callback so the service's own arrow functions are exercised.
function fakeCollection() {
  const nested: Query = {
    select: () => nested,
    include: (_relation, shape) => {
      shape(nested);
      return nested;
    },
  };
  const collection = {
    filters: [] as object[],
    where(filter: object) {
      collection.filters.push(filter);
      return collection;
    },
    select: () => collection,
    include(_relation: string, shape: (q: Query) => unknown) {
      shape(nested);
      return collection;
    },
    first: vi.fn<() => Promise<unknown>>(),
    create: vi.fn<(row: object) => Promise<unknown>>(),
    update: vi.fn<(patch: object) => Promise<unknown>>(),
  };
  return collection;
}

let Cart = fakeCollection();
let CartItem = fakeCollection();
let Variant = fakeCollection();
// What the transaction did, in order: the raw statements it ran and the ORM reads.
let steps: string[] = [];

// The raw lane builds a plan from the SQL text and its values; the plan records both.
function rawSql(strings: TemplateStringsArray, ...values: unknown[]) {
  return { affectedCount: () => ({ build: () => ({ sql: strings.join("$"), values }) }) };
}
const execute = vi.fn((plan: { sql: string; values: unknown[] }) => {
  steps.push(`${plan.sql} ${JSON.stringify(plan.values)}`);
  return Promise.resolve({ affectedRows: 1 });
});

// The queries against a real database are in test/cart.e2e-spec.ts. These cover the service's
// own decisions.
vi.mock("../prisma/db.js", () => ({
  getDb: () => {
    const orm = { public: { Cart, CartItem, Variant } };
    return {
      orm,
      raw: { sql: rawSql },
      transaction: (work: (tx: { orm: typeof orm; execute: typeof execute }) => unknown) =>
        work({ orm, execute }),
    };
  },
}));

function line(sku: string, productName: string, quantity: number, pricePaise: number) {
  return {
    quantity,
    variant: { id: `variant-${sku}`, sku, pricePaise, product: { name: productName } },
  };
}

describe("CartService", () => {
  const service = new CartService();

  beforeEach(() => {
    Cart = fakeCollection();
    CartItem = fakeCollection();
    Variant = fakeCollection();
    steps = [];
    execute.mockClear();
  });

  describe("get", () => {
    it("answers an empty cart without making one", async () => {
      Cart.first.mockResolvedValue(null);

      await expect(service.get(USER_ID)).resolves.toEqual({ items: [], subtotalPaise: 0 });
      expect(Cart.filters).toEqual([{ userId: USER_ID }]);
      expect(Cart.create).not.toHaveBeenCalled();
    });

    it("prices each line and adds them up, sorted by product name then SKU", async () => {
      Cart.first.mockResolvedValue({
        id: CART_ID,
        items: [
          line("TEE-M", "Tee", 2, 49900),
          line("CAP-1", "Cap", 1, 19900),
          line("TEE-L", "Tee", 1, 52900),
        ],
      });

      const cart = await service.get(USER_ID);

      expect(cart.items.map((item) => item.sku)).toEqual(["CAP-1", "TEE-L", "TEE-M"]);
      expect(cart.items[2]).toEqual({
        variantId: "variant-TEE-M",
        productName: "Tee",
        sku: "TEE-M",
        quantity: 2,
        unitPricePaise: 49900,
        linePaise: 99800,
      });
      expect(cart.subtotalPaise).toBe(19900 + 52900 + 99800);
    });

    it("fails loudly on a line without its variant", async () => {
      Cart.first.mockResolvedValue({ id: CART_ID, items: [{ quantity: 1, variant: null }] });

      await expect(service.get(USER_ID)).rejects.toThrow(
        `cart ${CART_ID} has a line without its variant or product`,
      );
    });

    it("fails loudly on a variant without its product", async () => {
      Cart.first.mockResolvedValue({
        id: CART_ID,
        items: [{ quantity: 1, variant: { id: "v", sku: "S", pricePaise: 1, product: null } }],
      });

      await expect(service.get(USER_ID)).rejects.toThrow("without its variant or product");
    });
  });

  describe("addItem", () => {
    const stocked = { id: VARIANT_ID, inventory: [{ quantity: 3, reserved: 1 }] };

    // After the write, addItem answers with the whole cart through get.
    beforeEach(() => {
      Cart.first.mockResolvedValue({ id: CART_ID, items: [line("TEE-M", "Tee", 1, 49900)] });
    });

    it("locks the user first, so two adds by one user run one after the other", async () => {
      Variant.first.mockImplementation(() => {
        steps.push("read variant");
        return Promise.resolve(null);
      });

      await expect(
        service.addItem(USER_ID, { variantId: VARIANT_ID, quantity: 1 }),
      ).rejects.toThrow(NotFoundException);

      expect(steps).toEqual([
        `SELECT pg_advisory_xact_lock(hashtextextended($, 0)) ["${USER_ID}"]`,
        "read variant",
      ]);
    });

    it("answers 404 for an unknown variant, before touching the cart", async () => {
      Variant.first.mockResolvedValue(null);

      await expect(
        service.addItem(USER_ID, { variantId: VARIANT_ID, quantity: 1 }),
      ).rejects.toThrow(new NotFoundException("No variant with this id"));
      expect(Variant.filters).toEqual([{ id: VARIANT_ID }]);
      expect(Cart.create).not.toHaveBeenCalled();
      expect(CartItem.create).not.toHaveBeenCalled();
    });

    it("creates the cart and the line for a user with neither", async () => {
      Variant.first.mockResolvedValue(stocked);
      Cart.first.mockResolvedValueOnce(null);
      Cart.create.mockResolvedValue({ id: CART_ID });
      CartItem.first.mockResolvedValue(null);

      const cart = await service.addItem(USER_ID, { variantId: VARIANT_ID, quantity: 2 });

      // Carts made through the demo are removed by the nightly reset.
      expect(Cart.create).toHaveBeenCalledWith({ userId: USER_ID, createdByVisitor: true });
      expect(CartItem.filters).toEqual([{ cartId: CART_ID, variantId: VARIANT_ID }]);
      expect(CartItem.create).toHaveBeenCalledWith({
        cartId: CART_ID,
        variantId: VARIANT_ID,
        quantity: 2,
        createdByVisitor: true,
      });
      expect(cart.items).toHaveLength(1);
    });

    it("adds a new line to the cart the user already has", async () => {
      Variant.first.mockResolvedValue(stocked);
      Cart.first.mockResolvedValueOnce({ id: CART_ID });
      CartItem.first.mockResolvedValue(null);

      await service.addItem(USER_ID, { variantId: VARIANT_ID, quantity: 1 });

      expect(Cart.create).not.toHaveBeenCalled();
      expect(CartItem.create).toHaveBeenCalledWith({
        cartId: CART_ID,
        variantId: VARIANT_ID,
        quantity: 1,
        createdByVisitor: true,
      });
    });

    it("raises the quantity of the line already in the cart", async () => {
      Variant.first.mockResolvedValue(stocked);
      Cart.first.mockResolvedValueOnce({ id: CART_ID });
      CartItem.first.mockResolvedValue({ id: LINE_ID, quantity: 1 });

      await service.addItem(USER_ID, { variantId: VARIANT_ID, quantity: 1 });

      expect(CartItem.filters).toContainEqual({ id: LINE_ID });
      expect(CartItem.update).toHaveBeenCalledWith({ quantity: 2 });
      expect(CartItem.create).not.toHaveBeenCalled();
    });

    it("answers 409 for more than the stock on a new line", async () => {
      Variant.first.mockResolvedValue(stocked);
      Cart.first.mockResolvedValueOnce({ id: CART_ID });
      CartItem.first.mockResolvedValue(null);

      await expect(
        service.addItem(USER_ID, { variantId: VARIANT_ID, quantity: 3 }),
      ).rejects.toThrow(new ConflictException("Only 2 left"));
      expect(CartItem.create).not.toHaveBeenCalled();
    });

    it("answers 409 when the line already in the cart plus the new quantity is too many", async () => {
      Variant.first.mockResolvedValue(stocked);
      Cart.first.mockResolvedValueOnce({ id: CART_ID });
      CartItem.first.mockResolvedValue({ id: LINE_ID, quantity: 2 });

      await expect(
        service.addItem(USER_ID, { variantId: VARIANT_ID, quantity: 1 }),
      ).rejects.toThrow(new ConflictException("Only 2 left"));
      expect(CartItem.update).not.toHaveBeenCalled();
    });
  });
});
