import contract from "./contract.json" with { type: "json" };

// Tables a visitor can write to, directly or as a side effect. The nightly reset deletes their
// created_by_visitor rows and re-seeds the is_sample ones, so each needs both columns.
const DEMO_TABLES = [
  "users",
  "sellers",
  "products",
  "variants",
  "inventory",
  "addresses",
  "carts",
  "cart_items",
  "orders",
  "sub_orders",
  "order_items",
  "payments",
  "shipments",
  "settlements",
  "reviews",
  "audit_logs",
];
// Written only by the seed or an admin.
const SEED_ONLY = ["categories", "coupons"];

const tables: Record<string, { columns: Record<string, unknown> }> =
  contract.storage.namespaces.public.entries.table;

describe("demo-data flags", () => {
  it.each(DEMO_TABLES)("%s has is_sample and created_by_visitor, both false by default", (name) => {
    const columns = tables[name]?.columns;

    for (const flag of ["is_sample", "created_by_visitor"]) {
      expect(columns?.[flag], `${name}.${flag}`).toMatchObject({
        dataType: "pg/bool",
        nullable: false,
        default: { kind: "literal", value: false },
      });
    }
  });

  it("lists every table as either demo or seed-only", () => {
    expect(Object.keys(tables).sort()).toEqual([...DEMO_TABLES, ...SEED_ONLY].sort());
  });
});
