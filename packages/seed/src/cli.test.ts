import { expect, it, vi } from "vitest";
import { createDb } from "./db.ts";
import { seed } from "./seed.ts";

vi.mock("./db.ts", () => ({ createDb: vi.fn(() => ({ fake: "client" })) }));
vi.mock("./seed.ts", () => ({ seed: vi.fn(async () => undefined) }));

it("seeds with the command-line arguments and a client from DATABASE_URL", async () => {
  vi.spyOn(process, "argv", "get").mockReturnValue(["node", "cli.ts", "--profile", "demo"]);

  await import("./cli.ts");

  expect(createDb).toHaveBeenCalledWith();
  expect(seed).toHaveBeenCalledWith(["--profile", "demo"], { fake: "client" });
});
