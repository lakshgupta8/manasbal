import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCategories } from "@/lib/categories";

// Rendered on each request (connection()), never at build time, so a build without the API
// doesn't bake in the "unavailable" message.
async function Categories() {
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

export default function Home() {
  return (
    <main className="flex flex-col flex-1 justify-center items-center gap-6 px-6 py-24 text-center">
      <Image src="/manasbal-mark.svg" alt="" width={96} height={96} priority />
      <h1 className="font-semibold text-ink dark:text-white text-4xl tracking-tight">Manasbal</h1>
      <p className="max-w-md text-ink/75 dark:text-white/75 text-lg">
        A demo multi-vendor marketplace, under construction.
      </p>
      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading">Categories</h2>
        <Suspense fallback={<p>Loading categories…</p>}>
          <Categories />
        </Suspense>
      </section>
    </main>
  );
}
