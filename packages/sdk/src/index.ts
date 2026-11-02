import createClient, { type ClientOptions } from "openapi-fetch";
import type { paths } from "@manasbal/types";

export type * from "@manasbal/types";

// A typed client for the Manasbal API: paths, parameters and answers all come from the
// API's own OpenAPI description, so a changed endpoint shows up as a type error here.
export interface ApiClientOptions extends ClientOptions {
  // The access token from POST /auth/sign-in or /auth/refresh, sent as a bearer token.
  // Leave it out for the public endpoints.
  accessToken?: string;
}

export function createApiClient({ accessToken, headers, ...options }: ApiClientOptions = {}) {
  return createClient<paths>({
    ...options,
    headers:
      accessToken === undefined ? headers : { ...headers, authorization: `Bearer ${accessToken}` },
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
