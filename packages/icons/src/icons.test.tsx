import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import { buildIcons, componentName } from "../scripts/build";
import * as icons from "./index";
import { type IconProps, ShoppingBagIcon } from "./index";

const packageDir = path.resolve(import.meta.dirname, "..");
const svgDir = path.join(packageDir, "svg");
const drawings = readdirSync(svgDir).filter((file) => file.endsWith(".svg"));
const components = icons as unknown as Record<string, ComponentType<IconProps>>;

// Each shape as its tag and attributes, so a drawing and a rendered icon can be compared.
const shapesOf = (svg: Element) =>
  [...svg.children]
    .filter((child) => child.tagName !== "title")
    .map((child) => [
      child.tagName,
      ...child.getAttributeNames().map((n) => `${n}=${child.getAttribute(n)}`),
    ]);

describe("componentName", () => {
  it.each([
    ["shopping-bag.svg", "ShoppingBagIcon"],
    ["star-half.svg", "StarHalfIcon"],
    ["plus.svg", "PlusIcon"],
  ])("names %s %s", (file, name) => {
    expect(componentName(file)).toBe(name);
  });
});

describe.each(drawings)("%s", (file) => {
  const Component = components[componentName(file)];

  it("draws exactly the shapes of the drawing", () => {
    const source = new DOMParser().parseFromString(
      readFileSync(path.join(svgDir, file), "utf8"),
      "image/svg+xml",
    ).documentElement;
    const { container } = render(Component ? <Component /> : null);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(shapesOf(svg!)).toEqual(shapesOf(source));
  });

  it("is hidden from screen readers when it has no title", () => {
    const { container } = render(Component ? <Component /> : null);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("role")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("Icon", () => {
  it("is found by role img and its title when it has one", () => {
    render(<ShoppingBagIcon title="Bag" />);
    const icon = screen.getByRole("img", { name: "Bag" });
    expect(icon.getAttribute("aria-hidden")).toBeNull();
    expect(icon.querySelector("title")?.textContent).toBe("Bag");
  });

  it("draws the 24 px frame with the line settings of the drawing rules", () => {
    const { container } = render(<ShoppingBagIcon />);
    const svg = container.querySelector("svg")!;
    expect(
      Object.fromEntries(svg.getAttributeNames().map((n) => [n, svg.getAttribute(n)])),
    ).toEqual({
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      width: "24",
      height: "24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      focusable: "false",
      "aria-hidden": "true",
    });
  });

  it.each([16, 20, 24] as const)("size %i sets the width and height", (size) => {
    const { container } = render(<ShoppingBagIcon size={size} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe(String(size));
    expect(svg?.getAttribute("height")).toBe(String(size));
  });

  it("passes other props to the svg", () => {
    const { container } = render(<ShoppingBagIcon className="nav-icon" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toBe("nav-icon");
  });

  it("exports a component for every drawing, and nothing else but Icon", () => {
    expect(Object.keys(icons).sort((a, b) => a.localeCompare(b))).toEqual(
      ["Icon", ...drawings.map(componentName)].sort((a, b) => a.localeCompare(b)),
    );
  });
});

describe("build:icons", () => {
  it("gives exactly the committed files (run `pnpm --filter @manasbal/icons build:icons` after changing a drawing)", async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), "manasbal-icons-"));
    try {
      await buildIcons(svgDir, outDir);
      const read = (dir: string, file: string) =>
        readFileSync(path.join(dir, file), "utf8").replaceAll("\r\n", "\n");
      const committed = path.join(packageDir, "src");
      const fresh = readdirSync(path.join(outDir, "generated"));
      expect(fresh).toEqual(readdirSync(path.join(committed, "generated")));
      for (const file of fresh) {
        expect(read(outDir, `generated/${file}`)).toBe(read(committed, `generated/${file}`));
      }
      expect(read(outDir, "index.ts")).toBe(read(committed, "index.ts"));
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);
});
