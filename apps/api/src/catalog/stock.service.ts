import { Injectable, NotFoundException } from "@nestjs/common";
import type { ProductStock } from "@manasbal/types";
import { getDb } from "../prisma/db.js";

@Injectable()
export class StockService {
  async forProduct(productId: string): Promise<ProductStock> {
    const db = getDb().orm.public;
    const product = await db.Product.where({ id: productId }).select("id").first();
    if (product === null) throw new NotFoundException("Product not found");

    const variants = await db.Variant.where({ productId })
      .orderBy((v) => v.sku.asc())
      .select("id", "sku", "size", "colour")
      .include("inventory", (i) => i.select("quantity", "reserved"))
      .all();

    return {
      productId,
      variants: variants.map((variant) => {
        const onHand = variant.inventory.reduce((sum, row) => sum + row.quantity - row.reserved, 0);
        return {
          variantId: variant.id,
          sku: variant.sku,
          size: variant.size,
          colour: variant.colour,
          available: Math.max(0, onHand),
        };
      }),
    };
  }
}
