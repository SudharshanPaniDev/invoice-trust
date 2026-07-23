import Link from "next/link";
import { prisma } from "@/lib/db";
import { parseFilter, buildInvoiceWhere } from "@/lib/query";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  needs_review: "bg-amber-100 text-amber-800",
  trusted: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  processing: "bg-gray-100 text-gray-600",
};
const badge = (s: string) => BADGE[s] ?? "bg-gray-100 text-gray-600";

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
    },
  });

  const inputCls = "rounded border px-2 py-1 text-sm";

  return (
    <main className="mx-auto max-w-4xl p-8 font-sans">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">+ Upload</Link>
      </div>

      {/* Structured query (D4) — filters map to indexed columns (D9) */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded border bg-gray-50 p-3">
        <label className="flex flex-col text-xs text-gray-500">
          Vendor
          <input name="vendor" defaultValue={first(params.vendor)} placeholder="contains…" className={inputCls} />
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          Status
          <select name="status" defaultValue={first(params.status)} className={inputCls}>
            <option value="">any</option>
            <option value="needs_review">needs review</option>
            <option value="trusted">trusted</option>
            <option value="failed">failed</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          Min total
          <input name="minTotal" type="number" step="0.01" defaultValue={first(params.minTotal)} className={`${inputCls} w-24`} />
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          Max total
          <input name="maxTotal" type="number" step="0.01" defaultValue={first(params.maxTotal)} className={`${inputCls} w-24`} />
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          From
          <input name="from" type="date" defaultValue={first(params.from)} className={inputCls} />
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          To
          <input name="to" type="date" defaultValue={first(params.to)} className={inputCls} />
        </label>
        <button type="submit" className="rounded bg-black px-3 py-1.5 text-sm text-white">Filter</button>
        {hasFilters && (
          <Link href="/invoices" className="text-sm text-blue-600 hover:underline">clear</Link>
        )}
      </form>

      <p className="mt-3 text-xs text-gray-500">
        {invoices.length} {invoices.length === 1 ? "result" : "results"}
        {hasFilters ? " (filtered)" : ""}
      </p>

      {invoices.length === 0 ? (
        <div className="mt-6 rounded border border-dashed p-10 text-center text-sm text-gray-500">
          {hasFilters ? (
            <>No invoices match these filters.</>
          ) : (
            <>No invoices yet. <Link href="/" className="text-blue-600 hover:underline">Upload one</Link>.</>
          )}
        </div>
      ) : (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4 font-normal">Vendor</th>
              <th className="py-2 pr-4 font-normal">Date</th>
              <th className="py-2 pr-4 font-normal">Total</th>
              <th className="py-2 pr-4 font-normal">Status</th>
              <th className="py-2 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b">
                <td className="py-2 pr-4 font-medium">{inv.vendorName ?? "—"}</td>
                <td className="py-2 pr-4">{inv.invoiceDate ? inv.invoiceDate.toISOString().slice(0, 10) : "—"}</td>
                <td className="py-2 pr-4">{inv.total != null ? inv.total.toString() : "—"}</td>
                <td className="py-2 pr-4">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge(inv.status)}`}>
                    {inv.status.replace("_", " ")}
                  </span>
                </td>
                <td className="py-2">
                  <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:underline">open →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
