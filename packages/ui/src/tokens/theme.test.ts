// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TransformedToken } from "style-dictionary/types";
import { describe, expect, it } from "vitest";
import config, { buildTheme, tailwindName, themeCss } from "../../style-dictionary.config";

const packageDir = path.resolve(import.meta.dirname, "../..");

describe("theme.css", () => {
  it("is what the tokens build today (run `pnpm --filter @manasbal/ui tokens` after changing a token)", async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), "manasbal-theme-"));
    try {
      await buildTheme(outDir);
      const fresh = readFileSync(path.join(outDir, "theme.css"), "utf8");
      const committed = readFileSync(path.join(packageDir, "src/theme.css"), "utf8");
      // A Windows checkout may turn the committed file's line endings into CRLF.
      expect(committed.replaceAll("\r\n", "\n")).toBe(fresh);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("is what the CLI config writes into src", () => {
    expect(config.platforms?.css?.buildPath).toBe(path.join(packageDir, "src") + path.sep);
  });
});

describe("tailwindName", () => {
  it.each([
    [["color", "lake", "600"], "--color-lake-600"],
    [["space", "4"], "--spacing-4"],
    [["radius", "md"], "--radius-md"],
    [["font", "family", "sans"], "--font-sans"],
    [["font", "weight", "bold"], "--font-weight-bold"],
    [["font", "size", "heading-1"], "--text-heading-1"],
    [["font", "line-height", "body"], "--text-body--line-height"],
  ])("maps %j to %s", (tokenPath, expected) => {
    expect(tailwindName(tokenPath)).toBe(expected);
  });

  it("refuses a token Tailwind has no place for", () => {
    expect(() => tailwindName(["shadow", "sm"])).toThrow("No Tailwind name for token shadow.sm");
  });
});

describe("themeCss", () => {
  it("refuses an alias to a token that does not exist", () => {
    const token = {
      name: "mb-color-text-default",
      path: ["color", "text", "default"],
      $value: "{color.nope}",
      original: { $value: "{color.nope}" },
    } as unknown as TransformedToken;
    expect(() => themeCss([token])).toThrow("Unknown token in alias {color.nope}");
  });
});
