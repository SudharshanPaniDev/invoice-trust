import { prisma } from "./db";
import { MONEY_TOL } from "./validation/rules";
import { normalizeCurrency } from "./validation/parse";
import type { ScoredInvoice } from "./validation/confidence";

/**
 * Cross-invoice duplicate detection (D44, rebuilt D51) — extends "confidence earned by
 * validation" across invoices, not just within one.
 *
 * Four match reasons, two tiers:
 *
 * Tier 1 (hard, blocking): same GSTIN + same invoice number + same total, in the same
 * financial year. Near-certain — GST rules require unique invoice numbers per GSTIN *per
 * financial year*, so this is either the same document twice, an OCR/data-entry error, or a
 * real compliance issue. The financial-year check is what actually makes this rule match its
 * own justification: without it, a vendor legitimately reusing a number a year later (which
 * GST law explicitly permits) would be wrongly, permanently blocked.
 *
 * Tier 1, cross-year (soft): the exact same match, but the invoice dates fall in different
 * financial years — GST law's own uniqueness guarantee doesn't cover this case, so it can't
 * block trust, but an exact GSTIN+invoiceNo+total coincidence a year apart is still unusual
 * enough to flag for a human to glance at.
 *
 * Tier 2 (soft, non-blocking): same GSTIN + same total + invoice date within 7 days, but a
 * *different* invoice number — the pattern a deliberately-altered-reference resubmission
 * would produce. Also, unavoidably, what an ordinary recurring vendor charge looks like —
 * which is exactly why this tier must never floor confidence or block trust; it's a pattern
 * for a human to judge, not a verified defect.
 *
 * Tier 3 / no-GSTIN fallback (soft, non-blocking): GSTIN is missing on at least one side
 * (extraction can legitimately miss it), so match on an exact — not fuzzy — vendor name +
 * invoice number + total instead. Weaker legal grounding than GSTIN (two different legal
 * entities could in principle share a display name), so this never blocks trust either, but
 * without it, the exact same document uploaded twice with no GSTIN extracted goes completely
 * undetected — a real gap the original GSTIN-only design left open.
 *
 * A currency mismatch (when both sides have one) rules out every tier, at any point:
 * numerically-equal totals in different currencies are never the same transaction.
 */

const DATE_PROXIMITY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
// Shared with the classifier below, so the detection substring can never drift from the
// actual message text.
const HARD_MATCH_PREFIX = "Possible duplicate of invoice";
const SOFT_MATCH_PREFIX = "Possible resubmission of invoice";

export type MatchReason =
  | "gstin_invoiceno_total"
  | "gstin_invoiceno_total_crossyear"
  | "gstin_total_dateproximity"
  | "vendor_invoiceno_total_no_gstin";

const REASON_TEXT: Record<MatchReason, string> = {
  gstin_invoiceno_total: "same GSTIN, invoice number, and total",
  gstin_invoiceno_total_crossyear:
    "same GSTIN, invoice number, and total, but a different financial year — verify this " +
    "isn't a legitimate reused invoice number",
  gstin_total_dateproximity: `same GSTIN and total, invoice date within ${DATE_PROXIMITY_DAYS} days, a different invoice number`,
  vendor_invoiceno_total_no_gstin:
    "same vendor name, invoice number, and total — no GSTIN available to confirm",
};

export interface DuplicateMatch {
  id: string;
  reason: MatchReason;
}
export interface DuplicateCheck {
  hardMatch: DuplicateMatch | null;
  softMatch: DuplicateMatch | null;
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

interface Match {
  tier: "hard" | "soft";
  reason: MatchReason;
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

/** The actual matching rule, applied to a single ordered pair — the one place every tier's
 *  logic lives, whether the candidates came from a targeted query or a full table scan. */
function matchTier(a: InvoiceIdentity, b: InvoiceIdentity): Match | null {
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
        return { tier: "soft", reason: "gstin_invoiceno_total_crossyear" };
      }
      return { tier: "hard", reason: "gstin_invoiceno_total" };
    }

