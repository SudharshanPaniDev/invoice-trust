/**
 * End-to-end flow check (D57) — Playwright driving the real running app through the
 * scenarios that actually matter: confirm/correct/trust, both duplicate resolutions, export,
 * and search. Follows the exact pattern already established by `check-accessibility.ts` and
 * `check-provenance.ts`: raw `playwright` (no `@playwright/test` runner), requires `pnpm dev`
 * running, writes a report to `docs/`, non-zero exit on failure, explicitly not CI-safe.
 *
 * Unlike those two, this doesn't touch the seeded demo samples or need a real Gemini call —
 * every invoice it exercises is created directly (bypassing extraction, same technique the
 * seed script uses) and deleted again at the end, success or failure, so it can never leave
 * stray rows in the shared Neon database the way ad-hoc manual testing has twice before
 * (see decisions.md D46, D57's sibling cleanup earlier in this session).
 *
 * Run via `pnpm e2e`.
 */
import { chromium, type Page } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/db";
import { parseExtraction } from "../lib/schema";
import { scoreInvoice } from "../lib/validation/confidence";
import { storeInvoice } from "../lib/store";

const BASE_URL = "http://localhost:3000";
const VALID_GSTIN = "27AAPFU0939F1ZV"; // known-valid checksum (also used by the seeded clean sample)
const VENDOR_PREFIX = "Playwright E2E";

