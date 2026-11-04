import { composeStories } from "@storybook/react-vite";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import colorJson from "../../tokens/color.json";
import fontJson from "../../tokens/font.json";
import radiusJson from "../../tokens/radius.json";
import semanticJson from "../../tokens/semantic.json";
import spaceJson from "../../tokens/space.json";
import { flattenTokens, resolveAlias } from "./TokenPreview";
import * as stories from "./Tokens.stories";

const { Colours, Spacing, Type, Radius } = composeStories(stories);

// The text of the item that names a token, so its name and value can be checked together.
const shown = (name: string) =>
  screen.getAllByText(name, { selector: "code" }).map((code) => code.parentElement?.textContent);

describe("flattenTokens", () => {
  it("walks nested groups, skips $ metadata and keeps a dark value", () => {
    const group = {
      $description: "not a token",
      a: { b: { $type: "color", $value: "#000000" } },
      c: { $value: "{a.b}", $extensions: { manasbal: { dark: "{a.b}" } } },
    };
    expect(flattenTokens(group, ["x"])).toEqual([
      { name: "x.a.b", path: ["x", "a", "b"], value: "#000000", dark: undefined },
      { name: "x.c", path: ["x", "c"], value: "{a.b}", dark: "{a.b}" },
    ]);
  });
});

describe("resolveAlias", () => {
  const byName = new Map<string, unknown>([
    ["a", "#111111"],
    ["b", "{a}"],
    ["n", 4],
  ]);

  it("returns a plain value unchanged and follows a chain of aliases", () => {
    expect(resolveAlias("#222222", byName)).toBe("#222222");
    expect(resolveAlias("{b}", byName)).toBe("#111111");
  });

  it.each(["{missing}", "{n}"])("refuses %s, which names no colour", (alias) => {
    expect(() => resolveAlias(alias, byName)).toThrow(`Unknown token in alias ${alias}`);
  });
});

describe("Foundations/Tokens", () => {
  it("Colours shows every colour token once, with its hex", () => {
    render(<Colours />);
    const scales = screen.getAllByRole("region");
    expect(scales.map((region) => region.querySelector("h2")?.textContent)).toEqual([
      "base",
      "lake",
      "lotus",
      "grey",
    ]);
    const swatches = scales.flatMap((region) => within(region).getAllByRole("figure"));
    expect(swatches.map((figure) => figure.textContent)).toEqual(
      flattenTokens(colorJson).map((token) => `${token.name}${String(token.value)}`),
    );
  });

  it("Colours resolves each meaning to its light and dark hex", () => {
    render(<Colours />);
    const table = screen.getByRole("table");
    const meanings = flattenTokens(semanticJson);
    const byName = new Map(flattenTokens(colorJson).map((token) => [token.name, token.value]));
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(meanings.length);
    meanings.forEach((token, i) => {
      const row = rows[i]!;
      expect(within(row).getByRole("rowheader").textContent).toBe(token.name);
      const [light, dark] = within(row).getAllByRole("cell");
      const light$ = String(token.value);
      const dark$ = String(token.dark);
      expect(light?.textContent).toBe(`${light$}${resolveAlias(light$, byName)}`);
      expect(dark?.textContent).toBe(`${dark$}${resolveAlias(dark$, byName)}`);
    });
  });

  it("Spacing draws a bar as wide as each step", () => {
    const { container } = render(<Spacing />);
    const steps = flattenTokens(spaceJson);
    for (const token of steps) {
      expect(shown(token.name)).toEqual([`${token.name} ${String(token.value)}`]);
    }
    const bars = [...container.querySelectorAll<HTMLElement>(".mb-tokens__bar")];
    expect(bars.map((bar) => bar.style.width)).toEqual(steps.map((token) => token.value));
  });

  it("Type writes out the font family and shows every size and weight", () => {
    render(<Type />);
    expect(screen.getByText(fontJson.font.family.sans.$value.join(", "))).toBeDefined();
    for (const [size, token] of Object.entries(fontJson.font.size)) {
      const lineHeight = fontJson.font["line-height"][size as keyof typeof fontJson.font.size];
      expect(shown(`font.size.${size}`)).toEqual([
        `The lotus opens on a quiet lakefont.size.${size} ${token.$value} / ${lineHeight.$value}`,
      ]);
    }
    for (const token of flattenTokens(fontJson.font.weight, ["font", "weight"])) {
      expect(shown(token.name)).toEqual([
        `The lotus opens on a quiet lake${token.name} ${String(token.value)}`,
      ]);
    }
  });

  it("Radius shows a box per radius token", () => {
    const { container } = render(<Radius />);
    const radii = flattenTokens(radiusJson);
    const boxes = [...container.querySelectorAll<HTMLElement>(".mb-tokens__radius")];
    expect(boxes.map((box) => box.style.borderRadius)).toEqual(radii.map((token) => token.value));
    for (const token of radii) {
      expect(shown(token.name)).toEqual([`${token.name}${String(token.value)}`]);
    }
  });
});
