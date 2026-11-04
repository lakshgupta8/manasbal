import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";

// Every message's dotted key, such as "Frame.skipLink". The draft note is not a message.
function keys(messages: object, prefix = ""): string[] {
  return Object.entries(messages)
    .filter(([key]) => key !== "_status")
    .flatMap(([key, value]) =>
      typeof value === "object" && value !== null
        ? keys(value as object, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    )
    .sort();
}

describe("messages", () => {
  it("has every English message in Hindi, and nothing more", () => {
    expect(keys(hi)).toEqual(keys(en));
  });

  it("marks the Hindi as a draft until a native speaker reads it", () => {
    expect(hi._status).toBe("draft: not yet read by a native speaker");
    expect(hi.Frame.draftNote).not.toBe("");
    expect(en.Frame.draftNote).toBe("");
  });
});
