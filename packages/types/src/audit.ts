import { z } from "zod";

// One row of the audit log: who did what to which record. Never the values that changed. The
// actor and the target are null for an event about no known account (a sign-in with an unknown
// email).
export const auditEntrySchema = z.object({
  id: z.uuid(),
  actorId: z.uuid().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.uuid().nullable(),
  requestId: z.string(),
  createdAt: z.iso.datetime(),
});

// What GET /admin/audit-log answers. One page, newest first; nextCursor fetches the next page, and
// is null on the last one.
export const auditPageSchema = z.object({
  items: z.array(auditEntrySchema),
  nextCursor: z.string().nullable(),
});

export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type AuditPage = z.infer<typeof auditPageSchema>;