    if (a.invoiceDate && b.invoiceDate) {
      const daysApart = Math.abs(b.invoiceDate.getTime() - a.invoiceDate.getTime()) / DAY_MS;
      if (daysApart <= DATE_PROXIMITY_DAYS) return { tier: "soft", reason: "gstin_total_dateproximity" };
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
    return { tier: "soft", reason: "vendor_invoiceno_total_no_gstin" };
  }
  return null;
}

export async function findDuplicates(
  identity: Omit<InvoiceIdentity, "id">,
  excludeId?: string,
): Promise<DuplicateCheck> {
  if (identity.total == null) return { hardMatch: null, softMatch: null };

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

  let hardMatch: DuplicateMatch | null = null;
  let softMatch: DuplicateMatch | null = null;

  for (const c of candidates) {
    const m = matchTier(self, toIdentity(c));
    if (!m) continue;
    if (m.tier === "hard") {
      hardMatch = { id: c.id, reason: m.reason };
      break; // Tier 1 found — it's the strongest signal, stop looking.
    }
    if (!softMatch) softMatch = { id: c.id, reason: m.reason };
  }

  return { hardMatch, softMatch: hardMatch ? null : softMatch };
}

/** Live classification for EVERY currently-existing invoice at once (D50) — one query, then
 *  an in-memory pairwise comparison (cheap at this dataset's scale), instead of a persisted
 *  flag or a query-per-row. Used by the invoices list page for its duplicate badge. */
export async function classifyAllDuplicates(): Promise<Map<string, "hard" | "soft">> {
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

  const result = new Map<string, "hard" | "soft">();
  for (const a of identities) {
    let tier: "hard" | "soft" | null = null;
    for (const b of identities) {
      if (b.id === a.id) continue;
      const m = matchTier(a, b);
      if (!m) continue;
      if (m.tier === "hard") {
        tier = "hard";
        break;
      }
      if (!tier) tier = "soft";
    }
    if (tier) result.set(a.id, tier);
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

/** Patches `invoiceNo` in place with the duplicate result — a hard match floors confidence
 *  and blocks trust via the existing `flags` mechanism; any soft match only ever adds a
 *  `warnings` entry, never touching confidence or `flags` (D44). No-op if invoiceNo wasn't
 *  extracted at all, since there's nothing to attach the result to. */
export function applyDuplicateResult(scored: ScoredInvoice, check: DuplicateCheck): void {
  const f = scored.fields.invoiceNo;
  if (!f) return;

  if (check.hardMatch) {
    f.confidence = Math.min(f.confidence, 0.3);
    f.verified = false;
    f.flags = [
      ...f.flags,
      `${HARD_MATCH_PREFIX} ${check.hardMatch.id} (${REASON_TEXT[check.hardMatch.reason]})`,
    ];
  } else if (check.softMatch) {
    f.warnings = [
      ...(f.warnings ?? []),
      `${SOFT_MATCH_PREFIX} ${check.softMatch.id} (${REASON_TEXT[check.softMatch.reason]})`,
    ];
  }
}

/** Classifies a stored `invoiceNoField` JSON blob for the invoices-list badge — reads
 *  straight off the same flags/warnings `applyDuplicateResult` writes, no separate signal to
 *  keep in sync. Returns null when neither tier's message is present (including when the
 *  field has an unrelated flag, e.g. "Invoice number is missing"). */
export function classifyDuplicateField(field: unknown): "hard" | "soft" | null {
  if (!field || typeof field !== "object") return null;
  const flags = "flags" in field && Array.isArray((field as { flags: unknown }).flags)
    ? ((field as { flags: unknown[] }).flags as unknown[])
    : [];
  const warnings = "warnings" in field && Array.isArray((field as { warnings: unknown }).warnings)
    ? ((field as { warnings: unknown[] }).warnings as unknown[])
    : [];
  if (flags.some((f) => typeof f === "string" && f.startsWith(HARD_MATCH_PREFIX))) return "hard";
  if (warnings.some((w) => typeof w === "string" && w.startsWith(SOFT_MATCH_PREFIX))) return "soft";
  return null;
}
