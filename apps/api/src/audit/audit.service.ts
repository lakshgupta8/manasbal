import { Injectable } from "@nestjs/common";
import { getDb } from "../prisma/db.js";

// The orm of getDb(), or of a transaction.
type Orm = Pick<ReturnType<typeof getDb>, "orm">["orm"];

// Who did it: an actor, or no known account (userId null), such as a sign-in with an email that
// has no account. Never the email itself.
export interface AuditWho {
  userId: string | null;
  requestId: string;
}

// What an action was done to.
export interface AuditTarget {
  // "address", later "order", "seller", ...
  type: string;
  id: string;
}

// Writes one row to audit_logs. It stores who did what to which record, never the request body or
// any field values: addresses hold names and where people live.
@Injectable()
export class AuditService {
  // Pass the transaction's orm so the audit row is saved or rolled back together with the change
  // it records.
  // A null target is an event about no known record.
  async record(
    who: AuditWho,
    action: string,
    target: AuditTarget | null,
    orm: Orm = getDb().orm,
  ): Promise<void> {
    await orm.public.AuditLog.create({
      actorId: who.userId,
      action,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      requestId: who.requestId,
      createdByVisitor: true,
    });
  }
}
