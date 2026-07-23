import { prisma } from "./db";
import { toView, type StoredInvoice } from "./invoice-view";
import { scoreInvoice, type ScoredInvoice, type ScoredField } from "./validation/confidence";
import { updateInvoiceScored } from "./store";
import type { RawInvoice, RawField, RawLineItem } from "./schema";

const INVOICE_KEYS = [
  "vendorName", "vendorGSTIN", "invoiceNo", "invoiceDate", "dueDate",
  "currency", "subtotal", "taxRate", "taxAmount", "total",
] as const;
const LINE_KEYS = ["description", "quantity", "unitPrice", "lineAmount"] as const;

const toRaw = (f: ScoredField | undefined): RawField | undefined =>
  f ? { value: f.value, modelConfidence: f.modelConfidence, bbox: f.bbox, sourceText: f.sourceText } : undefined;

/** Rebuild the raw extraction (+ which fields were already human-corrected) from a stored row. */
function reconstruct(view: ReturnType<typeof toView>): {
  raw: RawInvoice;
  correctedKeys: Set<string>;
} {
  const correctedKeys = new Set<string>();
  for (const [key, f] of Object.entries(view.fields)) {
    if (f.corrected) correctedKeys.add(key);
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

  return { raw, correctedKeys };
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
  const { raw, correctedKeys } = reconstruct(view);
  applyEdit(raw, fieldKey, newValue);
  correctedKeys.add(fieldKey);

  const scored = scoreInvoice(raw, correctedKeys);
  await updateInvoiceScored(id, raw, scored);
  return scored;
}
