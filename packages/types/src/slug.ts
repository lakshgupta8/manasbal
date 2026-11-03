// Lower case, with anything but letters and digits turned into single hyphens: "Kadamora
// Velvet & Co." becomes "kadamora-velvet-co". The seed has the same rule (packages/seed
// people.ts); its test checks the two agree.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
}
