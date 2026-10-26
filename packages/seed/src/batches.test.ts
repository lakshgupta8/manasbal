import { describe, expect, it, vi } from "vitest";
import { BATCH_SIZE, insertInBatches } from "./batches.ts";

describe("insertInBatches", () => {
  it("inserts in order, BATCH_SIZE rows at a time, and adds up the counts", async () => {
    const rows = Array.from({ length: BATCH_SIZE * 2 + 1 }, (_, i) => i);
    const insert = vi.fn(async (batch: number[]) => batch.length);

    await expect(insertInBatches(rows, insert)).resolves.toBe(rows.length);
    expect(insert.mock.calls.map(([batch]) => batch.length)).toEqual([BATCH_SIZE, BATCH_SIZE, 1]);
    expect(insert.mock.calls.flatMap(([batch]) => batch)).toEqual(rows);
  });

  it("sends nothing when there are no rows", async () => {
    const insert = vi.fn(async () => 0);

    await expect(insertInBatches([], insert)).resolves.toBe(0);
    expect(insert).not.toHaveBeenCalled();
  });
});
