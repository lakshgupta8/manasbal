import { expect, it, vi } from "vitest";
import { createDb } from "./db.ts";
import { migrateDatabase, reset } from "./reset.ts";

vi.mock("./db.ts", () => ({ createDb: vi.fn(() => ({ fake: "client" })) }));
vi.mock("./reset.ts", () => ({
  reset: vi.fn(async () => undefined),
  migrateDatabase: vi.fn(),
}));

it("resets with the command-line arguments, connecting and migrating only when asked", async () => {
  vi.spyOn(process, "argv", "get").mockReturnValue(["node", "reset-cli.ts", "--dry-run"]);

  await import("./reset-cli.ts");

  const [args, deps] = vi.mocked(reset).mock.calls[0]!;
  expect(args).toEqual(["--dry-run"]);
  expect(deps.env).toBe(process.env);
  expect(createDb).not.toHaveBeenCalled();
  expect(migrateDatabase).not.toHaveBeenCalled();

  expect(deps.connect()).toEqual({ fake: "client" });
  expect(createDb).toHaveBeenCalledWith();
  deps.migrate();
  expect(migrateDatabase).toHaveBeenCalledWith();
});
