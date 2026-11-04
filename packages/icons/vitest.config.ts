import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom gives the tests a DOM: DOMParser for the drawings, and rendering for the components.
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      reporter: ["text-summary", "lcov"],
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
    },
  },
});
