import { describe, it, expect } from "vitest";
import { parseExtraction } from "@/lib/schema";

describe("parseExtraction", () => {
  it("accepts a well-formed invoice extraction", () => {
    const raw = {
      isInvoice: true,
      vendorName: { value: "Acme Corp", modelConfidence: 0.9, bbox: [10, 20, 30, 40] },
      total: { value: "9500.00", modelConfidence: 0.8 },
      lineItems: [{ description: { value: "Widget" }, lineAmount: { value: "9500.00" } }],
    };
    const result = parseExtraction(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.vendorName?.value).toBe("Acme Corp");
      expect(result.data.lineItems).toHaveLength(1);
    }
  });

  it("defaults lineItems to an empty array when omitted", () => {
    const result = parseExtraction({ isInvoice: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.lineItems).toEqual([]);
  });

  it("flags a non-invoice rather than erroring", () => {
    const result = parseExtraction({ isInvoice: false });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.isInvoice).toBe(false);
  });

  it("rejects malformed model output (missing isInvoice) with a readable error", () => {
    const result = parseExtraction({ vendorName: { value: "x" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/isInvoice/);
  });

  it("rejects a bad bbox shape (wrong tuple length)", () => {
    const result = parseExtraction({
      isInvoice: true,
      vendorName: { value: "x", bbox: [1, 2, 3] },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-string field value (must be raw text)", () => {
    const result = parseExtraction({
      isInvoice: true,
      total: { value: 9500 },
    });
    expect(result.ok).toBe(false);
  });
});
