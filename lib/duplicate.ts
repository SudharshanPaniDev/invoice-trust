import { prisma } from "./db";
import { MONEY_TOL } from "./validation/rules";
import type { ScoredInvoice } from "./validation/confidence";

/**
 * Cross-invoice duplicate detection (D44) — extends "confidence earned by validation"
 * across invoices, not just within one. Two tiers with deliberately unequal weight:
 *
 * Tier 1 (hard, blocking): same GSTIN + same invoice number + same total. Near-certain —
 * GST rules require unique, sequential invoice numbers per GSTIN per financial year, so this
 * is either the same document twice, an OCR/data-entry error, or a real compliance issue.
 *
 * Tier 2 (soft, non-blocking): same GSTIN + same total + invoice date within 7 days, but a
 * *different* invoice number — the pattern a deliberately-altered-reference resubmission
 * would produce. Also, unavoidably, what an ordinary recurring vendor charge (a monthly
 * retainer) looks like — which is exactly why this tier must never floor confidence or block
 * trust the way Tier 1 does; it's a pattern for a human to judge, not a verified defect.
 *
 * Skips entirely when GSTIN is missing/unusable — no fuzzy vendor-name fallback (D44).
 */

const DATE_PROXIMITY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
// Shared with the classifier below, so the detection substring can never drift from the
// actual message text.
const HARD_MATCH_PREFIX = "Possible duplicate of invoice";
const SOFT_MATCH_PREFIX = "Possible resubmission of invoice";

export interface DuplicateCheck {
  hardMatchId: string | null;
  softMatchId: string | null;
}

const approxEqual = (a: number, b: number, tol = MONEY_TOL) => Math.abs(a - b) <= tol + 1e-9;

export async function findDuplicates(
  gstin: string | null,
  invoiceNo: string | null,
  total: number | null,
  invoiceDate: Date | null,
  excludeId?: string,
): Promise<DuplicateCheck> {
  if (!gstin || total == null) return { hardMatchId: null, softMatchId: null };

  // GSTIN lives inside a JSON column, so the real match happens in JS below; this where
  // clause only trims obviously-irrelevant rows (failed extractions, the invoice itself).
  const candidates = await prisma.invoice.findMany({
    where: {
      status: { not: "failed" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, vendorGSTINField: true, invoiceNoField: true, total: true, invoiceDate: true },
  });

  let hardMatchId: string | null = null;
  let softMatchId: string | null = null;

  for (const c of candidates) {
    const cGstin = extractValue(c.vendorGSTINField);
    if (cGstin !== gstin) continue;
    if (c.total == null || !approxEqual(Number(c.total), total)) continue;

    const cInvoiceNo = extractValue(c.invoiceNoField);
    if (invoiceNo != null && cInvoiceNo === invoiceNo) {
      hardMatchId = c.id;
      break; // Tier 1 found — it's the strongest signal, stop looking.
    }

    if (!softMatchId && invoiceDate && c.invoiceDate) {
      const daysApart = Math.abs(c.invoiceDate.getTime() - invoiceDate.getTime()) / DAY_MS;
      if (daysApart <= DATE_PROXIMITY_DAYS) softMatchId = c.id;
    }
  }

  return { hardMatchId, softMatchId: hardMatchId ? null : softMatchId };
}

function extractValue(field: unknown): string | null {
  if (field && typeof field === "object" && "value" in field) {
    const v = (field as { value: unknown }).value;
    return typeof v === "string" ? v : null;
  }
  return null;
}

/** Patches `invoiceNo` in place with the duplicate result — Tier 1 floors confidence and
 *  blocks trust via the existing `flags` mechanism; Tier 2 only ever adds a `warnings`
 *  entry, never touching confidence or `flags` (D44). No-op if invoiceNo wasn't extracted
 *  at all, since there's nothing to attach the result to. */
export function applyDuplicateResult(scored: ScoredInvoice, check: DuplicateCheck): void {
  const f = scored.fields.invoiceNo;
  if (!f) return;

  if (check.hardMatchId) {
    f.confidence = Math.min(f.confidence, 0.3);
    f.verified = false;
    f.flags = [
      ...f.flags,
      `${HARD_MATCH_PREFIX} ${check.hardMatchId} (same GSTIN, invoice number, and total)`,
    ];
  } else if (check.softMatchId) {
    f.warnings = [
      ...(f.warnings ?? []),
      `${SOFT_MATCH_PREFIX} ${check.softMatchId} (same GSTIN and total, invoice date within ${DATE_PROXIMITY_DAYS} days, a different invoice number)`,
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
