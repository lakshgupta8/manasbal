import { Notice } from "@manasbal/ui";
import { connection } from "next/server";
import { getCategories } from "@/lib/categories";

export interface CategoriesProps {
  // What to say when there are none, and the note's lead word, in the page's language.
  readonly emptyText: string;
  readonly noteLead: string;
}

// Rendered on each request (connection()), never at build time, so a build needs no API. If the
// API is down, getCategories throws and the page's error.tsx takes over.
export async function Categories({ emptyText, noteLead }: CategoriesProps) {
  await connection();
  const categories = await getCategories();
  if (categories.length === 0) {
    return (
      <Notice tone="info" leadWord={noteLead}>
        {emptyText}
      </Notice>
    );
  }
  return (
    <ul>
      {categories.map((category) => (
        <li key={category.id}>{category.name}</li>
      ))}
    </ul>
  );
}
