export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-8 py-10" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-24 animate-pulse rounded bg-border/40" />
      <div className="mt-2 h-7 w-40 animate-pulse rounded bg-border/50" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-border/40" />
      <div className="mt-5 h-14 animate-pulse rounded-lg border border-border bg-surface" />
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-lg border border-border bg-surface" />
        <div className="h-80 animate-pulse rounded-lg border border-border bg-surface" />
      </div>
    </main>
  );
}
