import { prisma } from "./db";
import { toView, type StoredInvoice } from "./invoice-view";
import { scoreInvoice, type ScoredInvoice, type ScoredField } from "./validation/confidence";
import { updateInvoiceScored } from "./store";
import { overlayLiveDuplicateStatus } from "./duplicate";
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

/** Pure, single-invoice scoring — no cross-invoice check, no DB call. This is what gets
 *  persisted on every write (D52): duplicate status is never part of it, because it's a
 *  fact about this invoice's relationship to whatever else currently exists in the table,
 *  never a fact about this invoice alone, so it has no business being stored as if it were. */
function rescore(
  raw: RawInvoice,
  correctedKeys: Set<string>,
  confirmedKeys: Set<string>,
): ScoredInvoice {
  return scoreInvoice(raw, correctedKeys, confirmedKeys);
}

/** `rescore`, persisted — shared by every function that represents an actual write event
 *  (a correction or a confirmation). What's written to storage never includes duplicate
 *  status; the live overlay below is applied to the *returned* object only, after the
 *  persist, so the API response reflects the current table without that ever touching what
 *  got saved. */
async function rescoreAndPersist(
  id: string,
  raw: RawInvoice,
  correctedKeys: Set<string>,
  confirmedKeys: Set<string>,
): Promise<ScoredInvoice> {
  const scored = rescore(raw, correctedKeys, confirmedKeys);
  await updateInvoiceScored(id, raw, scored);
  await overlayLiveDuplicateStatus(scored, id);
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
 * The current, correct scored state of an invoice, including a LIVE cross-invoice duplicate
 * check — never persisted, anywhere, under any circumstance (D52). This is the single
 * source of truth for every consumer: the detail page, the trust route, the list page's
 * badge, and export. Read-only — nothing is written here, so calling this can never itself
 * go stale the way writing-then-trusting a flag could. Accepts an optional already-fetched
 * row so a caller like the detail page, which needs the row for other metadata anyway,
 * doesn't pay for a second query.
 */
export async function getLiveScoredInvoice(
  id: string,
  prefetchedRow?: StoredInvoice,
): Promise<ScoredInvoice | null> {
  const loaded = await loadReconstructed(id, prefetchedRow);
  if (!loaded) return null;

  const scored = rescore(loaded.raw, loaded.correctedKeys, loaded.confirmedKeys);
  await overlayLiveDuplicateStatus(scored, id);
  return scored;
}
