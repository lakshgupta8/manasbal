import { z } from "zod";

// How many of one variant a buyer can order: quantity minus reserved, added up over every
// location, and never below 0.
export const variantStockSchema = z.object({
  variantId: z.uuid(),
  sku: z.string(),
  size: z.string().nullable(),
  colour: z.string().nullable(),
  available: z.number().int().nonnegative(),
});

// What GET /products/:id/stock answers. variants is empty for a product with no variants.
export const productStockSchema = z.object({
  productId: z.uuid(),
  variants: z.array(variantStockSchema),
});

export type VariantStock = z.infer<typeof variantStockSchema>;
export type ProductStock = z.infer<typeof productStockSchema>;
