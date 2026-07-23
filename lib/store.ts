import { prisma } from "./db";
import { Prisma } from "./generated/prisma/client";
import type { RawInvoice } from "./schema";

// Absent field -> SQL NULL; present field -> its trust JSON (D9).
const asJson = (v: unknown) =>
  v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue);

/**
 * Persist an extracted invoice (Step 2, thin). Stores every field's trust JSON and
 * mirrors vendorName into its searchable column (D9). The typed `total` / `invoiceDate`
 * projections are left null here — populating them needs real number/date parsing, which
 * is the validation engine's job (D2, Step 3). status starts at needs_review.
 */
export async function storeInvoice(raw: RawInvoice, fileUrl: string) {
  return prisma.invoice.create({
    data: {
      fileUrl,
      status: raw.isInvoice ? "needs_review" : "failed",
      vendorName: raw.vendorName?.value ?? null,
      vendorNameField: asJson(raw.vendorName),
      vendorGSTINField: asJson(raw.vendorGSTIN),
      invoiceNoField: asJson(raw.invoiceNo),
      invoiceDateField: asJson(raw.invoiceDate),
      dueDateField: asJson(raw.dueDate),
      currencyField: asJson(raw.currency),
      subtotalField: asJson(raw.subtotal),
      taxRateField: asJson(raw.taxRate),
      taxAmountField: asJson(raw.taxAmount),
      totalField: asJson(raw.total),
      lineItems: {
        create: raw.lineItems.map((li, i) => ({
          position: i,
          descriptionField: asJson(li.description),
          quantityField: asJson(li.quantity),
          unitPriceField: asJson(li.unitPrice),
          lineAmountField: asJson(li.lineAmount),
        })),
      },
    },
    include: { lineItems: true },
  });
}
