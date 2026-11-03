import { z } from "zod";

// One place the user is signed in: a refresh-token family that still works. Never a token, its
// hash, the raw user agent or an IP address.
export const sessionSchema = z.object({
  // The family id, for DELETE /me/sessions/:id.
  id: z.uuid(),
  // A short name such as "Firefox on Windows", or "Unknown browser".
  browser: z.string(),
  startedAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime(),
  // Whether the access token making the request belongs to this session.
  current: z.boolean(),
});

// What GET /me/sessions answers, most recently used first.
export const sessionListSchema = z.array(sessionSchema);

export type Session = z.infer<typeof sessionSchema>;
