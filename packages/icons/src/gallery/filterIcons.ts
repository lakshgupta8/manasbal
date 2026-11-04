/** The icons whose name contains the query, ignoring case and spaces around it; all of them for an empty query. */
export function filterIcons<T extends { readonly name: string }>(
  icons: readonly T[],
  query: string,
): T[] {
  const wanted = query.trim().toLowerCase();
  return icons.filter((icon) => icon.name.includes(wanted));
}
