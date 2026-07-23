import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  needs_review: "bg-amber-100 text-amber-800",
  trusted: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  processing: "bg-gray-100 text-gray-600",
};

function badge(status: string) {
  return BADGE[status] ?? "bg-gray-100 text-gray-600";
}

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      vendorName: true,
      total: true,
      invoiceDate: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <main className="mx-auto max-w-4xl p-8 font-sans">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          + Upload
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="mt-10 rounded border border-dashed p-10 text-center text-sm text-gray-500">
          No invoices yet. <Link href="/" className="text-blue-600 hover:underline">Upload one</Link> to get started.
        </div>
      ) : (
        <table className="mt-6 w-full border-collapse text-sm">
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
                <td className="py-2 pr-4">
                  {inv.invoiceDate ? inv.invoiceDate.toISOString().slice(0, 10) : "—"}
                </td>
                <td className="py-2 pr-4">{inv.total != null ? inv.total.toString() : "—"}</td>
                <td className="py-2 pr-4">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge(inv.status)}`}>
                    {inv.status.replace("_", " ")}
                  </span>
                </td>
                <td className="py-2">
                  <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:underline">
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
