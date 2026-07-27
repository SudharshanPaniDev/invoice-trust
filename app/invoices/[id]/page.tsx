import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import type { StoredInvoice } from "@/lib/invoice-view";
import { getLiveScoredInvoice } from "@/lib/correct";
import { TrustBanner } from "../../_components/TrustBanner";
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

  // Duplicate status is derived, not stored (D50) — computed live here, against the
  // current invoices table, rather than trusted from a flag that could've been left stale
  // by anything that's happened to any OTHER invoice since this one was last written.
  const storedRow = row as unknown as StoredInvoice;
  const scored = await getLiveScoredInvoice(id, storedRow);
  if (!scored) notFound();

  const hasDocument = row.fileData != null;

  return (
    <main className="mx-auto max-w-4xl px-8 py-10">
      <Link href="/invoices" className="text-xs text-accent hover:text-accent-hover hover:underline">
        ← All invoices
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Invoice</h1>
      {hasDocument && (
        <p className="mt-2 inline-block rounded-full border border-border bg-border/20 px-2 py-1 text-xs font-medium text-muted">
          Sample invoice — curated example, not a real submission (see decisions.md D21/D24)
        </p>
      )}

      <div className="mt-5">
        <TrustBanner canTrust={scored.overall.canTrust} openFlags={scored.overall.openFlags} />
        {row.status !== "trusted" && (
          <div className="mt-3">
            <MarkTrusted id={row.id} canTrust={scored.overall.canTrust} openFlags={scored.overall.openFlags} />
          </div>
        )}
        {row.status === "trusted" && (
          <p className="mt-3 text-sm font-medium text-success">✓ Marked trusted</p>
        )}
      </div>

      <section className="mt-8">
        <DetailInteractive invoiceId={row.id} fields={scored.fields} hasDocument={hasDocument} />
      </section>
    </main>
  );
}
