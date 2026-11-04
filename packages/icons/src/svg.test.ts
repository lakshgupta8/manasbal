import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guards the drawing rules in README.md for every file in svg/.
const svgDir = path.resolve(import.meta.dirname, "../svg");
const files = readdirSync(svgDir).filter((file) => file.endsWith(".svg"));
const ALLOWED_ELEMENTS = new Set([
  "path",
  "circle",
  "line",
  "polyline",
  "polygon",
  "rect",
  "ellipse",
]);

function parse(file: string): Element {
  const source = readFileSync(path.join(svgDir, file), "utf8");
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  const error = doc.querySelector("parsererror");
  if (error) throw new Error(`${file} is not valid XML: ${error.textContent}`);
  return doc.documentElement;
}

describe("svg folder", () => {
  it("holds only SVG files, at least the first 12 icons", () => {
    expect(readdirSync(svgDir).filter((file) => !file.endsWith(".svg"))).toEqual([]);
    expect(files.length).toBeGreaterThanOrEqual(12);
  });

  it("refuses a file that is not well-formed XML", () => {
    const doc = new DOMParser().parseFromString("<svg><path></svg>", "image/svg+xml");
    expect(doc.querySelector("parsererror")).not.toBeNull();
  });
});

describe.each(files)("%s", (file) => {
  const svg = parse(file);
  const shapes = [...svg.querySelectorAll("*")];

  it("has a kebab-case name", () => {
    expect(file).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*\.svg$/);
  });

  it("is a 24 × 24 SVG", () => {
    expect(svg.tagName).toBe("svg");
    expect(svg.getAttribute("xmlns")).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
  });

  it("draws a 2px currentColor line with round ends and corners, and no fill", () => {
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-width")).toBe("2");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("stroke-linejoin")).toBe("round");
  });

  it("uses only plain shapes, with no colour, style or line setting of their own", () => {
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(ALLOWED_ELEMENTS).toContain(shape.tagName);
      const own = shape
        .getAttributeNames()
        .filter((name) => /^(fill|stroke|style|class|color)/.test(name));
      expect(own).toEqual([]);
    }
  });

  it("has no hard-coded colour anywhere", () => {
    const source = readFileSync(path.join(svgDir, file), "utf8");
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