const lines: string[] = [`# End-to-end flow check (D57)\n`];
let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`[PASS] ${label}`);
    lines.push(`- **[PASS]** ${label}`);
  } else {
    failed++;
    console.log(`[FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
    lines.push(`- **[FAIL]** ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function field(value: string) {
  return { value, modelConfidence: 0.95, bbox: null, sourceText: value };
}

/** A fully rule-passing invoice by default (valid GSTIN, consistent math, sane dates) — every
 *  scenario overrides only the one thing it needs broken/shared, so any flag/duplicate that
 *  shows up is the one the scenario is actually testing, not incidental noise. */
function makeRaw(opts: {
  vendorName: string;
  invoiceNo: string;
  gstin?: string | null;
  total?: string;
  subtotal?: string;
  taxAmount?: string;
  invoiceDate?: string;
}) {
  const subtotal = opts.subtotal ?? "1000.00";
  const taxAmount = opts.taxAmount ?? "180.00";
  const total = opts.total ?? "1180.00";
  const invoiceDate = opts.invoiceDate ?? "2026-07-01";
  const raw = {
    isInvoice: true,
    vendorName: field(opts.vendorName),
    ...(opts.gstin === null ? {} : { vendorGSTIN: field(opts.gstin ?? VALID_GSTIN) }),
    invoiceNo: field(opts.invoiceNo),
    invoiceDate: field(invoiceDate),
    dueDate: field("2026-07-31"),
    currency: field("INR"),
    subtotal: field(subtotal),
    taxRate: field("18%"),
    taxAmount: field(taxAmount),
    total: field(total),
    lineItems: [
      { description: field("E2E test line"), quantity: field("1"), unitPrice: field(subtotal), lineAmount: field(subtotal) },
    ],
  };
  const parsed = parseExtraction(raw);
  if (!parsed.ok) throw new Error(`Bad synthetic fixture: ${parsed.error}`);
  return parsed.data;
}

async function makeInvoice(fileUrl: string, opts: Parameters<typeof makeRaw>[0]): Promise<string> {
  const raw = makeRaw(opts);
  const scored = scoreInvoice(raw);
  const row = await storeInvoice(raw, scored, fileUrl);
  return row.id;
}

/** Finds the field-table row for an exact label (e.g. "Total") — a plain substring match
 *  would let "Total" match the "Subtotal"/"Tax Amount" rows too. */
function fieldRow(page: Page, label: string) {
  const cell = page.locator("table").first().locator("td", { hasText: new RegExp(`^${label}$`) }).first();
  return cell.locator("xpath=ancestor::tr");
}

async function resultsCount(page: Page): Promise<number> {
  const text = await page.locator("text=/\\d+ results?/").first().textContent();
  return Number(text?.match(/\d+/)?.[0] ?? "-1");
}

async function scenarioConfirmCorrectTrust(page: Page, id: string) {
  await page.goto(`${BASE_URL}/invoices/${id}`, { waitUntil: "networkidle" });

  const markTrusted = page.getByRole("button", { name: /Mark trusted/ });
  check("blocked while the arithmetic flag is open", await markTrusted.isDisabled());

  // Scoped to the row itself, not the page — the page's own static help text ("...or 85%
  // (human-confirmed)...") contains the substring "confirmed" unconditionally, so an
  // unscoped page-wide wait would resolve instantly against that, not against this field
  // actually changing state.
  const vendorRow = fieldRow(page, "Vendor");
  await vendorRow.getByRole("button", { name: "confirm" }).click();
  await vendorRow.getByText("confirmed", { exact: true }).waitFor();
  const vendorRowText = await vendorRow.textContent();
  check("confirm earns 85% and tags the field 'confirmed'", !!vendorRowText?.includes("85%") && !!vendorRowText?.includes("confirmed"));

  const totalRow = fieldRow(page, "Total");
  const before = await totalRow.textContent();
  check("bad total starts flagged", !!before?.includes("⚠"));
  await totalRow.getByRole("button", { name: "edit" }).click();
  await totalRow.locator("input").fill("1180.00");
  await totalRow.getByRole("button", { name: "save" }).click();
  await totalRow.getByText("edited", { exact: true }).waitFor();
  const after = await totalRow.textContent();
  check("correcting the total clears the arithmetic flag", !after?.includes("⚠"));
  check("corrected value is tagged 'edited'", !!after?.includes("edited"));

  check("Mark trusted is now enabled", await markTrusted.isEnabled());
  await markTrusted.click();
  await page.waitForSelector("text=Marked trusted");
  check("marking trusted succeeds", true);
}

async function scenarioDismissDuplicate(page: Page, id: string, matchId: string) {
  await page.goto(`${BASE_URL}/invoices/${id}`, { waitUntil: "networkidle" });
  const invoiceNoRow = fieldRow(page, "Invoice No");
  check(
    "possible-duplicate resolution UI appears on the Invoice No row",
    await invoiceNoRow.getByRole("button", { name: "Not a duplicate" }).isVisible(),
  );

  // Wait on the flag TEXT, not the button — the button's own label flips to "…" while the
  // dismiss request is in flight, which would make a wait for the button itself to detach
  // resolve against that loading-state relabel instead of the actual post-refresh outcome.
  await invoiceNoRow.getByRole("button", { name: "Not a duplicate" }).click();
  await invoiceNoRow.getByText("Possible duplicate").first().waitFor({ state: "detached" });
  const after = await invoiceNoRow.textContent();
  check("dismissing clears the duplicate flag for this pair", !after?.includes("Possible duplicate"));

  await page.goto(`${BASE_URL}/invoices/${matchId}`, { waitUntil: "networkidle" });
  const otherRow = fieldRow(page, "Invoice No");
  const otherText = await otherRow.textContent();
  check("the other half of the dismissed pair is clear too", !otherText?.includes("Possible duplicate"));
}

async function scenarioDeleteDuplicate(page: Page, id: string, matchId: string) {
  await page.goto(`${BASE_URL}/invoices/${id}`, { waitUntil: "networkidle" });
  const invoiceNoRow = fieldRow(page, "Invoice No");
  await invoiceNoRow.getByRole("button", { name: "Yes, same document" }).click();
  await invoiceNoRow.getByRole("button", { name: "Yes, delete" }).click();
  await page.waitForURL(`${BASE_URL}/invoices`);
  check("deleting the duplicate redirects to the list", page.url() === `${BASE_URL}/invoices`);

  const stillThere = await prisma.invoice.findUnique({ where: { id } });
  check("the deleted invoice is actually gone", stillThere === null);

  await page.goto(`${BASE_URL}/invoices/${matchId}`, { waitUntil: "networkidle" });
  const otherRow = fieldRow(page, "Invoice No");
  const otherText = await otherRow.textContent();
  check("the surviving invoice is no longer flagged as a duplicate", !otherText?.includes("Possible duplicate"));
}

async function scenarioSearchFilter(page: Page) {
  await page.goto(`${BASE_URL}/invoices`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("contains…").fill(VENDOR_PREFIX);
  await page.getByRole("button", { name: "Filter" }).click();
  await page.waitForLoadState("networkidle");
  check("vendor filter finds exactly the 5 test invoices", (await resultsCount(page)) === 5);

  await page.goto(`${BASE_URL}/invoices?vendor=${encodeURIComponent(VENDOR_PREFIX)}&status=needs_review`, {
    waitUntil: "networkidle",
  });
  check("status filter finds all 5 (none trusted yet)", (await resultsCount(page)) === 5);
}

async function scenarioExport(page: Page) {
  await page.goto(`${BASE_URL}/invoices?vendor=${encodeURIComponent(VENDOR_PREFIX)}`, { waitUntil: "networkidle" });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download CSV" }).click(),
  ]);
  const path = await download.path();
  const csv = path ? readFileSync(path, "utf8") : "";
  check("export includes the now-trusted flow-test invoice", csv.includes("Playwright E2E Flow Test"));
  check(
    "export excludes still-needs_review invoices (trusted-only default)",
    !csv.includes("Playwright E2E Dup A") && !csv.includes("Playwright E2E Dup B"),
  );
}

async function main() {
  const created: string[] = [];
  const flowId = await makeInvoice("pw-e2e-flow.pdf", {
    vendorName: "Playwright E2E Flow Test",
    invoiceNo: "PW-FLOW-0001",
    total: "1200.00", // wrong on purpose: subtotal 1000 + tax 180 = 1180, not 1200
  });
  created.push(flowId);

  const dupA1 = await makeInvoice("pw-e2e-dupa-1.pdf", {
    vendorName: "Playwright E2E Dup A #1",
    invoiceNo: "PW-DUPA-0001",
    total: "2000.00",
    subtotal: "1694.92",
    taxAmount: "305.08",
  });
  const dupA2 = await makeInvoice("pw-e2e-dupa-2.pdf", {
    vendorName: "Playwright E2E Dup A #2",
    invoiceNo: "PW-DUPA-0001", // same GSTIN + invoice no + total as A#1 -> matches
    total: "2000.00",
    subtotal: "1694.92",
    taxAmount: "305.08",
  });
  created.push(dupA1, dupA2);

  const dupB1 = await makeInvoice("pw-e2e-dupb-1.pdf", {
    vendorName: "Playwright E2E Dup B #1",
    invoiceNo: "PW-DUPB-0001",
    total: "3000.00",
    subtotal: "2542.37",
    taxAmount: "457.63",
  });
  const dupB2 = await makeInvoice("pw-e2e-dupb-2.pdf", {
    vendorName: "Playwright E2E Dup B #2",
    invoiceNo: "PW-DUPB-0001", // same GSTIN + invoice no + total as B#1 -> matches
    total: "3000.00",
    subtotal: "2542.37",
    taxAmount: "457.63",
  });
  created.push(dupB1, dupB2);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();

  try {
    await scenarioSearchFilter(page);
    await scenarioConfirmCorrectTrust(page, flowId);
    await scenarioDismissDuplicate(page, dupA1, dupA2);
    await scenarioDeleteDuplicate(page, dupB1, dupB2); // deletes dupB1 itself
    await scenarioExport(page);
  } catch (e) {
    failed++;
    console.error("Scenario threw:", e);
    lines.push(`- **[FAIL]** scenario threw: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await browser.close();
    // dupB1 was deleted through the app itself (D49); everything else was created here and
    // must be cleaned up here too, so this script can never leave stray rows behind the way
    // manual testing has twice before (D46, and the Greenleaf cleanup earlier this session).
    const remaining = [flowId, dupA1, dupA2, dupB2];
    await prisma.invoice.deleteMany({ where: { id: { in: remaining } } });
    await prisma.$disconnect();
  }

  lines.unshift(`${passed}/${passed + failed} checks passed.\n`);
  writeFileSync(join(__dirname, "..", "docs", "flows-results.md"), lines.join("\n"));
  console.log(`\n${passed}/${passed + failed} checks passed.`);
  console.log("Report written to docs/flows-results.md");
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
