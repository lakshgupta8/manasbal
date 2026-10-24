import { z } from "zod";

// One product in a listing. pricePaise is the cheapest variant's price in whole paise, or null
// when the product has no variants yet.
export const productSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  pricePaise: z.number().int().nonnegative().nullable(),
  category: z.object({
    slug: z.string(),
    name: z.string(),
  }),
});

// What GET /products answers. One page of products; nextCursor fetches the next page, and is
// null on the last one.
export const productPageSchema = z.object({
  items: z.array(productSummarySchema),
  nextCursor: z.string().nullable(),
});

export type ProductSummary = z.infer<typeof productSummarySchema>;
export type ProductPage = z.infer<typeof productPageSchema>;

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
