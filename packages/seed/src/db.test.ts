import postgres from "@prisma/orm-postgres/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import contractJson from "../../../apps/api/src/prisma/contract.json" with { type: "json" };
import { createDb } from "./db.ts";

vi.mock("@prisma/orm-postgres/runtime", () => ({ default: vi.fn(() => ({ fake: "client" })) }));

describe("createDb", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the client from the API's contract and the given URL", () => {
    expect(createDb("postgresql://localhost/seed")).toEqual({ fake: "client" });
    expect(postgres).toHaveBeenCalledWith({ contractJson, url: "postgresql://localhost/seed" });
  });

  it("reads DATABASE_URL when no URL is given", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/from-env");
    createDb();

    expect(postgres).toHaveBeenLastCalledWith({
      contractJson,
      url: "postgresql://localhost/from-env",
    });
  });

  it("refuses to start without a database URL", () => {
    vi.stubEnv("DATABASE_URL", "");

    expect(() => createDb()).toThrow("DATABASE_URL is not set");
  });
});
