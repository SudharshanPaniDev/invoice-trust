import { prisma } from "./db";
import { MONEY_TOL } from "./validation/rules";
import { normalizeCurrency, parseAmount, parseDate } from "./validation/parse";
import type { ScoredInvoice, ScoredField } from "./validation/confidence";

/**
 * Cross-invoice duplicate detection (D44, rebuilt D51, collapsed to one tier D53).
 *
 * There is exactly one business concept here: a Duplicate Candidate — a pairing that needs
 * a human to look and decide "same document" or "genuinely different." How the candidate
 * was found (GSTIN match vs. a vendor-name fallback, same fiscal year or not) is supporting
 * evidence shown to that human, never a distinct type with different app behavior. A hard
 * vs. soft split modeled the matching algorithm's own confidence, not anything the business
 * actually asks about — and the double-payment risk this feature exists to prevent doesn't
 * care how a candidate was found, only whether it's been resolved.
 *
 * Four match reasons (evidence, not tiers):
 *
 * Same GSTIN + invoice number + total, same financial year: near-certain — GST rules
 * require unique invoice numbers per GSTIN per financial year, so this is either the same
 * document twice, an OCR/data-entry error, or a real compliance issue.
 *
 * Same GSTIN + invoice number + total, different financial year: the exact same match, but
 * GST law's own uniqueness guarantee doesn't cover this case (a vendor may legitimately
 * reuse a number a year later) — still a candidate worth a glance, just explained honestly.
 *
 * Same GSTIN + total, invoice date within 7 days, different invoice number: the pattern a
 * deliberately-altered-reference resubmission would produce — also, unavoidably, what an
 * ordinary recurring vendor charge looks like. A human decides which; the system doesn't.
 *
 * No-GSTIN fallback: GSTIN missing on at least one side (extraction can legitimately miss
 * it), so match on an exact — not fuzzy — vendor name + invoice number + total instead.
 *
 * A currency mismatch (when both sides have one) rules out a match at any point.
 *
 * Resolution: exactly two actions, both human, both remembered. "Same document" deletes the
 * redundant row (there's nothing to fix, only removing the duplicate is the honest answer,
 * D49). "Not a duplicate" records a dismissal for that specific pair — the one genuinely
 * persisted fact in this whole file, since a human's judgment isn't re-derivable the way the
 * match itself is (D50/D52).
 */

const DATE_PROXIMITY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const DUPLICATE_FLAG_PREFIX = "Possible duplicate of invoice";

export type MatchReason =
  | "gstin_invoiceno_total"
  | "gstin_invoiceno_total_crossyear"
  | "gstin_total_dateproximity"
  | "vendor_invoiceno_total_no_gstin";

const REASON_TEXT: Record<MatchReason, string> = {
  gstin_invoiceno_total: "same GSTIN, invoice number, and total",
  gstin_invoiceno_total_crossyear:
    "same GSTIN, invoice number, and total, in a different financial year",
  gstin_total_dateproximity: `same GSTIN and total, invoice date within ${DATE_PROXIMITY_DAYS} days, a different invoice number`,
  vendor_invoiceno_total_no_gstin:
    "same vendor name, invoice number, and total — no GSTIN available to confirm",
};

/** A single resolved duplicate candidate — the one shape used everywhere: single-invoice
 *  lookups, the batch classifier, and what gets attached to a field for display. */
export interface DuplicateInfo {
  matchId: string;
  reason: MatchReason;
}

/** One invoice's identity fields, shaped for pairwise comparison — the single input both
 *  `findDuplicates` (one invoice vs. the DB) and `classifyAllDuplicates` (every invoice vs.
 *  every other, in memory) feed into the one place the matching rule actually lives. */
export interface InvoiceIdentity {
  id: string;
  gstin: string | null;
  invoiceNo: string | null;
  total: number | null;
  invoiceDate: Date | null;
  vendorName: string | null;
  currency: string | null;
}

const approxEqual = (a: number, b: number, tol = MONEY_TOL) => Math.abs(a - b) <= tol + 1e-9;

/** Case/whitespace-insensitive comparison key — extraction can legitimately vary in case or
 *  spacing across two reads of the same document (or two separate uploads of it). */
function normText(s: string | null): string | null {
  if (s == null) return null;
  const t = s.trim().replace(/\s+/g, " ").toLowerCase();
  return t === "" ? null : t;
}

