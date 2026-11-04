import type { Role } from "@manasbal/types";

// The password of the demo logins, whose emails are DEMO_EMAILS in @manasbal/types. It is public
// on purpose: it is in the README and the nightly workflow reads it from here. Nothing real sits
// behind these accounts, and the nightly reset restores them. This file holds constants only, so
// the workflow can import it with plain Node.
// NOSONAR below: a deliberately public demo password, not a secret (see the README).
export const DEMO_PASSWORD = "quiet-mango-river-lamp"; // NOSONAR

// The three roles the generated people don't have, with fixed ids and names so they never shift
// the random stream the rest of the data comes from.
export const DEMO_STAFF = [
  { id: "5eed0000-0000-4000-8000-000000000001", role: "seller_staff", name: "Demo Seller Staff" },
  { id: "5eed0000-0000-4000-8000-000000000002", role: "support", name: "Demo Support" },
  { id: "5eed0000-0000-4000-8000-000000000003", role: "admin", name: "Demo Admin" },
] as const satisfies readonly { id: string; role: Role; name: string }[];
