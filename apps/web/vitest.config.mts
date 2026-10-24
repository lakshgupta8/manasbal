import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/components/**/*.tsx", "src/app/page.tsx"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      reporter: ["text-summary", "lcov"],
      // CI gate: coverage never drops below 60%.
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
    },
  },
});
