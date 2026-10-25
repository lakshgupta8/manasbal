import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AddressInput, AddressPatch } from "@manasbal/types";
import { AuditService } from "../audit/audit.service.js";
import { getDb } from "../prisma/db.js";
import type { Actor } from "./demo-user.guard.js";

// What the API shows of an address: never the owner or the demo-reset flag.
const FIELDS = ["id", "name", "line1", "city", "state", "pincode", "isDefault"] as const;

const CREATE = "address.create";
const UPDATE = "address.update";
const DELETE = "address.delete";

const NOT_FOUND = "No address with this id";

// Every query is filtered by the owner as well as the id, so another user's address looks
// exactly like one that doesn't exist.
@Injectable()
export class AddressesService {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(@Inject(AuditService) private readonly audit: Pick<AuditService, "record">) {}

  async list(userId: string) {
    const addresses = await getDb()
      .orm.public.Address.where({ userId })
      .select(...FIELDS)
      .orderBy([(a) => a.name.asc(), (a) => a.id.asc()])
      .all();
    // The default comes first. A boolean column can't be ordered on, and the sort is stable.
    return addresses.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }

  create(who: Actor, input: AddressInput) {
    const userId = who.userId;
    return getDb().transaction(async (tx) => {
      // A user has at most one default address.
      if (input.isDefault) {
        await tx.orm.public.Address.where({ userId, isDefault: true }).updateAndCount({
          isDefault: false,
        });
      }
      // Addresses made through the demo are removed by the nightly reset.
      const created = await tx.orm.public.Address.select(...FIELDS).create({
        ...input,
        isDefault: input.isDefault ?? false,
        userId,
        createdByVisitor: true,
      });
      await this.audit.record(who, CREATE, { type: "address", id: created.id }, tx.orm);
      return created;
    });
  }

  async update(who: Actor, id: string, patch: AddressPatch) {
    const userId = who.userId;
    const updated = await getDb().transaction(async (tx) => {
      const owned = await tx.orm.public.Address.where({ id, userId }).select("id").first();
      if (owned === null) return null;
      if (patch.isDefault) {
        await tx.orm.public.Address.where({ userId, isDefault: true }).updateAndCount({
          isDefault: false,
        });
      }
      const changed = await tx.orm.public.Address.where({ id, userId })
        .select(...FIELDS)
        .update(patch);
      await this.audit.record(who, UPDATE, { type: "address", id }, tx.orm);
      return changed;
    });
    if (updated === null) throw new NotFoundException(NOT_FOUND);
    return updated;
  }

  async remove(who: Actor, id: string): Promise<void> {
    const userId = who.userId;
    await getDb().transaction(async (tx) => {
      const owned = await tx.orm.public.Address.where({ id, userId }).select("id").first();
      if (owned === null) throw new NotFoundException(NOT_FOUND);

      // Orders keep pointing at the address they were sent to.
      const order = await tx.orm.public.Order.where({ addressId: id }).select("id").first();
      if (order !== null) throw new ConflictException("An order was sent to this address");

      await tx.orm.public.Address.where({ id, userId }).delete();
      await this.audit.record(who, DELETE, { type: "address", id }, tx.orm);
    });
  }
}
