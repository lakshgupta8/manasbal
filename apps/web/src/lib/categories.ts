import type { CategoryTree } from "@manasbal/sdk";
import { cache } from "react";
import { apiCall } from "./api";

// The whole category tree. When the API can't be reached or answers with an error, this throws,
// and the page's error.tsx says so.
export function getCategories(): Promise<CategoryTree> {
  return apiCall((api) => api.GET("/categories"));
}

// The same tree, fetched once per request however many parts of a page ask (a category page's
// title, breadcrumbs and heading all need it).
export const getCategoryTree = cache(getCategories);
