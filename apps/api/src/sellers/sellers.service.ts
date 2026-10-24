import { Injectable, NotFoundException } from "@nestjs/common";
import type { SellerStore } from "@manasbal/types";
import { getDb } from "../prisma/db.js";

// The only status a store is shown with. A pending store answers 404, like a store that doesn't
// exist, so nobody can tell it is there.
export const APPROVED = "approved";

@Injectable()
export class SellersService {
  async store(slug: string): Promise<SellerStore> {
    const seller = await getDb()
      .orm.public.Seller.where({ slug, status: APPROVED })
      .select("id", "slug", "storeName")
      .include("products", (p) => p.count())
      .first();
    if (seller === null) throw new NotFoundException("No store with this slug");
    return { slug: seller.slug, storeName: seller.storeName, productCount: seller.products };
  }
}
