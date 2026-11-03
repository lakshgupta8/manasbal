import { describe, expect, it } from "vitest";
import { sessionListSchema } from "./sessions.js";

describe("sessionListSchema", () => {
  const session = {
    id: "0f1e2d3c-4b5a-4968-8776-655443322110",
    browser: "Firefox on Windows",
    startedAt: "2026-11-03T10:00:00Z",
    lastUsedAt: "2026-11-03T11:00:00Z",
    current: true,
  };

  it("describes the sessions list", () => {
    expect(sessionListSchema.parse([session])).toEqual([session]);
    expect(sessionListSchema.parse([])).toEqual([]);
  });

  it("refuses an entry without a valid id or flag", () => {
    expect(sessionListSchema.safeParse([{ ...session, id: "family-1" }]).success).toBe(false);
    expect(sessionListSchema.safeParse([{ ...session, current: "yes" }]).success).toBe(false);
  });
});
