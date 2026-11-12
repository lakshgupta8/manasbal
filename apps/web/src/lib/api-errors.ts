// The errors and the timeout every call to the API shares. They sit apart from api.ts, so code
// that only needs them (the browser's auth calls) doesn't pull the typed client into the bundle.

// How long a call may take before it counts as the API being unavailable.
export const API_TIMEOUT_MS = 5000;

// The API could not be reached: API_URL is not set, the network failed or the call timed out.
export class ApiUnavailableError extends Error {
  override readonly name = "ApiUnavailableError";
}

// The API answered with an error status. `title` is the problem document's title when it sent one.
export class ApiResponseError extends Error {
  override readonly name = "ApiResponseError";

  constructor(
    readonly status: number,
    readonly title: string,
  ) {
    super(`The API answered ${status}: ${title}`);
  }
}
