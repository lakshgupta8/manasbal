import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: "./",
    include: ["**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Bootstrap code is covered by the e2e suite, not unit tests.
      exclude: ["src/main.ts", "src/**/*.spec.ts"],
      reporter: ["text-summary", "lcov", "json-summary"],
      // CI gate: coverage never drops below 60%.
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
    },
  },
});
