import { z } from "zod";
import { slugify } from "./slug.js";

// What a seller types to rename their store. The slug (the store page's address) follows the
// name, so the name needs at least one letter or digit.
export const storeUpdateInputSchema = z
  .object({
    storeName: z
      .string()
      .trim()
      .min(2, "Use at least 2 characters")
      .max(60, "Use at most 60 characters")
      .refine((name) => slugify(name) !== "", "Use at least one letter or digit"),
  })
  .strict();

export type StoreUpdateInput = z.infer<typeof storeUpdateInputSchema>;
