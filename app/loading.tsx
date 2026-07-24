export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-8 py-10" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-56 animate-pulse rounded bg-border/50" />
      <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-border/40" />
      <div className="mt-4 h-14 animate-pulse rounded-lg bg-border/30" />
      <div className="mt-6 h-64 animate-pulse rounded-lg border border-border bg-surface" />
      <div className="mt-6 h-16 animate-pulse rounded-lg border border-border bg-surface" />
    </main>
  );
}
