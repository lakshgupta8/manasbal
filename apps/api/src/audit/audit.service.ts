import { Injectable } from "@nestjs/common";
import { getDb } from "../prisma/db.js";
import type { Actor } from "../users/demo-user.guard.js";

// The orm of getDb(), or of a transaction.
type Orm = Pick<ReturnType<typeof getDb>, "orm">["orm"];

// What an action was done to.
export interface AuditTarget {
  // "address", later "order", "seller", ...
  type: string;
  id: string;
}

// Writes one row to audit_logs. It stores who did what to which record, never the request body or
// any field values: addresses hold names and phone numbers.
@Injectable()
export class AuditService {
  // Pass the transaction's orm so the audit row is saved or rolled back together with the change
  // it records.
  async record(
    who: Actor,
    action: string,
    target: AuditTarget,
    orm: Orm = getDb().orm,
  ): Promise<void> {
    await orm.public.AuditLog.create({
      actorId: who.userId,
      action,
      targetType: target.type,
      targetId: target.id,
      requestId: who.requestId,
    });
  }
}
