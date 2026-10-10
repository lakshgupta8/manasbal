import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.tsx"],
      exclude: ["src/**/*.stories.tsx", "src/**/*.test.tsx"],
      reporter: ["text-summary", "lcov", "json-summary"],
      // CI gate: coverage never drops below 60%.
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
    },
  },
});
