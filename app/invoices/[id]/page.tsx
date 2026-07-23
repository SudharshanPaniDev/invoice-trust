import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toView, type StoredInvoice } from "@/lib/invoice-view";
import { TrustBanner } from "../../_components/ScoredFields";
import { MarkTrusted } from "./MarkTrusted";
import { DetailInteractive } from "./DetailInteractive";

export const dynamic = "force-dynamic";

export default async function InvoiceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.invoice.findUnique({
    where: { id },
    include: { lineItems: true },
  });
  if (!row) notFound();

  const view = toView(row as unknown as StoredInvoice);

  return (
    <main className="mx-auto max-w-4xl p-8 font-sans">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Invoice</h1>
        <Link href="/invoices" className="text-sm text-blue-600 hover:underline">
          ← All invoices
        </Link>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        <code>{view.id}</code> · status <span className="font-medium">{view.status}</span> ·{" "}
        {view.createdAt.toISOString().slice(0, 10)}
      </p>

      <div className="mt-5">
        <TrustBanner canTrust={view.canTrust} openFlags={view.openFlags} />
        {view.status !== "trusted" && (
          <div className="mt-3">
            <MarkTrusted id={view.id} canTrust={view.canTrust} />
          </div>
        )}
        {view.status === "trusted" && (
          <p className="mt-3 text-sm font-medium text-green-700">✓ Marked trusted</p>
        )}
      </div>

      <section className="mt-8">
        <DetailInteractive invoiceId={view.id} fields={view.fields} hasDocument={view.hasDocument} />
      </section>
    </main>
  );
}
