import { z } from "zod";

// One order in the buyer's list. totalPaise is whole paise.
export const orderSummarySchema = z.object({
  id: z.uuid(),
  status: z.string(),
  totalPaise: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});

// One page of orders; nextCursor fetches the next page, and is null on the last one.
export const orderPageSchema = z.object({
  items: z.array(orderSummarySchema),
  nextCursor: z.string().nullable(),
});

export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type OrderPage = z.infer<typeof orderPageSchema>;
