// Runs the visual tests in the Linux browser of the Playwright Docker image, on every
// machine and in CI, so screenshots never differ by OS. The tests themselves run here and
// drive that browser remotely. Extra arguments go to `playwright test`, e.g.
// `pnpm --filter @manasbal/ui test:visual --update-snapshots`.
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";

const require = createRequire(import.meta.url);
// The image and the test runner must be the same Playwright version.
const { version } = require("@playwright/test/package.json");
const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const container = `manasbal-visual-${process.pid}`;
const port = 3123;

const docker = (...args) => execFileSync("docker", args, { encoding: "utf8" });

function startBrowser() {
  // prettier-ignore
  docker(
    "run", "--detach", "--rm", "--init", "--name", container,
    "--publish", `127.0.0.1:${port}:3000`,
    // Lets the browser reach the Storybook server on this machine.
    "--add-host=host.docker.internal:host-gateway",
    "--user", "pwuser", "--workdir", "/home/pwuser",
    image,
    "/bin/sh", "-c", `npx -y playwright@${version} run-server --port 3000 --host 0.0.0.0`,
  );
}

async function waitForBrowser() {
  // The first run downloads the Playwright CLI inside the container, so allow a while.
  for (let i = 0; i < 180; i++) {
    if (docker("logs", container).includes("Listening on")) return;
    await sleep(1000);
  }
  throw new Error(`The Playwright server in ${container} didn't start within 3 minutes`);
}

let status = 1;
try {
  console.log(`Starting ${image}`);
  startBrowser();
  await waitForBrowser();
  const result = spawnSync(
    process.execPath,
    [require.resolve("@playwright/test/cli"), "test", ...process.argv.slice(2)],
    { stdio: "inherit", env: { ...process.env, PW_WS_ENDPOINT: `ws://127.0.0.1:${port}/` } },
  );
  status = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  try {
    docker("stop", container);
  } catch {
    // Already gone.
  }
}
process.exit(status);
