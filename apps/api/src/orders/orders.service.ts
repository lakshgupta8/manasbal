import { Injectable } from "@nestjs/common";
import type { OrderPage } from "@manasbal/types";
import { parsePageQuery, parseTimeKey, toPage, type PageQuery } from "../pagination/pagination.js";
import { getDb } from "../prisma/db.js";

// The signed-in user's orders, newest first.
@Injectable()
export class OrdersService {
  async list(userId: string, { cursor, limit }: PageQuery): Promise<OrderPage> {
    const params = parsePageQuery({ cursor, limit });
    const after = params.after === undefined ? undefined : parseTimeKey(params.after);

    const ordered = getDb()
      .orm.public.Order.where({ userId })
      .orderBy([(o) => o.createdAt.desc(), (o) => o.id.desc()]);
    const paged =
      after === undefined
        ? ordered
        : ordered.cursor({ createdAt: Temporal.Instant.from(after.createdAt), id: after.id });
    const rows = await paged
      .limit(params.take)
      .select("id", "status", "totalPaise", "createdAt")
      .all();

    const items = rows.map((row) => ({
      id: row.id,
      status: row.status,
      totalPaise: row.totalPaise,
      createdAt: row.createdAt.toString(),
    }));
    return toPage(items, params, (o) => `${o.createdAt}|${o.id}`);
  }
}
