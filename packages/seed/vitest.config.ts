import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Several tests build the whole demo profile (6,000 orders), which takes 5-15 s on a CI
    // runner under coverage, more than Vitest's 5 s default.
    testTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text-summary", "lcov"],
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
    },
  },
});
