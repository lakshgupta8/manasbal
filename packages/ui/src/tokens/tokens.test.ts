import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import colorJson from "../../tokens/color.json";
import pairsJson from "../../tokens/contrast-pairs.json";
import fontJson from "../../tokens/font.json";
import radiusJson from "../../tokens/radius.json";
import semanticJson from "../../tokens/semantic.json";
import spaceJson from "../../tokens/space.json";
import uiPairsJson from "../../tokens/ui-contrast-pairs.json";

type ColorToken = { $type: string; $value: string };
type ColorTokens = { color: Record<string, Record<string, ColorToken>> };

const tokens: ColorTokens = colorJson;
const pairs = pairsJson as [string, string][];

// base holds single colours (white); every other group is a ten-step scale.
const scales = Object.entries(tokens.color).filter(([scale]) => scale !== "base");
const expectedSteps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const colors = new Map<string, ColorToken>();
for (const [scale, steps] of Object.entries(tokens.color)) {
  for (const [step, token] of Object.entries(steps)) {
    colors.set(`color.${scale}.${step}`, token);
  }
}

function relativeLuminance(hex: string): number {
  const linear = (start: number) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("color tokens", () => {
  it.each([...colors])("%s has $type color and a #RRGGBB value", (_name, token) => {
    expect(token.$type).toBe("color");
    expect(token.$value).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe("colour scales", () => {
  it.each(scales)("%s has all ten steps", (_scale, stepTokens) => {
    const steps = Object.keys(stepTokens)
      .map(Number)
      .sort((a, b) => a - b);
    expect(steps).toEqual(expectedSteps);
  });
});

// A grey has red, green and blue almost equal (a slightly cool grey is fine); a step that drifts
// towards a hue, like the teal #12343B this scale once had, is named wrong.
describe("grey scale", () => {
  const greys = [...colors].filter(([name]) => name.startsWith("color.grey."));
  it.each(greys)("%s is a neutral grey", (_name, token) => {
    const [r, g, b] = [1, 3, 5].map((start) => parseInt(token.$value.slice(start, start + 2), 16));
    expect(Math.max(r!, g!, b!) - Math.min(r!, g!, b!)).toBeLessThanOrEqual(12);
  });
});

type SemanticToken = { $value: string; $extensions: { manasbal: { dark: string } } };
type Mode = "light" | "dark";

const semantic = new Map(
  collectTokens(semanticJson).map(([name, token]) => [name, token as unknown as SemanticToken]),
);
const alias = (value: string) => /^\{(.+)\}$/.exec(value)?.[1];

// The hex value a colour name has in a theme. A meaning-layer name points at a plain colour, which
// is the same in both themes.
function resolve(name: string, mode: Mode): string {
  const meaning = semantic.get(name);
  if (meaning) {
    const target = mode === "light" ? meaning.$value : meaning.$extensions.manasbal.dark;
    return resolve(alias(target) ?? target, mode);
  }
  const plain = colors.get(name);
  if (!plain) {
    throw new Error(`Unknown colour: ${name}`);
  }
  return plain.$value;
}

const modes: Mode[] = ["light", "dark"];
const inBothModes = (list: [string, string][]) =>
  list.flatMap(([a, b]) => modes.map((mode) => [a, b, mode] as const));

describe("contrast pairs", () => {
  it.each(inBothModes(pairs))("%s on %s reaches 4.5:1 (%s)", (nameA, nameB, mode) => {
    expect(contrastRatio(resolve(nameA, mode), resolve(nameB, mode))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(inBothModes(uiPairsJson as [string, string][]))(
    "%s on %s reaches 3:1 for a control or brand edge (%s)",
    (nameA, nameB, mode) => {
      expect(contrastRatio(resolve(nameA, mode), resolve(nameB, mode))).toBeGreaterThanOrEqual(3);
    },
  );

  it("refuses an unknown colour name", () => {
    expect(() => resolve("color.nope", "light")).toThrow("Unknown colour: color.nope");
  });
});

describe("meaning layer", () => {
  it.each([...semantic])("%s points at a plain colour in light and dark", (_name, token) => {
    for (const value of [token.$value, token.$extensions.manasbal.dark]) {
      const target = alias(value);
      expect(target).toBeDefined();
      expect(colors.has(target!)).toBe(true);
    }
  });
});

type Token = { $type?: unknown; $value: unknown };

// Every token in a DTCG file: an object with a $value. Keys starting with $ (like a group's
// $description) are not tokens or groups.
function collectTokens(group: object, path: string[] = []): [string, Token][] {
  return Object.entries(group)
    .filter(([key]) => !key.startsWith("$"))
    .flatMap(([key, child]: [string, object]) =>
      "$value" in child
        ? [[[...path, key].join("."), child as Token]]
        : collectTokens(child, [...path, key]),
    );
}

const allTokens = [colorJson, semanticJson, spaceJson, fontJson, radiusJson].flatMap((file) =>
  collectTokens(file),
);
const px = (value: string) => Number(/^(\d+)px$/.exec(value)?.[1] ?? Number.NaN);

describe("every token", () => {
  it.each(allTokens)("%s has a $type", (_name, token) => {
    expect(token.$type).toEqual(expect.any(String));
  });

  it("has a unique name", () => {
    const names = allTokens.map(([name]) => name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(allTokens.filter(([, token]) => token.$type === "dimension"))(
    "%s is a whole number of px",
    (_name, token) => {
      expect(token.$value).toMatch(/^\d+px$/);
    },
  );
});

describe("space tokens", () => {
  it.each(Object.entries(spaceJson.space).filter(([key]) => !key.startsWith("$")))(
    "space.%s is a multiple of 4 and its name times 4",
    (step, token) => {
      const size = px((token as Token).$value as string);
      expect(size % 4).toBe(0);
      expect(size).toBe(Number(step) * 4);
    },
  );
});

describe("type tokens", () => {
  const { size, "line-height": lineHeight } = fontJson.font;

  it("heading sizes get smaller from heading 1 to heading 4", () => {
    const headings = [1, 2, 3, 4].map((level) =>
      px(size[`heading-${level}` as keyof typeof size].$value),
    );
    expect(headings).toEqual([...headings].sort((a, b) => b - a));
    expect(new Set(headings).size).toBe(4);
  });

  it.each(Object.keys(size) as (keyof typeof size)[])(
    "%s has a line height on the 4px grid, at least as tall as the text",
    (name) => {
      const height = px(lineHeight[name].$value);
      expect(height % 4).toBe(0);
      expect(height).toBeGreaterThanOrEqual(px(size[name].$value));
    },
  );

  it("names the font licence", () => {
    expect(fontJson.font.family.sans.$description).toContain("SIL Open Font License");
  });
});

describe("theme.css", () => {
  it("is what the tokens build today (run `pnpm --filter @manasbal/ui tokens` after changing a token)", () => {
    const packageDir = path.resolve(import.meta.dirname, "../..");
    const outDir = mkdtempSync(path.join(tmpdir(), "manasbal-theme-"));
    try {
      execFileSync(process.execPath, ["style-dictionary.config.mjs"], {
        cwd: packageDir,
        env: { ...process.env, TOKENS_OUT_DIR: outDir },
      });
      const fresh = readFileSync(path.join(outDir, "theme.css"), "utf8");
      const committed = readFileSync(path.join(packageDir, "src/theme.css"), "utf8");
      // A Windows checkout may turn the committed file's line endings into CRLF.
      expect(committed.replaceAll("\r\n", "\n")).toBe(fresh);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
