import type { ProductDetail } from "@manasbal/sdk";
import { cache } from "react";
import { apiCall, ApiResponseError } from "./api";

// One product by its slug, or undefined when there is none. Kept for the request, so the page
// and its metadata make one call. When the API can't be reached or answers with another error,
// this throws (see apiCall), and error.tsx shows the error state.
export const getProduct = cache(async (slug: string): Promise<ProductDetail | undefined> => {
  try {
    return await apiCall((api) => api.GET("/products/{slug}", { params: { path: { slug } } }));
  } catch (error) {
    if (error instanceof ApiResponseError && error.status === 404) return undefined;
    throw error;
  }
});
