import { BadRequestException, Injectable } from "@nestjs/common";
import type { ProductPage, ProductSummary } from "@manasbal/types";
import { z } from "zod";
import { parsePageQuery, toPage, type PageQuery } from "../pagination/pagination.js";
import { getDb } from "../prisma/db.js";

export interface ProductListQuery extends PageQuery {
  category?: string;
}

@Injectable()
export class ProductsService {
  async list({ category, cursor, limit }: ProductListQuery): Promise<ProductPage> {
    const params = parsePageQuery({ cursor, limit });
    const { after, take } = params;
    // The cursor decodes to a product id. Anything else is the client's mistake, not a 500.
    if (after !== undefined && !z.uuid().safeParse(after).success) {
      throw new BadRequestException("cursor is not valid");
    }

    const db = getDb().orm.public;
    let categoryId: string | undefined;
    if (category !== undefined) {
      const found = await db.Category.where({ slug: category }).select("id").first();
      if (found === null) return { items: [], nextCursor: null };
      categoryId = found.id;
    }

    const products = categoryId === undefined ? db.Product : db.Product.where({ categoryId });
    const ordered = products.orderBy((p) => p.id.asc());
    const paged = after === undefined ? ordered : ordered.cursor({ id: after });
    const rows = await paged
      .limit(take)
      // Only the columns the answer needs: reading created_at would need a global Temporal.
      .select("id", "slug", "name")
      .include("category", (c) => c.select("slug", "name"))
      // variants comes back as the lowest variant price, or null when there are none.
      .include("variants", (v) => v.min("pricePaise"))
      .all();

    const items = rows.map((row): ProductSummary => {
      // Every product has a category in the schema; the ORM still types the include as nullable.
      const { category } = row;
      if (category === null) {
        throw new Error(`product ${row.id} has no category`);
      }
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        pricePaise: row.variants,
        category: { slug: category.slug, name: category.name },
      };
    });
    return toPage(items, params, (p) => p.id);
  }
}
