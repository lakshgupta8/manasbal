import { z } from "zod";

// A seller's store as a shopper sees it. No user id and no status: those stay inside the API.
export const sellerStoreSchema = z.object({
  slug: z.string(),
  storeName: z.string(),
  productCount: z.number().int().nonnegative(),
});

export type SellerStore = z.infer<typeof sellerStoreSchema>;
