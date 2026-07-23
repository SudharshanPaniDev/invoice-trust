import { z } from "zod";

/**
 * The contract for what the extractor (Gemini) returns — BEFORE our validation /
 * earned-confidence engine runs (see decisions D2). This is the "raw draft": the
 * model's best guess per field, with its own signal and source location. We never
 * trust these values as-is — the validation engine turns them into earned confidence.
 */

/** Bounding box as Gemini returns it: [ymin, xmin, ymax, xmax], normalized 0–1000 (D8). */
export const BBoxSchema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);
export type BBox = z.infer<typeof BBoxSchema>;

/**
 * One extracted field. `value` is kept as a raw string on purpose: the model reads
 * text, and parsing (numbers, dates, GSTIN) is the validation engine's job (D2). A
 * value that won't parse should become a low-confidence *flag*, not a hard schema
 * rejection — so we accept any string here and sanity-check downstream.
 */
export const RawFieldSchema = z.object({
  value: z.string().nullable(),
  modelConfidence: z.number().min(0).max(1).nullable().optional(),
  bbox: BBoxSchema.nullable().optional(),
  sourceText: z.string().nullable().optional(),
});
export type RawField = z.infer<typeof RawFieldSchema>;

export const RawLineItemSchema = z.object({
  description: RawFieldSchema.optional(),
  quantity: RawFieldSchema.optional(),
  unitPrice: RawFieldSchema.optional(),
  lineAmount: RawFieldSchema.optional(),
});
export type RawLineItem = z.infer<typeof RawLineItemSchema>;

export const RawInvoiceSchema = z.object({
  /** Non-invoice rejection (plan Phase 1): false -> status=failed with a reason. */
  isInvoice: z.boolean(),
  vendorName: RawFieldSchema.optional(),
  vendorGSTIN: RawFieldSchema.optional(),
  invoiceNo: RawFieldSchema.optional(),
  invoiceDate: RawFieldSchema.optional(),
  dueDate: RawFieldSchema.optional(),
  currency: RawFieldSchema.optional(),
  subtotal: RawFieldSchema.optional(),
  taxRate: RawFieldSchema.optional(),
  taxAmount: RawFieldSchema.optional(),
  total: RawFieldSchema.optional(),
  lineItems: z.array(RawLineItemSchema).default([]),
});
export type RawInvoice = z.infer<typeof RawInvoiceSchema>;

/**
 * Parse untrusted model output into the typed contract. Returns a discriminated
 * result instead of throwing, so the caller can mark the invoice `failed` with a
 * reason rather than crashing the pipeline (plan Phase 1: "don't trust the model's JSON").
 */
export function parseExtraction(
  raw: unknown,
): { ok: true; data: RawInvoice } | { ok: false; error: string } {
  const result = RawInvoiceSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: z.prettifyError(result.error) };
}
