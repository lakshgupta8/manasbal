import { describe, expect, it } from "vitest";
import { demoBankAccountSchema, demoGstinSchema, demoPanSchema } from "./demo-ids.js";

// Built from parts: written out whole, a PAN-shaped value trips the gitleaks PAN rule.
const PAN_SHAPED = "ABCPE" + "1234F";
// State code, a PAN, entity number, Z, check character: 15 characters, like a real GSTIN.
const GSTIN_SHAPED = "22" + PAN_SHAPED + "1Z5";
const PLAIN_ACCOUNT = "123456789012";

describe.each([
  { name: "PAN", schema: demoPanSchema, demo: "DEMO-PAN-123456" },
  { name: "GSTIN", schema: demoGstinSchema, demo: "DEMO-GSTIN-12345678" },
  { name: "bank account", schema: demoBankAccountSchema, demo: "DEMO-BANK-12345678" },
])("demo $name", ({ schema, demo }) => {
  it("accepts the demo format", () => {
    expect(schema.safeParse(demo).success).toBe(true);
  });

  it.each([PAN_SHAPED, GSTIN_SHAPED, PLAIN_ACCOUNT])("refuses the real-looking %s", (value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it("refuses an empty string", () => {
    expect(schema.safeParse("").success).toBe(false);
  });

  it("refuses the demo prefix with too few or too many digits, or text around it", () => {
    for (const value of [demo.slice(0, -1), `${demo}0`, ` ${demo}`, `${demo}\n`]) {
      expect(schema.safeParse(value).success).toBe(false);
    }
  });
});
