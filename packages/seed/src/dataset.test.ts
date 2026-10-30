import { describe, expect, it, vi } from "vitest";
import { generateDataset, insertDataset, MARKER_NAME, rowsByTable } from "./dataset.ts";
import { PROFILES } from "./profiles.ts";
import { REFERENCE_DATE } from "./random.ts";
import { contractTables } from "./reset.ts";

const data = generateDataset(PROFILES.minimal);

describe("generateDataset", () => {
  it("ends with the demo marker, dated the reference day", () => {
    expect(data.marker.name).toBe(MARKER_NAME);
    expect(data.marker.createdAt.epochMilliseconds).toBe(Date.parse(REFERENCE_DATE));
  });

  it("makes the same data on every run", () => {
    expect(generateDataset(PROFILES.minimal)).toEqual(data);
  });

  it("counts rows for every table the seed writes, all of them in the contract", () => {
    const tables = Object.keys(rowsByTable(data));

    expect(tables.every((table) => contractTables().includes(table))).toBe(true);
    expect(rowsByTable(data)["_demo_marker"]).toEqual([data.marker]);
  });
});

describe("insertDataset", () => {
  it("writes every table, with settlements after orders and the marker last", async () => {
    const calls: string[] = [];
    const table = (name: string) => ({
      createAndCount: vi.fn(async (batch: unknown[]) => {
        calls.push(name);
        return batch.length;
      }),
    });
    const names = [
      "User",
      "Seller",
      "Address",
      "Category",
      "Product",
      "Variant",
      "Inventory",
      "Coupon",
      "Order",
      "SubOrder",
      "OrderItem",
      "Payment",
      "Review",
      "Settlement",
      "DemoMarker",
    ];
    const orm = { public: Object.fromEntries(names.map((name) => [name, table(name)])) };

    // The demo profile, so every table has rows to write.
    const demo = generateDataset(PROFILES.demo);
    await insertDataset(orm as unknown as Parameters<typeof insertDataset>[0], demo);

    expect(calls.at(-1)).toBe("DemoMarker");
    expect(calls.indexOf("Settlement")).toBeGreaterThan(calls.lastIndexOf("Order"));
    expect(new Set(calls)).toEqual(new Set(names));
  });
});
