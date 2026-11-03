import { NotFoundException } from "@nestjs/common";
import { assertOwner } from "./assert-owner.js";

const OWNER = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const STRANGER = "0f1e2d3c-4b5a-4968-8776-655443322110";

describe("assertOwner", () => {
  it("passes the owner's record", () => {
    const record = { id: "r1", userId: OWNER };

    expect(() => assertOwner(record, OWNER, "No such thing")).not.toThrow();
  });

  it("answers 404 for a missing record and for another user's, alike", () => {
    const missing = new NotFoundException("No such thing");

    expect(() => assertOwner(null, OWNER, "No such thing")).toThrow(missing);
    expect(() => assertOwner({ id: "r1", userId: OWNER }, STRANGER, "No such thing")).toThrow(
      missing,
    );
  });
});
