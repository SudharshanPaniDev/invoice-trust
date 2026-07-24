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
    <main className="mx-auto max-w-4xl px-8 py-10">
      <Link href="/invoices" className="text-xs text-accent hover:text-accent-hover hover:underline">
        ← All invoices
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Invoice</h1>
      <p className="mt-1 text-xs text-muted">
        <code className="rounded bg-surface px-1 py-0.5">{view.id}</code> · status{" "}
        <span className="font-medium text-foreground">{view.status}</span> ·{" "}
        {view.createdAt.toISOString().slice(0, 10)}
      </p>
      {view.hasDocument && (
        <p className="mt-2 inline-block rounded-full border border-border bg-border/20 px-2 py-1 text-xs font-medium text-muted">
          Sample invoice — curated example, not a real submission (see decisions.md D21/D24)
        </p>
      )}

      <div className="mt-5">
        <TrustBanner canTrust={view.canTrust} openFlags={view.openFlags} />
        {view.status !== "trusted" && (
          <div className="mt-3">
            <MarkTrusted id={view.id} canTrust={view.canTrust} openFlags={view.openFlags} />
          </div>
        )}
        {view.status === "trusted" && (
          <p className="mt-3 text-sm font-medium text-success">✓ Marked trusted</p>
        )}
      </div>

      <section className="mt-8">
        <DetailInteractive invoiceId={view.id} fields={view.fields} hasDocument={view.hasDocument} />
      </section>
    </main>
  );
}
