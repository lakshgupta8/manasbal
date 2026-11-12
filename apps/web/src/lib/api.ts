import { createApiClient, type ApiClient } from "@manasbal/sdk";
import { API_TIMEOUT_MS, ApiResponseError, ApiUnavailableError } from "./api-errors";
import { shopPath } from "./api-routes";

export { API_TIMEOUT_MS, ApiResponseError, ApiUnavailableError } from "./api-errors";

// On the server (pages rendered by Next.js) the client calls API_URL directly. In the browser it
// calls the shop's own address, which forwards to the API (next.config.ts), so the refresh cookie
// is first-party (ADR 0012). The access token is never stored here: callers pass it in from memory.
export function apiClient(
  accessToken?: string,
  inBrowser: boolean = typeof window !== "undefined",
): ApiClient {
  const baseUrl = inBrowser ? window.location.origin : process.env.API_URL;
  if (!baseUrl) throw new ApiUnavailableError("API_URL is not set");
  return createApiClient({
    baseUrl,
    accessToken,
    fetch: async (request) =>
      fetch(inBrowser ? await toShopAddress(request) : request, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      }),
  });
}

// The same request, sent to the shop's path for it. The body is read first: a request can't be
// rebuilt from another's body stream.
async function toShopAddress(request: Request): Promise<Request> {
  const url = new URL(request.url);
  url.pathname = shopPath(url.pathname);
  const body = request.body === null ? undefined : await request.arrayBuffer();
  return new Request(url, { method: request.method, headers: request.headers, body });
}

interface CallResult<T> {
  readonly data?: T;
  readonly error?: unknown;
  readonly response: Response;
}

function problemTitle(error: unknown, response: Response): string {
  if (typeof error === "object" && error !== null && "title" in error) {
    const { title } = error;
    if (typeof title === "string") return title;
  }
  return response.statusText;
}

// Makes one call and answers its data. Throws ApiUnavailableError when the API can't be reached
// and ApiResponseError when it answers with an error, so a page's error.tsx shows instead.
export async function apiCall<T>(call: (api: ApiClient) => Promise<CallResult<T>>): Promise<T> {
  let result: CallResult<T>;
  try {
    result = await call(apiClient());
  } catch (error) {
    if (error instanceof ApiUnavailableError) throw error;
    throw new ApiUnavailableError("The API could not be reached", { cause: error });
  }
  if (!result.response.ok) {
    throw new ApiResponseError(result.response.status, problemTitle(result.error, result.response));
  }
  return result.data as T;
}
