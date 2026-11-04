import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom gives the tests a DOMParser to read each SVG as XML.
    environment: "jsdom",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text-summary", "lcov"],
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
    },
  },
});
