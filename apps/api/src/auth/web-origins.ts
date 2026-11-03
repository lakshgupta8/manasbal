// The shop's addresses when WEB_ORIGINS is not set outside production: the storefront (3000) and
// a Vite dev server (5173).
export const DEV_WEB_ORIGINS = ["http://localhost:3000", "http://localhost:5173"];

// Whether the value is a bare origin, such as https://shop.example: no path, no trailing slash.
function isOrigin(value: string): boolean {
  return URL.canParse(value) && new URL(value).origin === value;
}

// The origins allowed to call the API from a browser with credentials, and to use the refresh
// cookie: WEB_ORIGINS, comma-separated. Production refuses to start without it.
export function webOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const origins = (env["WEB_ORIGINS"] ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");
  if (origins.length === 0) {
    if (env.NODE_ENV === "production") {
      throw new Error("WEB_ORIGINS is not set. Add it in Render → manasbal-api → Environment.");
    }
    return DEV_WEB_ORIGINS;
  }
  const wrong = origins.find((origin) => !isOrigin(origin));
  if (wrong !== undefined) {
    throw new Error(
      `WEB_ORIGINS has "${wrong}": use origins like https://shop.example, with no path or trailing slash`,
    );
  }
  return origins;
}
