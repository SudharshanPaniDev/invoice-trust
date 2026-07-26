/**
 * Permanent regression check for the D25 bug — the provenance overlay once landed on the
 * wrong region of the document because its position was computed in pixels against the
 * canvas's native render resolution while the canvas is actually displayed at a smaller
 * CSS size. The fix (percentage-based positioning) was verified once, live, with a
 * throwaway script that was deleted afterward — this is that check made permanent.
 *
 * For each of a few known bbox-bearing fields on a seeded sample, independently computes
 * the expected overlay pixel rect from the field's *actual stored bbox* (read straight
 * from Postgres, not from anything the component itself computed) plus the canvas's real
 * on-screen `getBoundingClientRect()`, and asserts the rendered overlay matches. Requires
 * the dev server running (`pnpm dev`) and the DB seeded (`pnpm db:seed`). Run via
 * `pnpm check:provenance`.
 */
import { chromium } from "playwright";
import { prisma } from "../lib/db";

const BASE_URL = "http://localhost:3000";
const TOLERANCE_PX = 3;

const FIELD_LABELS: Record<string, string> = {
  vendorName: "Vendor",
  vendorGSTIN: "GSTIN",
  invoiceNo: "Invoice No",
  subtotal: "Subtotal",
  total: "Total",
};

interface ScoredFieldRow {
  bbox?: [number, number, number, number] | null;
}

async function main() {
  const row = await prisma.invoice.findFirst({
    where: { fileUrl: "sample-invoice-01.pdf" },
    select: {
      id: true,
      vendorNameField: true,
      vendorGSTINField: true,
      invoiceNoField: true,
      subtotalField: true,
      totalField: true,
    },
  });
  await prisma.$disconnect();

  if (!row) {
    console.error("Seeded sample 'sample-invoice-01.pdf' not found — run `pnpm db:seed` first.");
    process.exit(1);
  }

  const keys = ["vendorName", "vendorGSTIN", "invoiceNo", "subtotal", "total"] as const;
  const candidates = keys
    .map((key) => ({ key, field: row[`${key}Field` as keyof typeof row] as ScoredFieldRow | null }))
    .filter(
      (c): c is { key: (typeof keys)[number]; field: ScoredFieldRow } => !!c.field?.bbox,
    );

  if (candidates.length === 0) {
    console.error("No bbox-bearing fields found on the seeded sample — nothing to check.");
    process.exit(1);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/invoices/${row.id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 10000 });
  await page.waitForTimeout(500); // let the PDF finish rendering onto the canvas

  const lines: string[] = [`# Provenance overlay check (D25 regression guard)\n`];
  let failures = 0;

  for (const { key, field } of candidates) {
    const label = FIELD_LABELS[key] ?? key;
    // Match the exact label cell, not a substring of the row's aggregated text — a plain
    // hasText string match on the <tr> would let "Total" match the "Subtotal" row too
    // (it contains "total"), since Playwright's hasText is a case-insensitive substring
    // match by default.
    const labelCell = page
      .locator("table")
      .first()
      .locator("td", { hasText: new RegExp(`^${label}$`) })
      .first();
    const row_ = labelCell.locator("xpath=ancestor::tr");
    await row_.click();
    await page.waitForTimeout(200);

    const geometry = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const overlay = document.querySelector(".border-accent.bg-accent\\/20");
      if (!canvas || !overlay) return null;
      const c = canvas.getBoundingClientRect();
      const o = overlay.getBoundingClientRect();
      return {
        canvas: { top: c.top, left: c.left, width: c.width, height: c.height },
        overlay: { top: o.top, left: o.left, width: o.width, height: o.height },
      };
    });

    if (!geometry) {
      failures++;
      console.log(`[FAIL] ${label}: overlay or canvas not found in DOM after click`);
      lines.push(`- **[FAIL] ${label}** — overlay or canvas missing after click`);
      continue;
    }

    const [ymin, xmin, ymax, xmax] = field.bbox!;
    const expected = {
      top: geometry.canvas.top + (ymin / 1000) * geometry.canvas.height,
      left: geometry.canvas.left + (xmin / 1000) * geometry.canvas.width,
      width: ((xmax - xmin) / 1000) * geometry.canvas.width,
      height: ((ymax - ymin) / 1000) * geometry.canvas.height,
    };

    const deltas = {
      top: Math.abs(expected.top - geometry.overlay.top),
      left: Math.abs(expected.left - geometry.overlay.left),
      width: Math.abs(expected.width - geometry.overlay.width),
      height: Math.abs(expected.height - geometry.overlay.height),
    };
    const pass = Object.values(deltas).every((d) => d <= TOLERANCE_PX);

    if (pass) {
      console.log(`[PASS] ${label}: overlay matches expected position (within ${TOLERANCE_PX}px)`);
      lines.push(`- **[PASS] ${label}** — overlay within ${TOLERANCE_PX}px of the bbox-derived position`);
    } else {
      failures++;
      console.log(`[FAIL] ${label}: expected`, expected, "got", geometry.overlay, "deltas", deltas);
      lines.push(
        `- **[FAIL] ${label}** — expected \`${JSON.stringify(expected)}\`, got \`${JSON.stringify(geometry.overlay)}\``,
      );
    }
  }

  await browser.close();

  lines.unshift(`${candidates.length - failures}/${candidates.length} fields matched.\n`);
  const { writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  writeFileSync(join(__dirname, "..", "docs", "provenance-results.md"), lines.join("\n"));

  console.log(`\n${candidates.length - failures}/${candidates.length} fields matched.`);
  console.log("Report written to docs/provenance-results.md");
  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
