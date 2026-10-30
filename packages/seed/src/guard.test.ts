import { describe, expect, it, vi } from "vitest";
import { assertResetAllowed, hasMarker } from "./guard.ts";

// The guard, then the step it protects: the step must only run when the guard passes.
function guarded(env: NodeJS.ProcessEnv, marker: boolean) {
  const lookup = vi.fn(async () => marker);
  const wipe = vi.fn();
  const run = assertResetAllowed(env, lookup).then(wipe);
  return { run, lookup, wipe };
}

describe("assertResetAllowed", () => {
  it("allows the reset with the flag and the marker", async () => {
    const { run, wipe } = guarded({ SEED_ALLOW_RESET: "true" }, true);

    await run;
    expect(wipe).toHaveBeenCalled();
  });

  it("refuses without the flag, before looking at the database", async () => {
    for (const marker of [true, false]) {
      const { run, lookup, wipe } = guarded({}, marker);

      await expect(run).rejects.toThrow("Refusing to reset: set SEED_ALLOW_RESET=true");
      expect(lookup).not.toHaveBeenCalled();
      expect(wipe).not.toHaveBeenCalled();
    }
  });

  it("refuses a flag set to anything but true", async () => {
    const { run, wipe } = guarded({ SEED_ALLOW_RESET: "1" }, true);

    await expect(run).rejects.toThrow("set SEED_ALLOW_RESET=true");
    expect(wipe).not.toHaveBeenCalled();
  });

  it("refuses with the flag but no marker", async () => {
    const { run, wipe } = guarded({ SEED_ALLOW_RESET: "true" }, false);

    await expect(run).rejects.toThrow("this database has no _demo_marker row");
    expect(wipe).not.toHaveBeenCalled();
  });
});

describe("hasMarker", () => {
  const orm = (first: () => Promise<unknown>) =>
    ({
      public: { DemoMarker: { select: vi.fn(() => ({ first })) } },
    }) as unknown as Parameters<typeof hasMarker>[0];

  it("finds the marker row", async () => {
    await expect(hasMarker(orm(async () => ({ id: "m" })))).resolves.toBe(true);
  });

  it("reports no marker when the table is empty", async () => {
    await expect(hasMarker(orm(async () => null))).resolves.toBe(false);
  });

  it("reports no marker when the table doesn't exist yet", async () => {
    const missing = async () => {
      throw new Error('relation "_demo_marker" does not exist');
    };
    await expect(hasMarker(orm(missing))).resolves.toBe(false);
  });
});
