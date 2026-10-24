import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Cart, CartItemInput } from "@manasbal/types";
import { availableOf } from "../catalog/products.service.js";
import { getDb } from "../prisma/db.js";

// The signed-in user's cart. Prices come from the variants, never from the request.
@Injectable()
export class CartService {
  async get(userId: string): Promise<Cart> {
    const cart = await getDb()
      .orm.public.Cart.where({ userId })
      .select("id")
      .include("items", (i) =>
        i
          .select("quantity")
          .include("variant", (v) =>
            v.select("id", "sku", "pricePaise").include("product", (p) => p.select("name")),
          ),
      )
      .first();
    // A user who never added anything has no cart row, and asking doesn't make one.
    if (cart === null) return { items: [], subtotalPaise: 0 };

    const items = cart.items.map((item) => {
      const { variant } = item;
      // The schema ties every line to a variant and every variant to a product; the ORM still
      // types the includes as nullable.
      if (variant === null || variant.product === null) {
        throw new Error(`cart ${cart.id} has a line without its variant or product`);
      }
      return {
        variantId: variant.id,
        productName: variant.product.name,
        sku: variant.sku,
        quantity: item.quantity,
        unitPricePaise: variant.pricePaise,
        linePaise: variant.pricePaise * item.quantity,
      };
    });
    // Stable order: the database gives no promise for the lines.
    items.sort((a, b) => a.productName.localeCompare(b.productName) || a.sku.localeCompare(b.sku));
    return { items, subtotalPaise: items.reduce((sum, line) => sum + line.linePaise, 0) };
  }

  async addItem(userId: string, { variantId, quantity }: CartItemInput): Promise<Cart> {
    await getDb().transaction(async (tx) => {
      const db = tx.orm.public;
      const variant = await db.Variant.where({ id: variantId })
        .select("id")
        .include("inventory", (i) => i.select("quantity", "reserved"))
        .first();
      if (variant === null) throw new NotFoundException("No variant with this id");

      // Carts made through the demo are removed by the nightly reset.
      const cart =
        (await db.Cart.where({ userId }).select("id").first()) ??
        (await db.Cart.select("id").create({ userId, createdByVisitor: true }));
      const line = await db.CartItem.where({ cartId: cart.id, variantId })
        .select("id", "quantity")
        .first();

      const wanted = (line?.quantity ?? 0) + quantity;
      const available = availableOf(variant.inventory);
      if (wanted > available) throw new ConflictException(`Only ${available} left`);

      if (line === null) {
        await db.CartItem.create({ cartId: cart.id, variantId, quantity: wanted });
      } else {
        await db.CartItem.where({ id: line.id }).update({ quantity: wanted });
      }
    });
    return this.get(userId);
  }
}
