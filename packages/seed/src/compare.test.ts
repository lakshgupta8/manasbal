import { describe, expect, it, vi } from "vitest";
import { dumpTables, firstDifference, type Dump } from "./compare.ts";
import { contractTables } from "./reset.ts";

const dump = (): Dump => ({
  orders: [
    { id: "a", total_paise: 100 },
    { id: "b", total_paise: 200 },
  ],
  users: [{ id: "u", name: "Asha" }],
});

describe("dumpTables", () => {
  it("reads every contract table in id order, as JSON", async () => {
    const query = vi.fn(async (statement: string) =>
      statement.includes('"orders"') ? '[{"id":"a"}]' : "[]",
    );

    const result = await dumpTables(query);

    expect(Object.keys(result)).toEqual(contractTables());
    expect(result["orders"]).toEqual([{ id: "a" }]);
    expect(result["users"]).toEqual([]);
    expect(query).toHaveBeenCalledWith(
      `SELECT coalesce(json_agg(t ORDER BY t.id), '[]') FROM "orders" t`,
    );
  });
});

describe("firstDifference", () => {
  it("finds nothing in identical dumps", () => {
    expect(firstDifference(dump(), dump())).toBeNull();
  });

  it("reports the table and row of a changed value", () => {
    const changed = dump();
    changed["orders"]![1] = { id: "b", total_paise: 201 };

    expect(firstDifference(dump(), changed)).toEqual({
      table: "orders",
      index: 1,
      left: { id: "b", total_paise: 200 },
      right: { id: "b", total_paise: 201 },
    });
  });

  it("reports a missing row on either side", () => {
    const shorter = dump();
    shorter["orders"]!.pop();

    expect(firstDifference(dump(), shorter)).toMatchObject({ index: 1, right: null });
    expect(firstDifference(shorter, dump())).toMatchObject({ index: 1, left: null });
  });

  it("reports a table missing from one dump", () => {
    const { users: _users, ...noUsers } = dump();

    expect(firstDifference(dump(), noUsers)).toMatchObject({ table: "users", index: 0 });
    expect(firstDifference(noUsers, dump())).toMatchObject({ table: "users", left: null });
  });
});
