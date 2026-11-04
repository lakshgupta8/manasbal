// The shop's own paths that lead to the API (ADR 0012). /auth/* keeps its path, because the API
// sets the refresh cookie on Path=/auth; every other API path sits under /api. No page may use
// either prefix.
export const AUTH_PREFIX = "/auth";
export const API_PREFIX = "/api";

export interface Rewrite {
  readonly source: string;
  readonly destination: string;
}

// The Next.js rewrites to the API at `apiUrl`, or none when it is not set (a build without the
// API, such as a pull request's checks).
export function apiRewrites(apiUrl: string | undefined): Rewrite[] {
  const api = (apiUrl ?? "").trim().replace(/\/+$/, "");
  if (api === "") return [];
  return [
    { source: `${AUTH_PREFIX}/:path*`, destination: `${api}${AUTH_PREFIX}/:path*` },
    { source: `${API_PREFIX}/:path*`, destination: `${api}/:path*` },
  ];
}

// The shop path a browser uses for an API path: /auth/... as it is, anything else under /api.
export function shopPath(apiPath: string): string {
  const isAuth = apiPath === AUTH_PREFIX || apiPath.startsWith(`${AUTH_PREFIX}/`);
  return isAuth ? apiPath : `${API_PREFIX}${apiPath}`;
}
