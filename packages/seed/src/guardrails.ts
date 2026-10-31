// Words no seeded text may contain: restricted products, and health or result claims. Each
// matches at the start of a word, in any case, so "cures" and "Cured" fail but "secure" passes.
export const FORBIDDEN_WORDS = [
  "e-cigarette",
  "tobacco",
  "alcohol",
  "medicine",
  "weapon",
  "wildlife",
  "adult",
  "crypto",
  "cure",
  "guaranteed",
] as const;

const FORBIDDEN = FORBIDDEN_WORDS.map((word) => ({
  word,
  // "e-cigarette" also catches "e cigarette" and "ecigarette".
  pattern: new RegExp(String.raw`\b${word.replace("-", "[- ]?")}`, "i"),
}));

// Throws on the first forbidden word, naming it and where the text came from.
export function assertAllowed(text: string, source = "text"): void {
  const hit = FORBIDDEN.find(({ pattern }) => pattern.test(text));
  if (hit) {
    throw new Error(`${source} contains the forbidden word "${hit.word}": ${text}`);
  }
}
