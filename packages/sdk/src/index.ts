import createClient, { type ClientOptions } from "openapi-fetch";
import type { paths } from "@manasbal/types";

export type * from "@manasbal/types";

// A typed client for the Manasbal API: paths, parameters and answers all come from the
// API's own OpenAPI description, so a changed endpoint shows up as a type error here.
export function createApiClient(options: ClientOptions = {}) {
  return createClient<paths>(options);
}

export type ApiClient = ReturnType<typeof createApiClient>;
