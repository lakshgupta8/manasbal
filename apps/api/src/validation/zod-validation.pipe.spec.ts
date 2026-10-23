import { BadRequestException } from "@nestjs/common";
import { addressInputSchema, addressPatchSchema } from "@manasbal/types";
import { ZodValidationPipe } from "./zod-validation.pipe.js";

const address = {
  name: "Test Buyer",
  line1: "12 Sample Lane",
  city: "Sampleton",
  state: "Example State",
  pincode: "190006",
  phone: "9800000000",
};

// The messages of the 400 the pipe throws.
function messagesOf(run: () => unknown): string[] {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return ((error as BadRequestException).getResponse() as { message: string[] }).message;
  }
  throw new Error("expected the pipe to refuse the value");
}

describe("ZodValidationPipe", () => {
  const input = new ZodValidationPipe(addressInputSchema);
  const patch = new ZodValidationPipe(addressPatchSchema);

  it("passes on the parsed value", () => {
    expect(input.transform({ ...address, name: "  Test Buyer  " })).toEqual(address);
  });

  it("names the field of every problem", () => {
    const messages = messagesOf(() =>
      input.transform({ ...address, pincode: "012345", phone: "1" }),
    );

    expect(messages).toEqual([
      "pincode: Enter a 6-digit PIN code",
      "phone: Enter a 10-digit mobile number",
    ]);
  });

  it("refuses fields the schema doesn't know", () => {
    const messages = messagesOf(() => input.transform({ ...address, userId: "someone-else" }));

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("userId");
  });

  it("refuses an edit that changes nothing", () => {
    expect(messagesOf(() => patch.transform({}))).toEqual(["Send at least one field to change"]);
  });

  it("accepts an edit of one field", () => {
    expect(patch.transform({ city: "Othertown" })).toEqual({ city: "Othertown" });
  });
});
