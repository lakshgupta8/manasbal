// Lower case, with anything but letters and digits turned into single hyphens: "Kadamora
// Velvet & Co." becomes "kadamora-velvet-co". The API and the seed both use this one rule, so a
// seeded store's slug is the one the API would make from its name.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
}
