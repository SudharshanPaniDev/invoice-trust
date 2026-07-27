import { prisma } from "./db";
import { toView, type StoredInvoice } from "./invoice-view";
import { scoreInvoice, type ScoredInvoice, type ScoredField } from "./validation/confidence";
import { updateInvoiceScored } from "./store";
import { findDuplicates, applyDuplicateResult } from "./duplicate";
import { parseAmount, parseDate } from "./validation/parse";
import type { RawInvoice, RawField, RawLineItem } from "./schema";

const INVOICE_KEYS = [
  "vendorName", "vendorGSTIN", "invoiceNo", "invoiceDate", "dueDate",
  "currency", "subtotal", "taxRate", "taxAmount", "total",
] as const;
const LINE_KEYS = ["description", "quantity", "unitPrice", "lineAmount"] as const;

const toRaw = (f: ScoredField | undefined): RawField | undefined =>
  f ? { value: f.value, modelConfidence: f.modelConfidence, bbox: f.bbox, sourceText: f.sourceText } : undefined;

/** Rebuild the raw extraction (+ which fields were already human-corrected/confirmed) from
 *  a stored row. */
function reconstruct(view: ReturnType<typeof toView>): {
  raw: RawInvoice;
  correctedKeys: Set<string>;
  confirmedKeys: Set<string>;
} {
  const correctedKeys = new Set<string>();
  const confirmedKeys = new Set<string>();
  for (const [key, f] of Object.entries(view.fields)) {
    if (f.corrected) correctedKeys.add(key);
    if (f.confirmed) confirmedKeys.add(key);
  }

  const raw: RawInvoice = {
    isInvoice: view.status !== "failed",
    lineItems: [],
  } as RawInvoice;

  for (const key of INVOICE_KEYS) {
    const rf = toRaw(view.fields[key]);
    if (rf) (raw as Record<string, unknown>)[key] = rf;
  }

  const lineItems: RawLineItem[] = [];
  for (let i = 0; i < view.lineCount; i++) {
    const li: RawLineItem = {};
    for (const lk of LINE_KEYS) {
      const rf = toRaw(view.fields[`lineItems.${i}.${lk}`]);
      if (rf) li[lk] = rf;
    }
    lineItems.push(li);
  }
  raw.lineItems = lineItems;

  return { raw, correctedKeys, confirmedKeys };
}

/** Look up a field's current value in the reconstructed raw invoice, validating the key
 *  the same way `applyEdit` does (unknown keys throw). Shared by the no-op check in
 *  `applyCorrection` and by `applyConfirmation`. */
function fieldValue(raw: RawInvoice, fieldKey: string): string | null {
  if (fieldKey.startsWith("lineItems.")) {
    const [, idxStr, lk] = fieldKey.split(".");
    const i = Number(idxStr);
    if (!Number.isInteger(i) || !(LINE_KEYS as readonly string[]).includes(lk)) {
      throw new Error(`Unknown line-item field: ${fieldKey}`);
    }
    return raw.lineItems[i]?.[lk as keyof RawLineItem]?.value ?? null;
  }
  if (!(INVOICE_KEYS as readonly string[]).includes(fieldKey)) {
    throw new Error(`Unknown field: ${fieldKey}`);
  }
  return (raw as unknown as Record<string, RawField | undefined>)[fieldKey]?.value ?? null;
}

/** Apply a single field edit to the reconstructed raw invoice (in place). */
function applyEdit(raw: RawInvoice, fieldKey: string, newValue: string) {
  const patch = (existing: RawField | undefined): RawField => ({
    ...(existing ?? {}),
    value: newValue,
    modelConfidence: null, // human value has no model signal (D17)
  });

  if (fieldKey.startsWith("lineItems.")) {
    const [, idxStr, lk] = fieldKey.split(".");
    const i = Number(idxStr);
    if (!Number.isInteger(i) || !(LINE_KEYS as readonly string[]).includes(lk)) {
      throw new Error(`Unknown line-item field: ${fieldKey}`);
    }
    while (raw.lineItems.length <= i) raw.lineItems.push({});
    (raw.lineItems[i] as Record<string, RawField>)[lk] = patch(raw.lineItems[i][lk as keyof RawLineItem]);
  } else {
    if (!(INVOICE_KEYS as readonly string[]).includes(fieldKey)) {
      throw new Error(`Unknown field: ${fieldKey}`);
    }
    (raw as Record<string, unknown>)[fieldKey] = patch(
      (raw as unknown as Record<string, RawField | undefined>)[fieldKey],
    );
  }
}

/** Fetch (or reuse an already-fetched) row and reconstruct it into raw fields +
 *  corrected/confirmed key sets — the common prologue for every function below. Accepting
 *  a prefetched row lets a caller that already has one (e.g. the detail page) avoid a
 *  second round trip for the same invoice. */
async function loadReconstructed(
  id: string,
  prefetchedRow?: StoredInvoice,
): Promise<{ raw: RawInvoice; correctedKeys: Set<string>; confirmedKeys: Set<string> } | null> {
  const row =
    prefetchedRow ??
    ((await prisma.invoice.findUnique({ where: { id }, include: { lineItems: true } })) as unknown as
      | StoredInvoice
      | null);
  if (!row) return null;

  return reconstruct(toView(row));
}

