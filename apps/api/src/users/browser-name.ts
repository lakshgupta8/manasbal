// A short, readable name for the device a session was started on, such as "Firefox on Windows",
// from its user agent. Only this name is ever answered, never the user agent itself. Order
// matters: Edge and Opera also say "Chrome", Chrome also says "Safari", and Android also says
// "Linux".
const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/Windows/, "Windows"],
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

export const UNKNOWN_BROWSER = "Unknown browser";

const find = (list: [RegExp, string][], userAgent: string) =>
  list.find(([pattern]) => pattern.test(userAgent))?.[1];

export function browserName(userAgent: string | null): string {
  if (userAgent === null) return UNKNOWN_BROWSER;
  const browser = find(BROWSERS, userAgent);
  if (browser === undefined) return UNKNOWN_BROWSER;
  const system = find(SYSTEMS, userAgent);
  return system === undefined ? browser : `${browser} on ${system}`;
}
