// Builds src/theme.css from the design tokens: `pnpm --filter @manasbal/ui tokens`.
import path from "node:path";
import StyleDictionary from "style-dictionary";
import type { Config, TransformedToken } from "style-dictionary/types";

const HEADER =
  "/* Generated from packages/ui/tokens by `pnpm --filter @manasbal/ui tokens`. Do not edit. */";

type ManasbalExtensions = { manasbal?: { dark?: string } };

// The Tailwind v4 theme variable each token feeds, so `bg-lake-600`, `p-4` or `text-heading-1` work.
export function tailwindName(tokenPath: string[]): string {
  const [group, kind, ...rest] = tokenPath;
  const name = rest.join("-");
  if (group === "color") return `--color-${[kind, ...rest].join("-")}`;
  if (group === "space") return `--spacing-${kind}`;
  if (group === "radius") return `--radius-${kind}`;
  if (group === "font" && kind === "family") return `--font-${name}`;
  if (group === "font" && kind === "weight") return `--font-weight-${name}`;
  if (group === "font" && kind === "size") return `--text-${name}`;
  if (group === "font" && kind === "line-height") return `--text-${name}--line-height`;
  throw new Error(`No Tailwind name for token ${tokenPath.join(".")}`);
}

// :root with every token (meaning-layer names point at plain ones), the dark meaning layer, and
// the Tailwind theme block.
export function themeCss(tokens: TransformedToken[]): string {
  const byPath = new Map(tokens.map((token) => [token.path.join("."), token]));
  // "{color.lake.900}" -> "var(--mb-color-lake-900)"; an alias to a missing token fails the build.
  const toVar = (value: string) =>
    value.replaceAll(/\{([^}]+)\}/g, (_match, ref: string) => {
      const target = byPath.get(ref);
      if (!target) throw new Error(`Unknown token in alias {${ref}}`);
      return `var(--${target.name})`;
    });
  const valueOf = (token: TransformedToken) => {
    const original: unknown = token.original.$value;
    return typeof original === "string" && original.includes("{")
      ? toVar(original)
      : String(token.$value);
  };
  const darkOf = (token: TransformedToken) =>
    (token.original.$extensions as ManasbalExtensions | undefined)?.manasbal?.dark;

  const light = tokens.map((token) => `  --${token.name}: ${valueOf(token)};`);
  const dark = tokens.flatMap((token) => {
    const value = darkOf(token);
    return value ? [`    --${token.name}: ${toVar(value)};`] : [];
  });
  const tailwind = tokens.map((token) => `  ${tailwindName(token.path)}: var(--${token.name});`);

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

const tokenFiles = ["color", "space", "font", "radius", "semantic"];

export function themeConfig(outDir: string): Config {
  return {
    source: tokenFiles.map((name) => path.join(import.meta.dirname, "tokens", `${name}.json`)),
    log: { verbosity: "silent" },
    hooks: { formats: { "manasbal/theme": ({ dictionary }) => themeCss(dictionary.allTokens) } },
    platforms: {
      css: {
        transforms: ["name/kebab", "fontFamily/css"],
        prefix: "mb",
        buildPath: `${outDir}${path.sep}`,
        files: [{ destination: "theme.css", format: "manasbal/theme" }],
      },
    },
  };
}

/** Writes theme.css into outDir. */
export async function buildTheme(outDir: string): Promise<void> {
  await new StyleDictionary(themeConfig(outDir)).buildAllPlatforms();
}

// The Style Dictionary CLI (`style-dictionary build --config ...`) reads this.
export default themeConfig(path.join(import.meta.dirname, "src"));
