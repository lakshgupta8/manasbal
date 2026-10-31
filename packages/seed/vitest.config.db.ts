import { defineConfig } from "vitest/config";

// Tests against a real, throwaway Postgres (needs Docker). Not named e2e, so Turbo's e2e step
// doesn't run them a second time.
export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    root: "./",
    include: ["test/**/*.db-spec.ts"],
    // Starting the container and applying every migration takes a while on a cold machine.
    hookTimeout: 180_000,
    testTimeout: 120_000,
  },
});
