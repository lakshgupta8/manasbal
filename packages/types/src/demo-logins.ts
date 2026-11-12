import type { Role } from "./roles.js";

// One sign-in per role for people trying the demo; the seed creates them and the API keeps them
// open for everyone (no lockout, no two-step). Their password is public, in @manasbal/seed.
// Constants only, with a type-only import, so the nightly workflow can import this file with
// plain Node.
export const DEMO_EMAILS: Readonly<Record<Role, string>> = {
  customer: "customer@example.com",
  seller: "seller@example.com",
  seller_staff: "seller-staff@example.com",
  support: "support@example.com",
  admin: "admin@example.com",
};

const demoEmails = new Set(Object.values(DEMO_EMAILS));

// Whether an email is one of the demo logins, ignoring case and spaces around it.
export function isDemoEmail(email: string): boolean {
  return demoEmails.has(email.trim().toLowerCase());
}