/** India's GST financial year: April 1 – March 31. */
function fiscalYear(d: Date): number {
  const month = d.getUTCMonth(); // 0-indexed; April = 3
  return month >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

/** The actual matching rule, applied to a single ordered pair — the one place the logic
 *  lives, whether the candidates came from a targeted query or a full table scan. Returns
 *  the reason a match fired, or null. No tier: every match is a candidate, full stop. */
function matchTier(a: InvoiceIdentity, b: InvoiceIdentity): MatchReason | null {
  if (a.total == null || b.total == null || !approxEqual(a.total, b.total)) return null;

  const curA = normalizeCurrency(a.currency);
  const curB = normalizeCurrency(b.currency);
  if (curA && curB && curA !== curB) return null; // same number, different currency — never a match

  const gstinA = normText(a.gstin);
  const gstinB = normText(b.gstin);

  if (gstinA && gstinB) {
    if (gstinA !== gstinB) return null; // different vendor per GSTIN — authoritative, no fallback

    const invA = normText(a.invoiceNo);
    const invB = normText(b.invoiceNo);
    if (invA && invA === invB) {
      if (a.invoiceDate && b.invoiceDate && fiscalYear(a.invoiceDate) !== fiscalYear(b.invoiceDate)) {
        return "gstin_invoiceno_total_crossyear";
      }
      return "gstin_invoiceno_total";
    }

    if (a.invoiceDate && b.invoiceDate) {
      const daysApart = Math.abs(b.invoiceDate.getTime() - a.invoiceDate.getTime()) / DAY_MS;
      if (daysApart <= DATE_PROXIMITY_DAYS) return "gstin_total_dateproximity";
    }
    return null;
  }

  // GSTIN missing on at least one side — exact (not fuzzy) vendor name + invoice number
  // fallback, so a real duplicate whose GSTIN extraction failed isn't invisible to the check.
  const vendA = normText(a.vendorName);
  const vendB = normText(b.vendorName);
  const invA = normText(a.invoiceNo);
  const invB = normText(b.invoiceNo);
  if (vendA && vendA === vendB && invA && invA === invB) {
    return "vendor_invoiceno_total_no_gstin";
  }
  return null;
}

/** Normalized, order-independent pair key — a dismissal is a fact about the PAIR, not about
 *  which invoice you started from. */
function pairKey(a: string, b: string): { invoiceIdLow: string; invoiceIdHigh: string } {
  return a < b ? { invoiceIdLow: a, invoiceIdHigh: b } : { invoiceIdLow: b, invoiceIdHigh: a };
}

async function getDismissedPairs(): Promise<Set<string>> {
  const rows = await prisma.dismissedDuplicate.findMany({
    select: { invoiceIdLow: true, invoiceIdHigh: true },
  });
  return new Set(rows.map((r) => `${r.invoiceIdLow}:${r.invoiceIdHigh}`));
}

function isDismissed(dismissed: Set<string>, a: string, b: string): boolean {
  const { invoiceIdLow, invoiceIdHigh } = pairKey(a, b);
  return dismissed.has(`${invoiceIdLow}:${invoiceIdHigh}`);
}

/** Records that a human has looked at this specific pair and decided they are NOT the same
 *  document — the one thing about duplicate detection that's genuinely persisted (D53),
 *  because it's a human judgment, not something re-derivable from the invoices themselves. */
export async function dismissDuplicate(invoiceId: string, matchedInvoiceId: string): Promise<void> {
  const { invoiceIdLow, invoiceIdHigh } = pairKey(invoiceId, matchedInvoiceId);
  await prisma.dismissedDuplicate.upsert({
    where: { invoiceIdLow_invoiceIdHigh: { invoiceIdLow, invoiceIdHigh } },
    create: { invoiceIdLow, invoiceIdHigh },
    update: {},
  });
}

export async function findDuplicates(
  identity: Omit<InvoiceIdentity, "id">,
  excludeId?: string,
): Promise<DuplicateInfo | null> {
  if (identity.total == null) return null;

  const candidates = await prisma.invoice.findMany({
    where: {
      status: { not: "failed" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      vendorName: true,
      vendorGSTINField: true,
      invoiceNoField: true,
      total: true,
      invoiceDate: true,
      currencyField: true,
    },
  });

  const self: InvoiceIdentity = { id: excludeId ?? "", ...identity };
  const dismissed = excludeId ? await getDismissedPairs() : new Set<string>();

  for (const c of candidates) {
    if (excludeId && isDismissed(dismissed, excludeId, c.id)) continue;
    const reason = matchTier(self, toIdentity(c));
    if (reason) return { matchId: c.id, reason };
  }
  return null;
}

/** Live classification for EVERY currently-existing invoice at once (D50) — one query, then
 *  an in-memory pairwise comparison (cheap at this dataset's scale), instead of a persisted
 *  flag or a query-per-row. Used by the list page's badge, the delete gate, and export. */
export async function classifyAllDuplicates(): Promise<Map<string, DuplicateInfo>> {
  const rows = await prisma.invoice.findMany({
    where: { status: { not: "failed" } },
    select: {
      id: true,
      vendorName: true,
      vendorGSTINField: true,
      invoiceNoField: true,
      total: true,
      invoiceDate: true,
      currencyField: true,
    },
  });
  const identities = rows.map(toIdentity);
  const dismissed = await getDismissedPairs();

  const result = new Map<string, DuplicateInfo>();
  for (const a of identities) {
    for (const b of identities) {
      if (b.id === a.id) continue;
      if (isDismissed(dismissed, a.id, b.id)) continue;
      const reason = matchTier(a, b);
      if (reason) {
        result.set(a.id, { matchId: b.id, reason });
        break;
      }
    }
  }
  return result;
}

function toIdentity(row: {
  id: string;
  vendorName: string | null;
  vendorGSTINField: unknown;
  invoiceNoField: unknown;
  total: unknown;
  invoiceDate: Date | null;
  currencyField: unknown;
}): InvoiceIdentity {
  return {
    id: row.id,
    gstin: extractValue(row.vendorGSTINField),
    invoiceNo: extractValue(row.invoiceNoField),
    total: row.total == null ? null : Number(row.total),
    invoiceDate: row.invoiceDate,
    vendorName: row.vendorName,
    currency: extractValue(row.currencyField),
  };
}

function extractValue(field: unknown): string | null {
  if (field && typeof field === "object" && "value" in field) {
    const v = (field as { value: unknown }).value;
    return typeof v === "string" ? v : null;
  }
  return null;
}

/** Applies a resolved duplicate candidate to `invoiceNo`, in place — the one place the
 *  effect happens, shared by the single-invoice path and the batch path (export), so the
 *  message text and the effect on confidence never drift between them. Always the same
 *  treatment (D53): floors confidence and blocks trust via `flags`. No separate non-blocking
 *  tier — every candidate needs a human to resolve it before this invoice can be trusted. */
export function applyDuplicateInfo(f: ScoredField, info: DuplicateInfo | undefined): void {
  if (!info) return;
  f.confidence = Math.min(f.confidence, 0.3);
  f.verified = false;
  f.flags = [...f.flags, `${DUPLICATE_FLAG_PREFIX} ${info.matchId} (${REASON_TEXT[info.reason]})`];
  f.duplicate = { matchId: info.matchId, reason: info.reason };
}

/**
 * Compute the current duplicate status for one invoice and apply it to `invoiceNo`, in
 * memory only — never persisted (D52). This is the single overlay every live consumer uses:
 * the detail page and trust route (via `getLiveScoredInvoice`), and the API responses
 * returned right after an upload/correction/confirmation, so what the caller gets back
 * always reflects the current table, even though nothing about it gets written to storage.
 */
export async function overlayLiveDuplicateStatus(scored: ScoredInvoice, excludeId?: string): Promise<void> {
  const f = scored.fields.invoiceNo;
  if (!f) return;

  const info = await findDuplicates(
    {
      gstin: scored.fields.vendorGSTIN?.value ?? null,
      invoiceNo: scored.fields.invoiceNo?.value ?? null,
      total: parseAmount(scored.fields.total?.value) ?? null,
      invoiceDate: parseDate(scored.fields.invoiceDate?.value)?.date ?? null,
      vendorName: scored.fields.vendorName?.value ?? null,
      currency: scored.fields.currency?.value ?? null,
    },
    excludeId,
  );
  applyDuplicateInfo(f, info ?? undefined);
}
