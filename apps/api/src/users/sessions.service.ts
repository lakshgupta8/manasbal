import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Session } from "@manasbal/types";
import { AuditService } from "../audit/audit.service.js";
import type { Actor } from "../auth/current-user.js";
import { revokeFamily } from "../auth/revoke-family.js";
import { getDb } from "../prisma/db.js";
import { browserName } from "./browser-name.js";

export const NO_SESSION = "No session with this id";

// Where a user is signed in: one session per refresh-token family. A family is live while its
// newest token is unused, not revoked and not expired; that token was made at the last sign-in
// or refresh, so its time is when the session was last used.
@Injectable()
export class SessionsService {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(@Inject(AuditService) private readonly audit: Pick<AuditService, "record">) {}

  async list(userId: string, currentSessionId: string | undefined): Promise<Session[]> {
    const rows = await getDb()
      .orm.public.RefreshToken.where({ userId })
      .select("familyId", "createdAt", "usedAt", "revokedAt", "expiresAt", "userAgent")
      .all();
    const now = Temporal.Now.instant();
    const started = new Map<string, Temporal.Instant>();
    const live = rows.filter(
      (row) =>
        row.usedAt === null &&
        row.revokedAt === null &&
        Temporal.Instant.compare(row.expiresAt, now) > 0,
    );
    for (const row of rows) {
      const first = started.get(row.familyId);
      if (first === undefined || Temporal.Instant.compare(row.createdAt, first) < 0) {
        started.set(row.familyId, row.createdAt);
      }
    }
    return live
      .sort((a, b) => Temporal.Instant.compare(b.createdAt, a.createdAt))
      .map((row) => ({
        id: row.familyId,
        browser: browserName(row.userAgent),
        startedAt: started.get(row.familyId)!.toString(),
        lastUsedAt: row.createdAt.toString(),
        current: row.familyId === currentSessionId,
      }));
  }

  // Signs the session out everywhere it is used. Another user's session, or one already ended,
  // answers 404 exactly like an unknown id.
  end(who: Actor, familyId: string): Promise<void> {
    return getDb().transaction(async (tx) => {
      const owned = await tx.orm.public.RefreshToken.where({
        familyId,
        userId: who.userId,
        revokedAt: null,
      })
        .select("id")
        .first();
      if (owned === null) throw new NotFoundException(NO_SESSION);
      await revokeFamily(familyId, tx.orm);
      await this.audit.record(who, "auth.session.end", { type: "session", id: familyId }, tx.orm);
    });
  }
}
