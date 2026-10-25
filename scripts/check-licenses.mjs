// Fails if a production dependency is under a licence that would force Manasbal off
// Apache-2.0 onto a copyleft licence (GPL, AGPL, SSPL). LGPL is allowed: it only covers the library
// itself when used as a separate, linked component (e.g. libvips inside sharp).
// Run through pnpm (`pnpm check:licenses`), which provides npm_execpath.
import { execFileSync } from "node:child_process";

const DENY = /^(A?GPL|SSPL)-/i;
// Packages reviewed by hand and accepted despite an unclear licence: { name: "reason" }.
const EXCEPTIONS = {};

const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run this through pnpm: pnpm check:licenses");
// pnpm 12 is a native binary; older versions are a JavaScript file that Node has to run.
const [command, ...prefix] = /\.[cm]?js$/.test(pnpm) ? [process.execPath, pnpm] : [pnpm];
const report = JSON.parse(
  execFileSync(command, [...prefix, "licenses", "list", "--prod", "--json", "--recursive"], {
    encoding: "utf8",
  }),
);

// Minimal SPDX evaluation: "A OR B" passes if either side passes, "A AND B" only if both do.
const allowedId = (id) => !DENY.test(id) && id.toLowerCase() !== "unknown";
const allowed = (expr) => {
  const groups = [[]];
  for (const token of expr.replaceAll("(", " ").replaceAll(")", " ").split(" ")) {
    if (!token || token.toUpperCase() === "AND") continue;
    if (token.toUpperCase() === "OR") groups.push([]);
    else groups.at(-1).push(token);
  }
  return groups.some((ids) => ids.length > 0 && ids.every(allowedId));
};

const problems = [];
let count = 0;
for (const [licence, packages] of Object.entries(report)) {
  for (const pkg of packages) {
    count++;
    if (pkg.name.startsWith("@manasbal/") || pkg.name in EXCEPTIONS) continue;
    if (!allowed(licence)) problems.push(`${pkg.name}@${pkg.versions.join(",")}: ${licence}`);
  }
}

if (problems.length) {
  console.error(`Disallowed licences in production dependencies:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`Licence check passed: ${count} production packages.`);
