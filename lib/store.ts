import { prisma } from "./db";
import { Prisma } from "./generated/prisma/client";
import type { RawInvoice } from "./schema";
import type { ScoredInvoice } from "./validation/confidence";
import { parseAmount, parseDate } from "./validation/parse";

// Absent field -> SQL NULL; present scored field -> its trust JSON (D9/D13).
const asJson = (v: unknown) =>
  v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue);

/**
 * Persist a scored invoice. Each column holds the ScoredField trust JSON (value +
 * modelConfidence + earned confidence + bbox + flags, per D9/D13); the searchable
 * projection columns (vendorName, total, invoiceDate) are parsed from the values (D9).
 * status is failed for non-invoices, else needs_review — trust is a human gate (Phase 4).
 */
export async function storeInvoice(
  raw: RawInvoice,
  scored: ScoredInvoice,
  fileUrl: string,
) {
  const fld = (key: string) => scored.fields[key];

  return prisma.invoice.create({
    data: {
      fileUrl,
      status: scored.isInvoice ? "needs_review" : "failed",

      // Searchable projection (D9)
      vendorName: fld("vendorName")?.value ?? null,
      total: parseAmount(fld("total")?.value) ?? null,
      invoiceDate: parseDate(fld("invoiceDate")?.value)?.date ?? null,

      // Per-field trust JSON (D13 scored fields)
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

      lineItems: {
        create: raw.lineItems.map((_, i) => ({
          position: i,
          descriptionField: asJson(fld(`lineItems.${i}.description`)),
          quantityField: asJson(fld(`lineItems.${i}.quantity`)),
          unitPriceField: asJson(fld(`lineItems.${i}.unitPrice`)),
          lineAmountField: asJson(fld(`lineItems.${i}.lineAmount`)),
        })),
      },
    },
    include: { lineItems: true },
  });
}
