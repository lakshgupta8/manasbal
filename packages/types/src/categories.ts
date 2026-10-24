import { z } from "zod";

// One category in the catalog tree: the categories below it are nested under children.
export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  children: CategoryNode[];
}

// What GET /categories answers. The top-level categories, each with its subcategories nested.
export const categoryNodeSchema: z.ZodType<CategoryNode> = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  children: z.lazy(() => z.array(categoryNodeSchema)),
});

export const categoryTreeSchema = z.array(categoryNodeSchema);

export type CategoryTree = z.infer<typeof categoryTreeSchema>;
