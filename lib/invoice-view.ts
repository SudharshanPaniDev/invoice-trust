import type { ScoredField } from "./validation/confidence";

/**
 * Reshape a stored Prisma invoice row (with its per-field trust JSON columns) back into a
 * flat scored-field map for display, and recompute the trust gate from the stored flags.
 */

const INVOICE_FIELD_COLS: [string, string][] = [
  ["vendorName", "vendorNameField"],
  ["vendorGSTIN", "vendorGSTINField"],
  ["invoiceNo", "invoiceNoField"],
  ["invoiceDate", "invoiceDateField"],
  ["dueDate", "dueDateField"],
  ["currency", "currencyField"],
  ["subtotal", "subtotalField"],
  ["taxRate", "taxRateField"],
  ["taxAmount", "taxAmountField"],
  ["total", "totalField"],
];
const LINE_COLS: [string, string][] = [
  ["description", "descriptionField"],
  ["quantity", "quantityField"],
  ["unitPrice", "unitPriceField"],
  ["lineAmount", "lineAmountField"],
];

function asField(j: unknown): ScoredField | undefined {
  return j && typeof j === "object" && "confidence" in (j as object)
    ? (j as ScoredField)
    : undefined;
}

export interface StoredLineItem {
  position: number;
  [col: string]: unknown;
}
export interface StoredInvoice {
  id: string;
  status: string;
  fileUrl: string;
  createdAt: Date;
  lineItems: StoredLineItem[];
  [col: string]: unknown;
}

export interface InvoiceView {
  id: string;
  status: string;
  createdAt: Date;
  fields: Record<string, ScoredField>;
  lineCount: number;
  openFlags: number;
  canTrust: boolean;
  /** True only for seeded sample invoices with a stored source document (D21/D22). */
  hasDocument: boolean;
}

/** `openFlags`/`canTrust` from a fields map + status — shared so a caller that mutates
 *  `fields` after `toView` (e.g. export overlaying a live duplicate result, D52) recomputes
 *  the gate the same way `toView` itself does, rather than re-deriving it separately. */
export function computeTrust(
  fields: Record<string, ScoredField>,
  status: string,
): { openFlags: number; canTrust: boolean } {
  const openFlags = Object.values(fields).reduce((n, f) => n + (f.flags?.length ?? 0), 0);
  return { openFlags, canTrust: openFlags === 0 && status !== "failed" };
}

export function toView(row: StoredInvoice): InvoiceView {
  const fields: Record<string, ScoredField> = {};

  for (const [key, col] of INVOICE_FIELD_COLS) {
    const f = asField(row[col]);
    if (f) fields[key] = f;
  }

  const lines = [...row.lineItems].sort((a, b) => a.position - b.position);
  lines.forEach((li, i) => {
    for (const [key, col] of LINE_COLS) {
      const f = asField(li[col]);
      if (f) fields[`lineItems.${i}.${key}`] = f;
    }
  });

  const { openFlags, canTrust } = computeTrust(fields, row.status);

  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    fields,
    lineCount: lines.length,
    openFlags,
    canTrust,
    hasDocument: row.fileData != null,
  };
}