/** Re-score against the (possibly edited) raw fields and re-check cross-invoice duplicates
 *  (D49/D50) — but don't persist. Duplicate status is derived state: it's a fact about this
 *  invoice's relationship to whatever else currently exists in the table, not a fact about
 *  this invoice alone, so it's always recomputed fresh here rather than trusted from a
 *  stored flag that can drift the moment some OTHER invoice changes or is deleted. */
async function rescore(
  id: string,
  raw: RawInvoice,
  correctedKeys: Set<string>,
  confirmedKeys: Set<string>,
): Promise<ScoredInvoice> {
  const scored = scoreInvoice(raw, correctedKeys, confirmedKeys);

  const dup = await findDuplicates(
    {
      gstin: scored.fields.vendorGSTIN?.value ?? null,
      invoiceNo: scored.fields.invoiceNo?.value ?? null,
      total: parseAmount(scored.fields.total?.value) ?? null,
      invoiceDate: parseDate(scored.fields.invoiceDate?.value)?.date ?? null,
      vendorName: scored.fields.vendorName?.value ?? null,
      currency: scored.fields.currency?.value ?? null,
    },
    id,
  );
  applyDuplicateResult(scored, dup);

  return scored;
}

/** `rescore`, then persist — shared by every function that represents an actual write
 *  event (a correction, a confirmation, or a delete-triggered revalidation). */
async function rescoreAndPersist(
  id: string,
  raw: RawInvoice,
  correctedKeys: Set<string>,
  confirmedKeys: Set<string>,
): Promise<ScoredInvoice> {
  const scored = await rescore(id, raw, correctedKeys, confirmedKeys);
  await updateInvoiceScored(id, raw, scored);
  return scored;
}

/**
 * Correct one field, then re-validate the WHOLE invoice (rules are cross-field, D17) and
 * persist. Returns the fresh scored result, or null if the invoice doesn't exist.
 */
export async function applyCorrection(
  id: string,
  fieldKey: string,
  newValue: string,
): Promise<ScoredInvoice | null> {
  const loaded = await loadReconstructed(id);
  if (!loaded) return null;
  const { raw, correctedKeys, confirmedKeys } = loaded;

  // Resubmitting the same value isn't a correction — nothing was actually fixed, so it
  // must not earn the 95% human-verified tier or the "edited" tag (D48). Still validates
  // the field key via `fieldValue`, which throws on an unknown key exactly like `applyEdit`
  // did, so that check isn't lost for a would-be no-op on a bad key.
  if (fieldValue(raw, fieldKey) !== newValue) {
    applyEdit(raw, fieldKey, newValue);
    correctedKeys.add(fieldKey);
    confirmedKeys.delete(fieldKey); // a real edit supersedes any earlier confirmation
  }

  return rescoreAndPersist(id, raw, correctedKeys, confirmedKeys);
}

/**
 * Confirm a field's current value without changing it — a human explicitly affirms it's
 * correct (D48). Distinct from `applyCorrection`: no value is written, so this earns 85%
 * (weaker evidence than a passed rule or an actual fix), never 90/95. Refuses to confirm a
 * field with no value (nothing to affirm) or an unknown field key.
 */
export async function applyConfirmation(
  id: string,
  fieldKey: string,
): Promise<ScoredInvoice | null> {
  const loaded = await loadReconstructed(id);
  if (!loaded) return null;
  const { raw, correctedKeys, confirmedKeys } = loaded;

  if (fieldValue(raw, fieldKey) == null) {
    throw new Error(`Cannot confirm ${fieldKey}: no value to confirm`);
  }
  confirmedKeys.add(fieldKey);

  return rescoreAndPersist(id, raw, correctedKeys, confirmedKeys);
}

/**
 * Re-run duplicate detection for an existing invoice with no field change and persist it —
 * used right after deleting another invoice (D49), so a stale "possible duplicate of X"
 * flag pointing at the now-gone invoice X gets refreshed in storage too (kept for the
 * list-page badge and CSV/JSON export, D50 — see `getLiveScoredInvoice` for the consumers
 * that no longer need this to be pre-computed at all).
 */
export async function revalidateDuplicate(id: string): Promise<ScoredInvoice | null> {
  const loaded = await loadReconstructed(id);
  if (!loaded) return null;

  return rescoreAndPersist(id, loaded.raw, loaded.correctedKeys, loaded.confirmedKeys);
}

/**
 * The current, correct scored state of an invoice, including a LIVE cross-invoice duplicate
 * check — never a stored flag (D50). This is the single source of truth for anywhere
 * duplicate status actually matters: the detail page (what's shown to a human) and the
 * trust route (what's allowed). Read-only — nothing is persisted, so calling this can never
 * itself go stale the way writing-then-trusting a flag could. Accepts an optional
 * already-fetched row so a caller like the detail page, which needs the row for other
 * metadata anyway, doesn't pay for a second query.
 */
export async function getLiveScoredInvoice(
  id: string,
  prefetchedRow?: StoredInvoice,
): Promise<ScoredInvoice | null> {
  const loaded = await loadReconstructed(id, prefetchedRow);
  if (!loaded) return null;

  return rescore(id, loaded.raw, loaded.correctedKeys, loaded.confirmedKeys);
}
