// Types of the Manasbal API, generated from its OpenAPI description. Don't edit openapi.d.ts
// or openapi.json by hand: change the API, then run `pnpm api-types` from the repo root.
export type { components, operations, paths } from "./openapi.js";

import type { components } from "./openapi.js";

export type HealthStatus = components["schemas"]["HealthStatus"];
export type Address = components["schemas"]["Address"];

// Request shapes, written by hand with Zod so the API and the shop validate the same way.
export * from "./addresses.js";
export * from "./cart.js";
// Answer shapes, written by hand with Zod.
export * from "./audit.js";
export * from "./categories.js";
export * from "./demo-ids.js";
export * from "./orders.js";
export * from "./products.js";
export * from "./reviews.js";
export * from "./sellers.js";
