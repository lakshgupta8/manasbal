import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <Image src="/manasbal-mark.svg" alt="" width={96} height={96} priority />
      <h1 className="text-4xl font-semibold tracking-tight text-ink dark:text-white">Manasbal</h1>
      <p className="max-w-md text-lg text-ink/75 dark:text-white/75">
        A demo multi-vendor marketplace, under construction.
      </p>
    </main>
  );
}
