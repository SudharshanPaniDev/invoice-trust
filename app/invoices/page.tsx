import Link from "next/link";
import { prisma } from "@/lib/db";
import { parseFilter, buildInvoiceWhere } from "@/lib/query";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  needs_review: "bg-warning-bg text-warning",
  trusted: "bg-success-bg text-success",
  failed: "bg-danger-bg text-danger",
  processing: "bg-border/40 text-muted",
};
const badge = (s: string) => BADGE[s] ?? "bg-border/40 text-muted";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = parseFilter(params);
  const where = buildInvoiceWhere(filter);
  const hasFilters = Object.keys(where).length > 0;

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      vendorName: true,
      total: true,
      invoiceDate: true,
      status: true,
      fileData: true,
    },
  });

  const inputCls = "rounded-md border border-border bg-background px-2 py-1 text-sm";

  return (
    <main className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      <p className="mt-1 text-sm text-muted">
        Search and filter everything that&apos;s been extracted so far.
      </p>

      {/* Structured query (D4) — filters map to indexed columns (D9) */}
      <form
        method="get"
        className="mt-6 rounded-lg border border-border bg-surface p-4"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <label className="flex flex-col text-xs text-muted">
            Vendor
            <input name="vendor" defaultValue={first(params.vendor)} placeholder="contains…" className={inputCls} />
          </label>
          <label className="flex flex-col text-xs text-muted">
            Status
            <select name="status" defaultValue={first(params.status)} className={inputCls}>
              <option value="">any</option>
              <option value="needs_review">needs review</option>
              <option value="trusted">trusted</option>
              <option value="failed">failed</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-muted">
            Min total
            <input name="minTotal" type="number" step="0.01" defaultValue={first(params.minTotal)} className={inputCls} />
          </label>
          <label className="flex flex-col text-xs text-muted">
            Max total
            <input name="maxTotal" type="number" step="0.01" defaultValue={first(params.maxTotal)} className={inputCls} />
          </label>
          <label className="flex flex-col text-xs text-muted">
            From
            <input name="from" type="date" defaultValue={first(params.from)} className={inputCls} />
          </label>
          <label className="flex flex-col text-xs text-muted">
            To
            <input name="to" type="date" defaultValue={first(params.to)} className={inputCls} />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Filter
          </button>
          {hasFilters && (
            <Link href="/invoices" className="text-sm text-accent hover:text-accent-hover hover:underline">
              clear
            </Link>
          )}
        </div>
      </form>

      <p className="mt-3 text-xs text-muted">
        {invoices.length} {invoices.length === 1 ? "result" : "results"}
        {hasFilters ? " (filtered)" : ""}
      </p>

      {invoices.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
          {hasFilters ? (
            <>No invoices match these filters.</>
          ) : (
            <>
              No invoices yet.{" "}
              <Link href="/" className="text-accent hover:text-accent-hover hover:underline">
                Upload one
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-4 font-normal">Vendor</th>
              <th className="py-2 pr-4 font-normal">Date</th>
              <th className="py-2 pr-4 font-normal text-right">Total</th>
              <th className="py-2 pr-4 font-normal">Status</th>
              <th className="py-2 pr-4 font-normal"></th>
              <th className="py-2 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => (
              <tr
                key={inv.id}
                className={`border-b border-border hover:bg-accent/5 ${i % 2 === 1 ? "bg-surface/60" : ""}`}
              >
                <td className="py-2 pr-4 font-medium">{inv.vendorName ?? "—"}</td>
                <td className="py-2 pr-4 text-muted">
                  {inv.invoiceDate ? inv.invoiceDate.toISOString().slice(0, 10) : "—"}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {inv.total != null ? inv.total.toString() : "—"}
                </td>
                <td className="py-2 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge(inv.status)}`}>
                    {inv.status.replace("_", " ")}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  {inv.fileData != null && (
                    <span
                      title="Curated sample invoice, not a real submission"
                      className="rounded-full border border-border bg-border/20 px-2 py-0.5 text-xs font-medium text-muted"
                    >
                      sample
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="rounded-sm text-accent hover:text-accent-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
