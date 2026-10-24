import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    setupFiles: ["./test/support/temporal.ts"],
    root: "./",
    include: ["**/*.e2e-spec.ts"],
  },
});
