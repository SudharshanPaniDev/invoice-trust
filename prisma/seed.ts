/**
 * Seeds sample invoices used ONLY for the provenance demo (click a field -> see its source
 * highlighted on the document). These are the only rows that ever get `fileData` populated
 * (see decisions D21, D22) — real user uploads never go through this path.
 *
 * Idempotent: re-running skips a sample whose fileUrl already exists.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/db";
import { parseExtraction } from "../lib/schema";
import { scoreInvoice } from "../lib/validation/confidence";
import { storeSampleInvoice } from "../lib/store";

// Three samples, each demonstrating a distinct trust outcome (D24):
// invalid GSTIN (real Gemini extraction, D11) / clean-all-pass / arithmetic mismatch
// (both hand-authored ground truth, D24 — extraction realism is already proven by the
// first sample + the real bill tested in D20; these two exist to reliably demonstrate
// designed rule outcomes, not to re-test extraction accuracy).
const SAMPLES = [
  {
    fileUrl: "sample-invoice-01.pdf",
    pdfPath: "tests/fixtures/invoice-01.pdf",
    extractedPath: "tests/fixtures/invoice-01.extracted.json",
  },
  {
    fileUrl: "sample-clean.pdf",
    pdfPath: "tests/fixtures/sample-clean.pdf",
    extractedPath: "tests/fixtures/sample-clean.extracted.json",
  },
  {
    fileUrl: "sample-mismatch.pdf",
    pdfPath: "tests/fixtures/sample-mismatch.pdf",
    extractedPath: "tests/fixtures/sample-mismatch.extracted.json",
  },
];

async function seedSample(sample: (typeof SAMPLES)[number]) {
  const existing = await prisma.invoice.findFirst({ where: { fileUrl: sample.fileUrl } });
  if (existing) {
    console.log(`skip (already seeded): ${sample.fileUrl}`);
    return;
  }

  const root = join(__dirname, "..");
  const pdfBytes = readFileSync(join(root, sample.pdfPath));
  const extractedJson = JSON.parse(readFileSync(join(root, sample.extractedPath), "utf8"));

  const parsed = parseExtraction(extractedJson);
  if (!parsed.ok) throw new Error(`${sample.extractedPath} failed to parse: ${parsed.error}`);

  const scored = scoreInvoice(parsed.data);
  const invoice = await storeSampleInvoice(parsed.data, scored, sample.fileUrl, pdfBytes);
  console.log(`seeded: ${sample.fileUrl} -> ${invoice.id}`);
}

async function main() {
  for (const sample of SAMPLES) {
    await seedSample(sample);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
