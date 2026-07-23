import { describe, it, expect } from "vitest";
import { scoreInvoice } from "@/lib/validation/confidence";
import type { RawInvoice } from "@/lib/schema";

const f = (value: string | null, mc = 0.9) => ({ value, modelConfidence: mc });

function makeInvoice(overrides: Partial<RawInvoice> = {}): RawInvoice {
  return {
    isInvoice: true,
    vendorName: f("Acme Corp"),
    vendorGSTIN: f("27AAPFU0939F1ZV"),
    invoiceNo: f("INV-1"),
    invoiceDate: f("2026-07-15"),
    dueDate: f("2026-08-14"),
    currency: f("INR"),
    subtotal: f("100.00"),
    taxRate: f("18%"),
    taxAmount: f("18.00"),
    total: f("118.00"),
    lineItems: [
      { description: f("Widget"), quantity: f("2"), unitPrice: f("50.00"), lineAmount: f("100.00") },
    ],
    ...overrides,
  };
}

describe("scoreInvoice — earned confidence (D13)", () => {
  it("a fully-consistent invoice is trustworthy with no open flags", () => {
    const s = scoreInvoice(makeInvoice());
    expect(s.overall.canTrust).toBe(true);
    expect(s.overall.openFlags).toBe(0);
    expect(s.fields.total.verified).toBe(true);
    expect(s.fields.total.confidence).toBeGreaterThanOrEqual(0.8);
    expect(s.fields.vendorGSTIN.verified).toBe(true);
  });

  it("presence alone does NOT earn high confidence (vendor name is unverified)", () => {
    const s = scoreInvoice(makeInvoice());
    expect(s.fields.vendorName.verified).toBe(false);
    expect(s.fields.vendorName.confidence).toBeLessThan(0.8);
  });

  it("a sum mismatch floors the total and blocks trust, with an explanatory flag", () => {
    const s = scoreInvoice(makeInvoice({ total: f("999.00") }));
    expect(s.fields.total.confidence).toBeLessThanOrEqual(0.3);
    expect(s.fields.total.flags.join(" ")).toMatch(/total says 999/);
    expect(s.overall.canTrust).toBe(false);
    expect(s.overall.openFlags).toBeGreaterThan(0);
  });

  it("a bad GSTIN checksum is flagged even when the model was confident", () => {
    const s = scoreInvoice(makeInvoice({ vendorGSTIN: f("29AABCT1332L1ZT", 0.99) }));
    expect(s.fields.vendorGSTIN.confidence).toBeLessThanOrEqual(0.3);
    expect(s.fields.vendorGSTIN.flags.join(" ")).toMatch(/checksum/i);
    expect(s.overall.canTrust).toBe(false);
  });

  it("a missing required field gets confidence 0 and blocks trust", () => {
    const s = scoreInvoice(makeInvoice({ total: undefined }));
    expect(s.fields.total.confidence).toBe(0);
    expect(s.fields.total.flags.length).toBeGreaterThan(0);
    expect(s.overall.canTrust).toBe(false);
  });

  it("a mismatched tax amount is flagged", () => {
    const s = scoreInvoice(makeInvoice({ taxAmount: f("50.00") }));
    expect(s.fields.taxAmount.flags.join(" ")).toMatch(/tax says 50/);
    expect(s.overall.canTrust).toBe(false);
  });

  it("marks a non-invoice as untrustworthy", () => {
    const s = scoreInvoice(makeInvoice({ isInvoice: false }));
    expect(s.overall.canTrust).toBe(false);
  });

  it("a human correction verifies an otherwise-uncheckable field (D17)", () => {
    const s = scoreInvoice(makeInvoice(), new Set(["vendorName"]));
    expect(s.fields.vendorName.corrected).toBe(true);
    expect(s.fields.vendorName.verified).toBe(true);
    expect(s.fields.vendorName.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("a wrong human correction to a checkable field is still flagged (D17)", () => {
    const s = scoreInvoice(makeInvoice({ total: f("999.00") }), new Set(["total"]));
    expect(s.fields.total.confidence).toBeLessThanOrEqual(0.3);
    expect(s.overall.canTrust).toBe(false);
  });
});
