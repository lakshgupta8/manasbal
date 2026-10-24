import { z } from "zod";

// What a buyer sends to put something in the cart. Strict, so a price in the body is refused:
// prices always come from the database. Money is whole paise.
export const cartItemInputSchema = z
  .object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(10) })
  .strict();

// One line of the cart. unitPricePaise is the variant's current price; linePaise is the price
// times the quantity.
export const cartLineSchema = z.object({
  variantId: z.uuid(),
  productName: z.string(),
  sku: z.string(),
  quantity: z.number().int().positive(),
  unitPricePaise: z.number().int().nonnegative(),
  linePaise: z.number().int().nonnegative(),
});

export const cartSchema = z.object({
  items: z.array(cartLineSchema),
  subtotalPaise: z.number().int().nonnegative(),
});

export type CartItemInput = z.infer<typeof cartItemInputSchema>;
export type CartLine = z.infer<typeof cartLineSchema>;
export type Cart = z.infer<typeof cartSchema>;
