import { getDb } from "../prisma/db.js";

// The orm of getDb(), or of a transaction.
type Orm = Pick<ReturnType<typeof getDb>, "orm">["orm"];

// Ends a session: every token in the refresh-token family stops working, the newest included.
// Used when a used token comes back (reuse), at sign-out, and when a user ends a session.
export async function revokeFamily(familyId: string, orm: Orm = getDb().orm): Promise<void> {
  await orm.public.RefreshToken.where({ familyId, revokedAt: null }).updateAndCount({
    revokedAt: Temporal.Now.instant(),
  });
}
