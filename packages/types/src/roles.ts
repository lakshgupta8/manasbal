import { z } from "zod";

// Every role a user can have. The users.role column is a string; this list is what it may hold.
// seller_staff works for a seller; the link to that seller arrives in Phase 10.
export const roleSchema = z.enum(["customer", "seller", "seller_staff", "support", "admin"]);

export type Role = z.infer<typeof roleSchema>;

export const ROLES: readonly Role[] = roleSchema.options;

// The role every new account starts with.
export const NEW_ACCOUNT_ROLE: Role = "customer";
