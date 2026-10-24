import { connection } from "next/server";
import { getCategories } from "@/lib/categories";

// Rendered on each request (connection()), never at build time, so a build without the API
// doesn't bake in the "unavailable" message.
export async function Categories() {
  await connection();
  const categories = await getCategories();
  if (categories === null) return <p>Categories are unavailable right now</p>;
  return (
    <ul>
      {categories.map((category) => (
        <li key={category.id}>{category.name}</li>
      ))}
    </ul>
  );
}
