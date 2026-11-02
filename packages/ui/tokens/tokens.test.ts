import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type ColorToken = { $type: string; $value: string };
type ColorTokens = { color: Record<string, Record<string, ColorToken>> };

const readJson = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), "utf8")) as T;

const tokens = readJson<ColorTokens>("color.json");
const pairs = readJson<[string, string][]>("contrast-pairs.json");

const scales = Object.entries(tokens.color);
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

describe("contrast pairs", () => {
  it.each(pairs)("%s on %s reaches a 4.5:1 contrast ratio", (nameA, nameB) => {
    const a = colors.get(nameA);
    const b = colors.get(nameB);
    if (!a || !b) {
      throw new Error(`Unknown colour in pair: ${nameA}, ${nameB}`);
    }
    expect(contrastRatio(a.$value, b.$value)).toBeGreaterThanOrEqual(4.5);
  });
});
