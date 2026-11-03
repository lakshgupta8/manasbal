import { describe, expect, it } from "vitest";
import colorJson from "../../tokens/color.json";
import pairsJson from "../../tokens/contrast-pairs.json";

type ColorToken = { $type: string; $value: string };
type ColorTokens = { color: Record<string, Record<string, ColorToken>> };

const tokens: ColorTokens = colorJson;
const pairs = pairsJson as [string, string][];

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

// A grey has red, green and blue almost equal (a slightly cool grey is fine); a step that drifts
// towards a hue, like the teal #12343B this scale once had, is named wrong.
describe("grey scale", () => {
  const greys = [...colors].filter(([name]) => name.startsWith("color.grey."));
  it.each(greys)("%s is a neutral grey", (_name, token) => {
    const [r, g, b] = [1, 3, 5].map((start) => parseInt(token.$value.slice(start, start + 2), 16));
    expect(Math.max(r!, g!, b!) - Math.min(r!, g!, b!)).toBeLessThanOrEqual(12);
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
