/**
 * Eval harness — runs REAL live Gemini extraction (not mocked, unlike tests/extract.test.ts)
 * against all 8 sample invoices, then scores each with the real validation pipeline.
 *
 * Separate from `pnpm test` on purpose: this makes live API calls (cost + Gemini free-tier
 * quota, D8), so it must never run in the fast, deterministic, free CI suite. Run on demand
 * via `pnpm eval`.
 *
 * The 3 D24 samples have a scripted, known-correct trust outcome — asserted here as a hard
 * regression check. The 5 D29 samples were deliberately built WITHOUT a scripted outcome
 * ("let the trust engine evaluate naturally") — this only captures and reports what actually
 * happened for those, it does not fake a pass/fail that would misrepresent them as scripted.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractInvoice } from "../lib/extract";
import { scoreInvoice, type ScoredInvoice } from "../lib/validation/confidence";

const ROOT = join(__dirname, "..");

interface ScriptedCheck {
  pass: boolean;
  detail: string;
}

interface EvalCase {
  name: string;
  path: string;
  mimeType: string;
  scripted?: (scored: ScoredInvoice) => ScriptedCheck[];
}

const CASES: EvalCase[] = [
  {
    name: "Clean invoice (scripted — should fully pass)",
    path: "tests/fixtures/sample-clean.pdf",
    mimeType: "application/pdf",
    scripted: (s) => [
      { pass: s.overall.canTrust === true, detail: `canTrust=${s.overall.canTrust} (expected true)` },
      { pass: s.overall.openFlags === 0, detail: `openFlags=${s.overall.openFlags} (expected 0)` },
    ],
  },
  {
    name: "Invalid GSTIN (scripted — checksum must fail)",
    path: "tests/fixtures/invoice-01.pdf",
    mimeType: "application/pdf",
    scripted: (s) => [
      { pass: s.overall.canTrust === false, detail: `canTrust=${s.overall.canTrust} (expected false)` },
      {
        pass: (s.fields.vendorGSTIN?.flags.length ?? 0) > 0,
        detail: `vendorGSTIN flags=${JSON.stringify(s.fields.vendorGSTIN?.flags ?? [])}`,
      },
    ],
  },
  {
    name: "Arithmetic mismatch (scripted — total.sum must fail)",
    path: "tests/fixtures/sample-mismatch.pdf",
    mimeType: "application/pdf",
    scripted: (s) => [
      { pass: s.overall.canTrust === false, detail: `canTrust=${s.overall.canTrust} (expected false)` },
      {
        pass: (s.fields.total?.flags.length ?? 0) > 0,
        detail: `total flags=${JSON.stringify(s.fields.total?.flags ?? [])}`,
      },
    ],
  },
  { name: "Scanned copy (unscripted)", path: "public/samples/scanned-invoice.pdf", mimeType: "application/pdf" },
  { name: "Phone photo (unscripted)", path: "public/samples/phone-photo-invoice.jpg", mimeType: "image/jpeg" },
  {
    name: "Stamped/annotated scan (unscripted)",
    path: "public/samples/stamped-scan-invoice.pdf",
    mimeType: "application/pdf",
  },
  { name: "Multi-page invoice (unscripted)", path: "public/samples/multipage-invoice.pdf", mimeType: "application/pdf" },
  {
    name: "Missing/illegible fields (unscripted)",
    path: "public/samples/missing-fields-invoice.pdf",
    mimeType: "application/pdf",
  },
];

function summarize(scored: ScoredInvoice) {
  const fields = Object.entries(scored.fields);
  const buckets = { high: 0, medium: 0, low: 0 };
  for (const [, f] of fields) {
    if (f.confidence >= 0.8) buckets.high++;
    else if (f.confidence >= 0.5) buckets.medium++;
    else buckets.low++;
  }
  const flags = fields.flatMap(([key, f]) => f.flags.map((flag) => `${key}: ${flag}`));
  return {
    isInvoice: scored.isInvoice,
    canTrust: scored.overall.canTrust,
    overallConfidence: scored.overall.confidence,
    fieldCount: fields.length,
    buckets,
    flags,
  };
}

async function main() {
  const lines: string[] = [];
  let scriptedPass = 0;
  let scriptedTotal = 0;

  for (const c of CASES) {
    console.log(`\n=== ${c.name} ===`);
    const bytes = readFileSync(join(ROOT, c.path));
    const result = await extractInvoice({ data: bytes, mimeType: c.mimeType });

    lines.push(`## ${c.name}\n`);
    if (!result.ok) {
      console.log(`EXTRACTION FAILED: ${result.error}`);
      lines.push(`**Extraction failed:** ${result.error}\n`);
      continue;
    }

    const scored = scoreInvoice(result.data);
    const summary = summarize(scored);
    console.log(JSON.stringify(summary, null, 2));

    lines.push(`- isInvoice: ${summary.isInvoice}`);
    lines.push(`- canTrust: ${summary.canTrust}`);
    lines.push(`- overall confidence: ${(summary.overallConfidence * 100).toFixed(0)}%`);
    lines.push(
      `- fields scored: ${summary.fieldCount} (high ${summary.buckets.high} / medium ${summary.buckets.medium} / low ${summary.buckets.low})`,
    );
    lines.push(summary.flags.length ? `- flags:\n  - ${summary.flags.join("\n  - ")}` : "- flags: none");

    if (c.scripted) {
      for (const check of c.scripted(scored)) {
        scriptedTotal++;
        if (check.pass) scriptedPass++;
        console.log(`  [${check.pass ? "PASS" : "FAIL"}] ${check.detail}`);
        lines.push(`- **scripted check:** [${check.pass ? "PASS" : "FAIL"}] ${check.detail}`);
      }
    }
    lines.push("");
  }

  lines.unshift(`Scripted regression checks: ${scriptedPass}/${scriptedTotal} passed.\n`);
  lines.unshift(`# Eval run\n`);
  writeFileSync(join(ROOT, "docs", "eval-results.md"), lines.join("\n"));

  console.log(`\n\nScripted regression checks: ${scriptedPass}/${scriptedTotal} passed.`);
  console.log(`Report written to docs/eval-results.md`);

  if (scriptedPass < scriptedTotal) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
