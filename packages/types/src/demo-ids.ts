import { z } from "zod";

// The app must never hold a real PAN, GSTIN or bank account number, so these fields accept only
// obviously fake DEMO- values. A real-looking number fails by its shape alone.
export const demoPanSchema = z
  .string()
  .regex(/^DEMO-PAN-\d{6}$/, "Use a demo PAN: DEMO-PAN- and 6 digits");

export const demoGstinSchema = z
  .string()
  .regex(/^DEMO-GSTIN-\d{8}$/, "Use a demo GSTIN: DEMO-GSTIN- and 8 digits");

export const demoBankAccountSchema = z
  .string()
  .regex(/^DEMO-BANK-\d{8}$/, "Use a demo bank account: DEMO-BANK- and 8 digits");

export type demoPan = z.infer<typeof demoPanSchema>;
export type demoGstin = z.infer<typeof demoGstinSchema>;
export type demoBankAccount = z.infer<typeof demoBankAccountSchema>;
