import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-8 py-4">
        <Link
          href="/"
          className="rounded-sm text-base font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Invoice Trust Layer
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/"
            className="rounded-sm text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Upload
          </Link>
          <Link
            href="/invoices"
            className="rounded-sm text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Invoices
          </Link>
        </nav>
      </div>
    </header>
  );
}
