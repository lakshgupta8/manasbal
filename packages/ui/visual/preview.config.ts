import { defineConfig } from "vite";

// Serves the built Storybook to the Docker browser, which reaches this machine as
// host.docker.internal; Vite blocks unknown host names unless they're listed.
export default defineConfig({
  build: { outDir: "storybook-static" },
  preview: {
    host: "0.0.0.0",
    port: 6006,
    strictPort: true,
    allowedHosts: ["host.docker.internal"],
  },
});
