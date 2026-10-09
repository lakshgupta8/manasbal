// Shown on every page: the store is a portfolio demo and must never look like a real shop.
export function DemoBanner() {
  return (
    <p role="note" className="bg-ink px-4 py-2 text-center text-sm text-white">
      Demo store: nothing here is for sale. Payments and delivery are simulated.
    </p>
  );
}
