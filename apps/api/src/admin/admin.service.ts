import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AuditPage, OrderSummary } from "@manasbal/types";
import { AuditService } from "../audit/audit.service.js";
import type { Actor } from "../auth/current-user.js";
import { parsePageQuery, parseTimeKey, toPage, type PageQuery } from "../pagination/pagination.js";
import { getDb } from "../prisma/db.js";

export const NO_ORDER = "No order with this id";

const VIEW_ORDER = "order.view";

// What only staff can see: the audit log (admin) and any user's order (support and admin).
@Injectable()
export class AdminService {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(@Inject(AuditService) private readonly audit: Pick<AuditService, "record">) {}

  // Any user's order, in the same shape as the owner's own list. Every view is recorded, so a
  // look at someone else's order always leaves a trace; a missing order records nothing.
  order(who: Actor, id: string): Promise<OrderSummary> {
    return getDb().transaction(async (tx) => {
      const row = await tx.orm.public.Order.where({ id })
        .select("id", "status", "totalPaise", "createdAt")
        .first();
      if (row === null) throw new NotFoundException(NO_ORDER);
      await this.audit.record(who, VIEW_ORDER, { type: "order", id }, tx.orm);
      return {
        id: row.id,
        status: row.status,
        totalPaise: row.totalPaise,
        createdAt: row.createdAt.toString(),
      };
    });
  }

  // The audit log, newest first. The actor is its id only: the admin console can look the user up.
  async list({ cursor, limit }: PageQuery): Promise<AuditPage> {
    const params = parsePageQuery({ cursor, limit });
    const after = params.after === undefined ? undefined : parseTimeKey(params.after);

    const ordered = getDb().orm.public.AuditLog.orderBy([
      (a) => a.createdAt.desc(),
      (a) => a.id.desc(),
    ]);
    const paged =
      after === undefined
        ? ordered
        : ordered.cursor({ createdAt: Temporal.Instant.from(after.createdAt), id: after.id });
    const rows = await paged
      .limit(params.take)
      .select("id", "actorId", "action", "targetType", "targetId", "requestId", "createdAt")
      .all();

    const items = rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      requestId: row.requestId,
      createdAt: row.createdAt.toString(),
    }));
    return toPage(items, params, (a) => `${a.createdAt}|${a.id}`);
  }
}
