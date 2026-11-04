// Shows the design tokens on the Foundations/Tokens Storybook page. Every value comes from the
// token JSON files that theme.css is built from, so the page can never disagree with the code.
import colorJson from "../../tokens/color.json";
import fontJson from "../../tokens/font.json";
import radiusJson from "../../tokens/radius.json";
import semanticJson from "../../tokens/semantic.json";
import spaceJson from "../../tokens/space.json";
import "./TokenPreview.css";

export interface FlatToken {
  /** Dotted path, e.g. `color.lake.500`. */
  readonly name: string;
  readonly path: readonly string[];
  readonly value: unknown;
  /** The dark-theme value of a meaning-layer token. */
  readonly dark?: string;
}

type TokenNode = { $value?: unknown; $extensions?: { manasbal?: { dark?: string } } };

/** Every token in a DTCG group, in file order. Keys starting with `$` are metadata, not tokens. */
export function flattenTokens(group: object, path: readonly string[] = []): FlatToken[] {
  return Object.entries(group)
    .filter(([key]) => !key.startsWith("$"))
    .flatMap(([key, child]: [string, TokenNode]) => {
      const childPath = [...path, key];
      if (!("$value" in child)) return flattenTokens(child, childPath);
      const dark = child.$extensions?.manasbal?.dark;
      return [{ name: childPath.join("."), path: childPath, value: child.$value, dark }];
    });
}

/** Follows `{a.b.c}` aliases until it reaches a plain value. */
export function resolveAlias(value: string, byName: ReadonlyMap<string, unknown>): string {
  const target = /^\{(.+)\}$/.exec(value)?.[1];
  if (target === undefined) return value;
  const next = byName.get(target);
  if (typeof next !== "string") throw new Error(`Unknown token in alias {${target}}`);
  return resolveAlias(next, byName);
}

const colours = flattenTokens(colorJson);
const meanings = flattenTokens(semanticJson);
const colourByName = new Map(colours.map((token) => [token.name, token.value]));
const scaleNames = [...new Set(colours.map((token) => String(token.path[1])))];

const px = (token: FlatToken) => String(token.value);
const fontFamily = (fontJson.font.family.sans.$value as string[]).join(", ");
const sizes = Object.keys(fontJson.font.size) as (keyof typeof fontJson.font.size)[];
const weights = flattenTokens(fontJson.font.weight, ["font", "weight"]);

function Swatch({ name, hex }: { readonly name: string; readonly hex: string }) {
  return (
    <figure className="mb-tokens__swatch">
      <div className="mb-tokens__chip" style={{ background: hex }} aria-hidden="true" />
      <figcaption>
        <code>{name}</code>
        <span>{hex}</span>
      </figcaption>
    </figure>
  );
}

export function ColourScales() {
  return (
    <div className="mb-tokens">
      {scaleNames.map((scale) => (
        <section key={scale} aria-labelledby={`scale-${scale}`}>
          <h2 id={`scale-${scale}`}>{scale}</h2>
          <div className="mb-tokens__grid">
            {colours
              .filter((token) => token.path[1] === scale)
              .map((token) => (
                <Swatch key={token.name} name={token.name} hex={String(token.value)} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function MeaningLayer() {
  return (
    <div className="mb-tokens">
      <table className="mb-tokens__table">
        <caption>What each colour is for, in the light and the dark theme</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Light</th>
            <th scope="col">Dark</th>
          </tr>
        </thead>
        <tbody>
          {meanings.map((token) => (
            <tr key={token.name}>
              <th scope="row">
                <code>{token.name}</code>
              </th>
              {[String(token.value), String(token.dark)].map((alias, i) => (
                <td key={i === 0 ? "light" : "dark"}>
                  <Swatch name={alias} hex={resolveAlias(alias, colourByName)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SpacingScale() {
  return (
    <div className="mb-tokens">
      <ul className="mb-tokens__list">
        {flattenTokens(spaceJson).map((token) => (
          <li key={token.name}>
            <span className="mb-tokens__bar" style={{ width: px(token) }} aria-hidden="true" />
            <code>{token.name}</code> <span>{px(token)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TypeScale() {
  return (
    <div className="mb-tokens" style={{ fontFamily }}>
      <p>
        Font family: <code>{fontFamily}</code>
      </p>
      <ul className="mb-tokens__list">
        {sizes.map((size) => {
          const fontSize = fontJson.font.size[size].$value;
          const lineHeight = fontJson.font["line-height"][size].$value;
          return (
            <li key={size}>
              <p className="mb-tokens__sample" style={{ fontSize, lineHeight }}>
                The lotus opens on a quiet lake
              </p>
              <code>font.size.{size}</code>{" "}
              <span>
                {fontSize} / {lineHeight}
              </span>
            </li>
          );
        })}
        {weights.map((token) => (
          <li key={token.name}>
            <p className="mb-tokens__sample" style={{ fontWeight: Number(token.value) }}>
              The lotus opens on a quiet lake
            </p>
            <code>{token.name}</code> <span>{String(token.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RadiusScale() {
  return (
    <div className="mb-tokens mb-tokens__grid">
      {flattenTokens(radiusJson).map((token) => (
        <figure key={token.name} className="mb-tokens__swatch">
          <div
            className="mb-tokens__radius"
            style={{ borderRadius: px(token) }}
            aria-hidden="true"
          />
          <figcaption>
            <code>{token.name}</code>
            <span>{px(token)}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
