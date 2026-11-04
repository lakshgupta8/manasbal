import type { CategoryTree } from "@manasbal/sdk";
import { apiCall } from "./api";

// The top-level categories for the home page. When the API can't be reached or answers with an
// error, this throws, and the page's error.tsx says so.
export function getCategories(): Promise<CategoryTree> {
  return apiCall((api) => api.GET("/categories"));
}
