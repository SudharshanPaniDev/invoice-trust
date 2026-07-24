export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-8 py-10" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-32 animate-pulse rounded bg-border/50" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-border/40" />
      <div className="mt-6 h-32 animate-pulse rounded-lg border border-border bg-surface" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-border/30" />
        ))}
      </div>
    </main>
  );
}
