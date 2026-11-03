import type { Role } from "@manasbal/types";

// One sign-in per role for people trying the demo. The password is public on purpose: it is in
// the README and the nightly workflow reads it from here. Nothing real sits behind these
// accounts, and the nightly reset restores them. This file holds constants only, so the
// workflow can import it with plain Node.
export const DEMO_PASSWORD = "quiet-mango-river-lamp";

export const DEMO_EMAILS: Readonly<Record<Role, string>> = {
  customer: "customer@example.com",
  seller: "seller@example.com",
  seller_staff: "seller-staff@example.com",
  support: "support@example.com",
  admin: "admin@example.com",
};

// The three roles the generated people don't have, with fixed ids and names so they never shift
// the random stream the rest of the data comes from.
export const DEMO_STAFF = [
  { id: "5eed0000-0000-4000-8000-000000000001", role: "seller_staff", name: "Demo Seller Staff" },
  { id: "5eed0000-0000-4000-8000-000000000002", role: "support", name: "Demo Support" },
  { id: "5eed0000-0000-4000-8000-000000000003", role: "admin", name: "Demo Admin" },
] as const satisfies readonly { id: string; role: Role; name: string }[];
