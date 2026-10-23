import { Injectable } from "@nestjs/common";
import type { CategoryNode } from "@manasbal/types";
import { getDb } from "../prisma/db.js";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

// Nests each category under its parent. A category whose parent isn't in the list is kept at the
// top, so no row is lost. Rows keep their input order among siblings.
export function buildCategoryTree(rows: CategoryRow[]): CategoryNode[] {
  const entries = rows.map((row) => ({
    node: { id: row.id, name: row.name, slug: row.slug, children: [] as CategoryNode[] },
    parentId: row.parentId,
  }));
  const byId = new Map(entries.map((entry) => [entry.node.id, entry.node]));

  const roots: CategoryNode[] = [];
  for (const { node, parentId } of entries) {
    const parent = parentId === null ? undefined : byId.get(parentId);
    if (parent === undefined) roots.push(node);
    else parent.children.push(node);
  }
  return roots;
}

@Injectable()
export class CategoriesService {
  async tree(): Promise<CategoryNode[]> {
    // Sorted by name, so the tree comes out in the same order every time.
    const rows = await getDb()
      .orm.public.Category.orderBy((category) => category.name.asc())
      .all();
    return buildCategoryTree(rows);
  }
}
