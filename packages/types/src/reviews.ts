import { z } from "zod";

// One review of a product. authorName is the reviewer's first name only, never the email or the
// user id.
export const reviewSchema = z.object({
  id: z.uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string(),
  authorName: z.string(),
  createdAt: z.iso.datetime(),
});

// One page of reviews; nextCursor fetches the next page, and is null on the last one.
export const reviewPageSchema = z.object({
  items: z.array(reviewSchema),
  nextCursor: z.string().nullable(),
});

export type Review = z.infer<typeof reviewSchema>;
export type ReviewPage = z.infer<typeof reviewPageSchema>;
