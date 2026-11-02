import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    setupFiles: ["./test/support/temporal.ts"],
    // Signs and checks access tokens in tests; any value works, it never leaves the test run.
    env: { JWT_SECRET: "test-only-secret-0123456789abcdef" },
    root: "./",
    include: ["**/*.e2e-spec.ts"],
  },
});
