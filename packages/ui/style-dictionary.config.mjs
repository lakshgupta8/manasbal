// Builds src/theme.css from the design tokens: `pnpm --filter @manasbal/ui tokens`.
// TOKENS_OUT_DIR builds somewhere else (the tests use it to compare a fresh build with the committed file).
import path from "node:path";
import StyleDictionary from "style-dictionary";

const here = import.meta.dirname;
const outDir = process.env.TOKENS_OUT_DIR ?? path.join(here, "src");
const PREFIX = "mb";
const HEADER =
  "/* Generated from packages/ui/tokens by `pnpm --filter @manasbal/ui tokens`. Do not edit. */";

// The Tailwind v4 theme variable each token feeds, so `bg-lake-600`, `p-4` or `text-heading-1` work.
export function tailwindName(tokenPath) {
  const [group, kind, ...rest] = tokenPath;
  if (group === "color") return `--color-${[kind, ...rest].join("-")}`;
  if (group === "space") return `--spacing-${kind}`;
  if (group === "radius") return `--radius-${kind}`;
  if (group === "font" && kind === "family") return `--font-${rest.join("-")}`;
  if (group === "font" && kind === "weight") return `--font-weight-${rest.join("-")}`;
  if (group === "font" && kind === "size") return `--text-${rest.join("-")}`;
  if (group === "font" && kind === "line-height") return `--text-${rest.join("-")}--line-height`;
  throw new Error(`No Tailwind name for token ${tokenPath.join(".")}`);
}

function themeFormat({ dictionary }) {
  const byPath = new Map(dictionary.allTokens.map((token) => [token.path.join("."), token]));
  // "{color.lake.900}" -> "var(--mb-color-lake-900)"; an alias to a missing token fails the build.
  const toVar = (value) =>
    value.replaceAll(/\{([^}]+)\}/g, (_match, ref) => {
      const target = byPath.get(ref);
      if (!target) throw new Error(`Unknown token in alias {${ref}}`);
      return `var(--${target.name})`;
    });
  const valueOf = (token) =>
    typeof token.original.$value === "string" && token.original.$value.includes("{")
      ? toVar(token.original.$value)
      : token.$value;

  const light = dictionary.allTokens.map((token) => `  --${token.name}: ${valueOf(token)};`);
  const dark = dictionary.allTokens
    .filter((token) => token.original.$extensions?.manasbal?.dark)
    .map((token) => `    --${token.name}: ${toVar(token.original.$extensions.manasbal.dark)};`);
  const tailwind = dictionary.allTokens.map(
    (token) => `  ${tailwindName(token.path)}: var(--${token.name});`,
  );

  return [
    HEADER,
    "",
    ":root {",
    ...light,
    "}",
    "",
    "@media (prefers-color-scheme: dark) {",
    "  :root {",
    ...dark,
    "  }",
    "}",
    "",
    "/* Tailwind CSS v4 reads this block; browsers ignore it. */",
    "@theme inline {",
    ...tailwind,
    "}",
    "",
  ].join("\n");
}

const config = {
  source: ["color", "space", "font", "radius", "semantic"].map((name) =>
    path.join(here, "tokens", `${name}.json`),
  ),
  log: { verbosity: "silent" },
  hooks: { formats: { "manasbal/theme": themeFormat } },
  platforms: {
    css: {
      transforms: ["name/kebab", "fontFamily/css"],
      prefix: PREFIX,
      buildPath: `${outDir}${path.sep}`,
      files: [{ destination: "theme.css", format: "manasbal/theme" }],
    },
  },
};

export default config;

if (process.argv[1] === import.meta.filename) {
  await new StyleDictionary(config).buildAllPlatforms();
}
