import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseExtraction } from "@/lib/schema";
import { scoreInvoice } from "@/lib/validation/confidence";

/**
 * Scores the REAL captured Gemini output (D11). The synthetic invoice has consistent math
 * (line items sum to subtotal; subtotal + 18% tax = total) but an INVALID GSTIN checksum —
 * so the engine should trust the arithmetic fields yet flag the GSTIN and withhold trust.
 */
describe("scoreInvoice on the real extraction fixture", () => {
  const raw = JSON.parse(readFileSync("tests/fixtures/invoice-01.extracted.json", "utf8"));
  const parsed = parseExtraction(raw);
  if (!parsed.ok) throw new Error("fixture failed to parse: " + parsed.error);
  const s = scoreInvoice(parsed.data);

  it("recognizes it as an invoice", () => {
    expect(s.isInvoice).toBe(true);
  });

  it("earns high confidence on the arithmetic-corroborated totals", () => {
    expect(s.fields.total.verified).toBe(true);
    expect(s.fields.total.confidence).toBeGreaterThanOrEqual(0.8);
    expect(s.fields.subtotal.verified).toBe(true);
    expect(s.fields.taxAmount.verified).toBe(true);
  });

  it("flags the invalid GSTIN checksum", () => {
    expect(s.fields.vendorGSTIN.confidence).toBeLessThanOrEqual(0.3);
    expect(s.fields.vendorGSTIN.flags.join(" ")).toMatch(/checksum/i);
  });

  it("withholds trust while the GSTIN flag is open", () => {
    expect(s.overall.canTrust).toBe(false);
    expect(s.overall.openFlags).toBeGreaterThanOrEqual(1);
  });
});
