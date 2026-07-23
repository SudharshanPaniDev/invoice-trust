import { prisma } from "./db";
import { Prisma } from "./generated/prisma/client";
import type { RawInvoice } from "./schema";
import type { ScoredInvoice } from "./validation/confidence";
import { parseAmount, parseDate } from "./validation/parse";

// Absent field -> SQL NULL; present scored field -> its trust JSON (D9/D13).
const asJson = (v: unknown) =>
  v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue);

/** Scalar searchable columns (D9) + per-field trust JSON (D13), shared by create/update. */
function invoiceColumns(scored: ScoredInvoice) {
  const fld = (key: string) => scored.fields[key];
  return {
    status: scored.isInvoice ? "needs_review" : "failed",
    // Searchable projection (D9)
    vendorName: fld("vendorName")?.value ?? null,
    total: parseAmount(fld("total")?.value) ?? null,
    invoiceDate: parseDate(fld("invoiceDate")?.value)?.date ?? null,
    // Per-field trust JSON
    vendorNameField: asJson(fld("vendorName")),
    vendorGSTINField: asJson(fld("vendorGSTIN")),
    invoiceNoField: asJson(fld("invoiceNo")),
    invoiceDateField: asJson(fld("invoiceDate")),
    dueDateField: asJson(fld("dueDate")),
    currencyField: asJson(fld("currency")),
    subtotalField: asJson(fld("subtotal")),
    taxRateField: asJson(fld("taxRate")),
    taxAmountField: asJson(fld("taxAmount")),
    totalField: asJson(fld("total")),
  };
}

function lineItemCreates(raw: RawInvoice, scored: ScoredInvoice) {
  const fld = (key: string) => scored.fields[key];
  return raw.lineItems.map((_, i) => ({
    position: i,
    descriptionField: asJson(fld(`lineItems.${i}.description`)),
    quantityField: asJson(fld(`lineItems.${i}.quantity`)),
    unitPriceField: asJson(fld(`lineItems.${i}.unitPrice`)),
    lineAmountField: asJson(fld(`lineItems.${i}.lineAmount`)),
  }));
}

/** Persist a freshly-extracted, scored invoice (Phase 1). status starts needs_review/failed. */
export async function storeInvoice(
  raw: RawInvoice,
  scored: ScoredInvoice,
  fileUrl: string,
) {
  return prisma.invoice.create({
    data: {
      fileUrl,
      ...invoiceColumns(scored),
      lineItems: { create: lineItemCreates(raw, scored) },
    },
    include: { lineItems: true },
  });
}

/** Re-persist an invoice after inline correction re-validation (D17). Replaces line items. */
export async function updateInvoiceScored(
  id: string,
  raw: RawInvoice,
  scored: ScoredInvoice,
) {
  return prisma.invoice.update({
    where: { id },
    data: {
      ...invoiceColumns(scored),
      lineItems: { deleteMany: {}, create: lineItemCreates(raw, scored) },
    },
    include: { lineItems: true },
  });
}

/**
 * Persist a SAMPLE invoice with its PDF bytes, for the provenance demo (D21/D22). This is
 * the only path that ever sets `fileData` — never called from the real upload API route.
 * `fileData` is stored as base64 (see schema comment for why, not a native Bytes column).
 */
export async function storeSampleInvoice(
  raw: RawInvoice,
  scored: ScoredInvoice,
  fileUrl: string,
  fileData: Buffer,
) {
  return prisma.invoice.create({
    data: {
      fileUrl,
      fileData: fileData.toString("base64"),
      ...invoiceColumns(scored),
      lineItems: { create: lineItemCreates(raw, scored) },
    },
    include: { lineItems: true },
  });
}
