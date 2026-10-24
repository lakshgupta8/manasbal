import { Injectable } from "@nestjs/common";
import type { AuditPage } from "@manasbal/types";
import { parsePageQuery, parseTimeKey, toPage, type PageQuery } from "../pagination/pagination.js";
import { getDb } from "../prisma/db.js";

// What only an admin can see.
@Injectable()
export class AdminService {
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
