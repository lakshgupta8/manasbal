// Shown while a page waits for its data.
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <p role="status" className="text-muted">
        Loading…
      </p>
    </div>
  );
}
