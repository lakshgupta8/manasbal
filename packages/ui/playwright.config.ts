import { defineConfig } from "@playwright/test";

// Set by scripts/visual.mjs, which starts the Docker browser (see visual/stories.spec.ts).
const wsEndpoint = process.env.PW_WS_ENDPOINT;

const port = 6006; // matches visual/preview.config.ts

export default defineConfig({
  testDir: "visual",
  // Every screenshot comes from the same Linux browser, so one baseline per story is enough.
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  // Rendering in one container is deterministic, so even a slight colour change should
  // fail; Playwright's default per-pixel tolerance (0.2) lets small shifts through.
  expect: { toHaveScreenshot: { threshold: 0.01 } },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    // The browser runs in Docker, so it reaches this machine's server by the host alias.
    baseURL: `http://host.docker.internal:${port}`,
    connectOptions: wsEndpoint ? { wsEndpoint } : undefined,
  },
  webServer: {
    command: "vite preview --config visual/preview.config.ts",
    url: `http://127.0.0.1:${port}/index.json`,
    reuseExistingServer: !process.env.CI,
  },
});
