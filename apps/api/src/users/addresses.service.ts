import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AddressInput, AddressPatch } from "@manasbal/types";
import { getDb } from "../prisma/db.js";

// What the API shows of an address: never the owner or the demo-reset flag.
const FIELDS = ["id", "name", "line1", "city", "state", "pincode", "phone", "isDefault"] as const;

const NOT_FOUND = "No address with this id";

// Every query is filtered by the owner as well as the id, so another user's address looks
// exactly like one that doesn't exist.
@Injectable()
export class AddressesService {
  async list(userId: string) {
    const addresses = await getDb()
      .orm.public.Address.where({ userId })
      .select(...FIELDS)
      .orderBy([(a) => a.name.asc(), (a) => a.id.asc()])
      .all();
    // The default comes first. A boolean column can't be ordered on, and the sort is stable.
    return addresses.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }

  create(userId: string, input: AddressInput) {
    return getDb().transaction(async (tx) => {
      // A user has at most one default address.
      if (input.isDefault) {
        await tx.orm.public.Address.where({ userId, isDefault: true }).updateAndCount({
          isDefault: false,
        });
      }
      // Addresses made through the demo are removed by the nightly reset.
      return tx.orm.public.Address.select(...FIELDS).create({
        ...input,
        isDefault: input.isDefault ?? false,
        userId,
        createdByVisitor: true,
      });
    });
  }

  async update(userId: string, id: string, patch: AddressPatch) {
    const updated = await getDb().transaction(async (tx) => {
      const owned = await tx.orm.public.Address.where({ id, userId }).select("id").first();
      if (owned === null) return null;
      if (patch.isDefault) {
        await tx.orm.public.Address.where({ userId, isDefault: true }).updateAndCount({
          isDefault: false,
        });
      }
      return tx.orm.public.Address.where({ id, userId })
        .select(...FIELDS)
        .update(patch);
    });
    if (updated === null) throw new NotFoundException(NOT_FOUND);
    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    const db = getDb();
    const owned = await db.orm.public.Address.where({ id, userId }).select("id").first();
    if (owned === null) throw new NotFoundException(NOT_FOUND);

    // Orders keep pointing at the address they were sent to.
    const order = await db.orm.public.Order.where({ addressId: id }).select("id").first();
    if (order !== null) throw new ConflictException("An order was sent to this address");

    await db.orm.public.Address.where({ id, userId }).delete();
  }
}
