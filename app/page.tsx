import { prisma } from "@/lib/db";
import { DownloadSamples } from "./_components/DownloadSamples";
import { UploadForm } from "./_components/UploadForm";

export const dynamic = "force-dynamic";

const SEEDED_SAMPLES = [
  { fileUrl: "sample-clean.pdf", label: "Clean invoice", description: "Every check passes" },
  { fileUrl: "sample-invoice-01.pdf", label: "Invalid GSTIN", description: "Checksum fails" },
  { fileUrl: "sample-mismatch.pdf", label: "Arithmetic mismatch", description: "Subtotal + tax ≠ total" },
];

export default async function Home() {
  const rows = await prisma.invoice.findMany({
    where: { fileUrl: { in: SEEDED_SAMPLES.map((s) => s.fileUrl) } },
    select: { id: true, fileUrl: true },
  });
  const seeded = SEEDED_SAMPLES.flatMap((s) => {
    const row = rows.find((r) => r.fileUrl === s.fileUrl);
    return row ? [{ id: row.id, label: s.label, description: s.description }] : [];
  });

  return (
    <main className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="text-2xl font-semibold">Upload an invoice</h1>
      <p className="mt-1 text-sm text-muted">
        Each field&apos;s confidence is earned by validation (sums, tax math, GSTIN checksum),
        not claimed by the model.
      </p>

      <p className="mt-4 rounded-lg border border-warning/30 bg-warning-bg p-3 text-xs text-warning">
        ⚠ Demo only — this is a public, unauthenticated instance. Please upload sample or
        synthetic invoices only. Extraction uses Gemini&apos;s free tier, which may use
        submitted data to improve Google&apos;s models — do not upload real confidential
        financial documents.
      </p>

      <DownloadSamples seeded={seeded} />

      <UploadForm />
    </main>
  );
}
