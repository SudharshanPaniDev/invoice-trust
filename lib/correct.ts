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

/**
 * Correct one field, then re-validate the WHOLE invoice (rules are cross-field, D17) and
 * persist. Returns the fresh scored result, or null if the invoice doesn't exist.
 */
export async function applyCorrection(
  id: string,
  fieldKey: string,
  newValue: string,
): Promise<ScoredInvoice | null> {
  const row = await prisma.invoice.findUnique({ where: { id }, include: { lineItems: true } });
  if (!row) return null;

  const view = toView(row as unknown as StoredInvoice);
  const { raw, correctedKeys, confirmedKeys } = reconstruct(view);

  // Resubmitting the same value isn't a correction — nothing was actually fixed, so it
  // must not earn the 95% human-verified tier or the "edited" tag (D48). Still validates
  // the field key via `fieldValue`, which throws on an unknown key exactly like `applyEdit`
  // did, so that check isn't lost for a would-be no-op on a bad key.
  if (fieldValue(raw, fieldKey) !== newValue) {
    applyEdit(raw, fieldKey, newValue);
    correctedKeys.add(fieldKey);
    confirmedKeys.delete(fieldKey); // a real edit supersedes any earlier confirmation
  }

  const scored = scoreInvoice(raw, correctedKeys, confirmedKeys);

  // Re-check for cross-invoice duplicates too — editing invoiceNo/GSTIN/total can change
  // whether this invoice now collides with another (D44), same "re-validate the whole
  // invoice on any correction" principle as everything else here (D17).
  const dup = await findDuplicates(
    scored.fields.vendorGSTIN?.value ?? null,
    scored.fields.invoiceNo?.value ?? null,
    parseAmount(scored.fields.total?.value) ?? null,
    parseDate(scored.fields.invoiceDate?.value)?.date ?? null,
    id,
  );
  applyDuplicateResult(scored, dup);

  await updateInvoiceScored(id, raw, scored);
  return scored;
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
  const row = await prisma.invoice.findUnique({ where: { id }, include: { lineItems: true } });
  if (!row) return null;

  const view = toView(row as unknown as StoredInvoice);
  const { raw, correctedKeys, confirmedKeys } = reconstruct(view);

  if (fieldValue(raw, fieldKey) == null) {
    throw new Error(`Cannot confirm ${fieldKey}: no value to confirm`);
  }
  confirmedKeys.add(fieldKey);

  const scored = scoreInvoice(raw, correctedKeys, confirmedKeys);

  const dup = await findDuplicates(
    scored.fields.vendorGSTIN?.value ?? null,
    scored.fields.invoiceNo?.value ?? null,
    parseAmount(scored.fields.total?.value) ?? null,
    parseDate(scored.fields.invoiceDate?.value)?.date ?? null,
    id,
  );
  applyDuplicateResult(scored, dup);

  await updateInvoiceScored(id, raw, scored);
  return scored;
}
