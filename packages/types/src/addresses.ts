import { z } from "zod";

// What a buyer types into the address form. The API validates every request with these, and
// the shop can run the same checks in the form before sending anything.
export const addressInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    line1: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    pincode: z.string().regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code"),
    phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"),
    isDefault: z.boolean().optional(),
  })
  // Unknown fields are refused rather than dropped, so a client can't think it set userId.
  .strict();

// An edit sends only the fields that change, but at least one.
export const addressPatchSchema = addressInputSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "Send at least one field to change");

export type AddressInput = z.infer<typeof addressInputSchema>;
export type AddressPatch = z.infer<typeof addressPatchSchema>;
