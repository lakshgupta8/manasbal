import { createApiClient, type CategoryTree } from "@manasbal/sdk";

// The top-level categories for the home page, or null when the API can't be reached or
// answers with an error; the page then says so instead of failing.
export async function getCategories(): Promise<CategoryTree | null> {
  const baseUrl = process.env.API_URL;
  if (!baseUrl) return null;
  try {
    const { data } = await createApiClient({ baseUrl }).GET("/categories", {
      signal: AbortSignal.timeout(3000),
    });
    return data ?? null;
  } catch (error) {
    console.error("GET /categories failed", error);
    return null;
  }
}
