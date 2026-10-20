import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  decodeCursor,
  encodeCursor,
  parsePageQuery,
  toPage,
} from "./pagination.js";

const keyOf = (row: { id: string }) => row.id;
const rows = (...ids: string[]) => ids.map((id) => ({ id }));

describe("cursor", () => {
  it("round-trips a key", () => {
    expect(decodeCursor(encodeCursor("cat_42"))).toBe("cat_42");
  });

  it.each(["", "***", "abc=", "!!"])("rejects %j", (bad) => {
    expect(() => decodeCursor(bad)).toThrow(BadRequestException);
  });
});

describe("parsePageQuery", () => {
  it("defaults to the first page", () => {
    expect(parsePageQuery({})).toEqual({
      after: undefined,
      limit: DEFAULT_LIMIT,
      take: DEFAULT_LIMIT + 1,
    });
  });

  it("reads cursor and limit", () => {
    const params = parsePageQuery({ cursor: encodeCursor("a"), limit: "5" });
    expect(params).toEqual({ after: "a", limit: 5, take: 6 });
  });

  it("accepts the maximum limit", () => {
    expect(parsePageQuery({ limit: String(MAX_LIMIT) }).limit).toBe(MAX_LIMIT);
  });

  it.each(["0", "101", "-1", "2.5", "ten", ""])("rejects limit %j", (limit) => {
    expect(() => parsePageQuery({ limit })).toThrow(BadRequestException);
  });

  it("rejects a bad cursor", () => {
    expect(() => parsePageQuery({ cursor: "***" })).toThrow(BadRequestException);
  });
});

describe("toPage", () => {
  const params = parsePageQuery({ limit: "2" });

  it("returns nextCursor when there is another row", () => {
    const page = toPage(rows("a", "b", "c"), params, keyOf);
    expect(page.items).toEqual(rows("a", "b"));
    expect(page.nextCursor && decodeCursor(page.nextCursor)).toBe("b");
  });

  it("returns null on the last page", () => {
    expect(toPage(rows("a", "b"), params, keyOf)).toEqual({
      items: rows("a", "b"),
      nextCursor: null,
    });
  });

  it("handles an empty result", () => {
    expect(toPage([], params, keyOf)).toEqual({ items: [], nextCursor: null });
  });
});
