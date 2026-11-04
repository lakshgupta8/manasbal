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
    // next-intl imports "next/server" without a file extension, which only a bundler resolves.
    server: { deps: { inline: ["next-intl"] } },
    coverage: {
      provider: "v8",
      include: [
        "src/lib/**/*.ts",
        "src/i18n/**/*.ts",
        "src/proxy.ts",
        "src/components/**/*.tsx",
        // The brackets are literal, not a glob character class.
        String.raw`src/app/\[locale\]/**/*.tsx`,
      ],
      exclude: ["src/**/*.test.{ts,tsx}"],
      reporter: ["text-summary", "lcov"],
      // CI gate: coverage never drops below 60%.
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
    },
  },
});
