import createClient, { type ClientOptions } from "openapi-fetch";
import type { paths } from "@manasbal/types";

export type * from "@manasbal/types";

// A typed client for the Manasbal API: paths, parameters and answers all come from the
// API's own OpenAPI description, so a changed endpoint shows up as a type error here.
export interface ApiClientOptions extends ClientOptions {
  // The temporary user (uuid) sent as x-demo-user until real sign-in arrives in Phase 5.
  demoUser?: string;
}

export function createApiClient({ demoUser, headers, ...options }: ApiClientOptions = {}) {
  return createClient<paths>({
    ...options,
    headers: demoUser === undefined ? headers : { ...headers, "x-demo-user": demoUser },
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
