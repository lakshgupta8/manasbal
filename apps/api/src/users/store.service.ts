import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { slugify, type StoreUpdateInput } from "@manasbal/types";
import { AuditService } from "../audit/audit.service.js";
import type { Actor } from "../auth/current-user.js";
import { getDb } from "../prisma/db.js";

export const NO_STORE = "This account has no store";
export const SLUG_TAKEN = "Another store already uses this name";

const UPDATE = "store.update";

// The signed-in seller's own store. It is found by the user, never by an id in the request, so a
// seller can only ever change their own.
@Injectable()
export class StoreService {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(@Inject(AuditService) private readonly audit: Pick<AuditService, "record">) {}

  // Renames the store; the slug (its page address) follows the name.
  async rename(who: Actor, { storeName }: StoreUpdateInput) {
    const slug = slugify(storeName);
    try {
      return await getDb().transaction(async (tx) => {
        const sellers = tx.orm.public.Seller;
        const own = await sellers.where({ userId: who.userId }).select("id").first();
        if (own === null) throw new NotFoundException(NO_STORE);
        const holder = await sellers.where({ slug }).select("id").first();
        if (holder !== null && holder.id !== own.id) throw new ConflictException(SLUG_TAKEN);

        const updated = await sellers
          .where({ id: own.id })
          .select("storeName", "slug", "status")
          .update({ storeName, slug });
        await this.audit.record(who, UPDATE, { type: "seller", id: own.id }, tx.orm);
        return updated!;
      });
    } catch (error) {
      // Two sellers taking the same name at once: the unique index stops the second.
      const holder = await getDb().orm.public.Seller.where({ slug }).select("userId").first();
      if (holder !== null && holder.userId !== who.userId) throw new ConflictException(SLUG_TAKEN);
      throw error;
    }
  }
}
