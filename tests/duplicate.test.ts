import { describe, it, expect, vi, beforeEach } from "vitest";
import { findDuplicates, applyDuplicateResult, classifyAllDuplicates } from "@/lib/duplicate";
import { prisma } from "@/lib/db";
import type { ScoredInvoice, ScoredField } from "@/lib/validation/confidence";

vi.mock("@/lib/db", () => ({
  prisma: { invoice: { findMany: vi.fn() } },
}));

function candidate(overrides: {
  id: string;
  gstin?: string;
  invoiceNo?: string;
  total?: number;
  invoiceDate?: Date;
  vendorName?: string;
  currency?: string;
}) {
  return {
    id: overrides.id,
    vendorName: overrides.vendorName ?? null,
    vendorGSTINField: overrides.gstin ? { value: overrides.gstin } : null,
    invoiceNoField: overrides.invoiceNo ? { value: overrides.invoiceNo } : null,
    total: overrides.total ?? null,
    invoiceDate: overrides.invoiceDate ?? null,
    currencyField: overrides.currency ? { value: overrides.currency } : null,
  };
}

/** Matches `Omit<InvoiceIdentity, "id">`, the `findDuplicates` input shape. */
function identity(overrides: {
  gstin?: string;
  invoiceNo?: string;
  total?: number;
  invoiceDate?: Date;
  vendorName?: string;
  currency?: string;
}) {
  return {
    gstin: overrides.gstin ?? null,
    invoiceNo: overrides.invoiceNo ?? null,
    total: overrides.total ?? null,
    invoiceDate: overrides.invoiceDate ?? null,
    vendorName: overrides.vendorName ?? null,
    currency: overrides.currency ?? null,
  };
}

beforeEach(() => {
  vi.mocked(prisma.invoice.findMany).mockReset();
});

describe("findDuplicates — Tier 1 (hard, GSTIN-anchored)", () => {
  it("no match, no DB call, when total is missing — nothing to compare", async () => {
    const result = await findDuplicates(identity({ invoiceNo: "INV-1" }));
    expect(result).toEqual({ hardMatch: null, softMatch: null });
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it("finds a hard match: same GSTIN, invoice number, and total, same financial year", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({
        id: "existing-1",
        gstin: "27AAPFU0939F1ZV",
        invoiceNo: "INV-100",
        total: 500,
        invoiceDate: new Date("2026-06-01"),
      }),
    ] as never);

    const result = await findDuplicates(
      identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500, invoiceDate: new Date("2026-07-01") }),
    );
    expect(result).toEqual({ hardMatch: { id: "existing-1", reason: "gstin_invoiceno_total" }, softMatch: null });
  });

  it("matches total within MONEY_TOL, not just exact equality", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500.01 }),
    ] as never);

    const result = await findDuplicates(identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500.0 }));
    expect(result.hardMatch?.id).toBe("existing-1");
  });

  it("GSTIN/invoice-number comparisons are case- and whitespace-insensitive", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27aapfu0939f1zv", invoiceNo: " inv-100 ", total: 500 }),
    ] as never);

    const result = await findDuplicates(identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }));
    expect(result.hardMatch?.id).toBe("existing-1");
  });

  it("is downgraded to soft when the exact same match spans two different financial years", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({
        id: "existing-1",
        gstin: "27AAPFU0939F1ZV",
        invoiceNo: "INV-100",
        total: 500,
        invoiceDate: new Date("2025-06-01"), // FY 2025-26
      }),
    ] as never);

    const result = await findDuplicates(
      identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500, invoiceDate: new Date("2026-06-01") }), // FY 2026-27
    );
    expect(result).toEqual({
      hardMatch: null,
      softMatch: { id: "existing-1", reason: "gstin_invoiceno_total_crossyear" },
    });
  });

  it("stays hard when dates are missing on either side — can't disprove same year, stays conservative", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
    ] as never);

    const result = await findDuplicates(identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }));
    expect(result.hardMatch?.id).toBe("existing-1");
  });

  it("a currency mismatch vetoes an otherwise-exact match", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500, currency: "USD" }),
    ] as never);

    const result = await findDuplicates(
      identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500, currency: "EUR" }),
    );
    expect(result).toEqual({ hardMatch: null, softMatch: null });
  });

  it("a currency mismatch vetoes even when one side's currency is a symbol, not a code", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500, currency: "$" }),
    ] as never);

    const result = await findDuplicates(
      identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500, currency: "₹" }),
    );
    expect(result).toEqual({ hardMatch: null, softMatch: null });
  });

  it("does not veto on currency when it's unknown on one side", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
    ] as never);

    const result = await findDuplicates(
      identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500, currency: "INR" }),
    );
    expect(result.hardMatch?.id).toBe("existing-1");
  });

  it("does not fall back to vendor name when both sides have a GSTIN and it differs", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({
        id: "existing-1",
        gstin: "27AAPFU0939F1ZV",
        invoiceNo: "INV-100",
        total: 500,
        vendorName: "Acme Corp",
      }),
    ] as never);

    const result = await findDuplicates(
      identity({ gstin: "29AABCT1332L1ZT", invoiceNo: "INV-100", total: 500, vendorName: "Acme Corp" }),
    );
    expect(result).toEqual({ hardMatch: null, softMatch: null });
  });
});

describe("findDuplicates — Tier 2 (soft, GSTIN + date proximity)", () => {
  it("finds a soft match: same GSTIN/total, different invoice number, date within 7 days", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({
        id: "existing-2",
        gstin: "27AAPFU0939F1ZV",
        invoiceNo: "INV-OLD",
        total: 500,
        invoiceDate: new Date("2026-01-01"),
      }),
    ] as never);

    const result = await findDuplicates(
      identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-NEW", total: 500, invoiceDate: new Date("2026-01-05") }),
    );
    expect(result).toEqual({
      hardMatch: null,
      softMatch: { id: "existing-2", reason: "gstin_total_dateproximity" },
    });
  });

  it("does not flag a soft match when the dates are more than 7 days apart", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({
        id: "existing-3",
        gstin: "27AAPFU0939F1ZV",
        invoiceNo: "INV-OLD",
        total: 500,
        invoiceDate: new Date("2026-01-01"),
      }),
    ] as never);

    // a month later — the recurring-invoice case this tier must not catch
    const result = await findDuplicates(
      identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-NEW", total: 500, invoiceDate: new Date("2026-02-01") }),
    );
    expect(result).toEqual({ hardMatch: null, softMatch: null });
  });

  it("prefers a hard match over a soft match when both are present", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({
        id: "soft-candidate",
        gstin: "27AAPFU0939F1ZV",
        invoiceNo: "INV-OLD",
        total: 500,
        invoiceDate: new Date("2026-01-01"),
      }),
      candidate({ id: "hard-candidate", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
    ] as never);

    const result = await findDuplicates(
      identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500, invoiceDate: new Date("2026-01-05") }),
    );
    expect(result).toEqual({
      hardMatch: { id: "hard-candidate", reason: "gstin_invoiceno_total" },
      softMatch: null,
    });
  });

  it("excludes the given id from candidates (used on correction, so an invoice never matches itself)", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);

    await findDuplicates(identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }), "self-id");

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "self-id" } }),
      }),
    );
  });
});

describe("findDuplicates — no-GSTIN fallback (soft, exact vendor name + invoice number)", () => {
  it("catches an exact duplicate when GSTIN wasn't extracted on either side", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
    ] as never);

    const result = await findDuplicates(
      identity({ vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
    );
    expect(result).toEqual({
      hardMatch: null,
      softMatch: { id: "existing-1", reason: "vendor_invoiceno_total_no_gstin" },
    });
  });

  it("still applies when GSTIN is missing on only one side", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
    ] as never);

    const result = await findDuplicates(
      identity({
        gstin: "27AAPFU0939F1ZV",
        vendorName: "Northgate Electricals",
        invoiceNo: "NGE-0056",
        total: 21918.5,
      }),
    );
    expect(result.softMatch?.reason).toBe("vendor_invoiceno_total_no_gstin");
  });

  it("is case/whitespace-insensitive on vendor name and invoice number", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", vendorName: "northgate   electricals", invoiceNo: "nge-0056", total: 21918.5 }),
    ] as never);

    const result = await findDuplicates(
      identity({ vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
    );
    expect(result.softMatch?.id).toBe("existing-1");
  });

  it("never matches on total alone — vendor name and invoice number are both required", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", total: 21918.5 }), // no vendor name, no invoice number
    ] as never);

    const result = await findDuplicates(identity({ total: 21918.5 }));
    expect(result).toEqual({ hardMatch: null, softMatch: null });
  });

  it("does not match when the vendor name differs", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
    ] as never);

    const result = await findDuplicates(
      identity({ vendorName: "Southgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
    );
    expect(result).toEqual({ hardMatch: null, softMatch: null });
  });

  it("a currency mismatch still vetoes the no-GSTIN fallback", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({
        id: "existing-1",
        vendorName: "Northgate Electricals",
        invoiceNo: "NGE-0056",
        total: 21918.5,
        currency: "USD",
      }),
    ] as never);

    const result = await findDuplicates(
      identity({ vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5, currency: "INR" }),
    );
    expect(result).toEqual({ hardMatch: null, softMatch: null });
  });
});

describe("classifyAllDuplicates — live classification for every current invoice at once (D50)", () => {
  it("classifies a hard match both ways (each is the other's duplicate)", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "a", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
      candidate({ id: "b", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
    ] as never);

    const result = await classifyAllDuplicates();

    expect(result.get("a")).toBe("hard");
    expect(result.get("b")).toBe("hard");
  });

  it("classifies a soft match both ways", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "a", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-1", total: 500, invoiceDate: new Date("2026-01-01") }),
      candidate({ id: "b", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-2", total: 500, invoiceDate: new Date("2026-01-03") }),
    ] as never);

    const result = await classifyAllDuplicates();

    expect(result.get("a")).toBe("soft");
    expect(result.get("b")).toBe("soft");
  });

  it("classifies the no-GSTIN vendor-name fallback the same way for both sides", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "a", vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
      candidate({ id: "b", vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
    ] as never);

    const result = await classifyAllDuplicates();

    expect(result.get("a")).toBe("soft");
    expect(result.get("b")).toBe("soft");
  });

  it("omits invoices with no match at all", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "a", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-1", total: 500 }),
      candidate({ id: "b", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-2", total: 900 }),
    ] as never);

    const result = await classifyAllDuplicates();

    expect(result.has("a")).toBe(false);
    expect(result.has("b")).toBe(false);
  });

  it("is empty when there are no invoices", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);

    const result = await classifyAllDuplicates();

    expect(result.size).toBe(0);
  });
});

function mkScored(fields: Record<string, ScoredField>): ScoredInvoice {
  return {
    isInvoice: true,
    fields,
    overall: { confidence: 0.9, status: "high", canTrust: true, openFlags: 0 },
    rules: [],
  };
}

function mkField(overrides: Partial<ScoredField> = {}): ScoredField {
  return { value: "INV-100", modelConfidence: 0.9, confidence: 0.9, verified: true, flags: [], ...overrides };
}

describe("applyDuplicateResult", () => {
  it("floors confidence, unverifies, and adds a flag on a hard match", () => {
    const scored = mkScored({ invoiceNo: mkField() });
    applyDuplicateResult(scored, {
      hardMatch: { id: "existing-1", reason: "gstin_invoiceno_total" },
      softMatch: null,
    });

    const f = scored.fields.invoiceNo;
    expect(f.confidence).toBeLessThanOrEqual(0.3);
    expect(f.verified).toBe(false);
    expect(f.flags).toHaveLength(1);
    expect(f.flags[0]).toMatch(/existing-1/);
    expect(f.flags[0]).toMatch(/same GSTIN, invoice number, and total/);
  });

  it("uses the cross-year reason's message when that's why it matched", () => {
    const scored = mkScored({ invoiceNo: mkField() });
    applyDuplicateResult(scored, {
      hardMatch: null,
      softMatch: { id: "existing-1", reason: "gstin_invoiceno_total_crossyear" },
    });

    expect(scored.fields.invoiceNo.warnings![0]).toMatch(/different financial year/);
  });

  it("uses the no-GSTIN fallback reason's message when that's why it matched", () => {
    const scored = mkScored({ invoiceNo: mkField() });
    applyDuplicateResult(scored, {
      hardMatch: null,
      softMatch: { id: "existing-1", reason: "vendor_invoiceno_total_no_gstin" },
    });

    expect(scored.fields.invoiceNo.warnings![0]).toMatch(/no GSTIN available/);
  });

  it("adds a warning without touching confidence, verified, or flags on a soft match", () => {
    const scored = mkScored({ invoiceNo: mkField() });
    applyDuplicateResult(scored, {
      hardMatch: null,
      softMatch: { id: "existing-2", reason: "gstin_total_dateproximity" },
    });

    const f = scored.fields.invoiceNo;
    expect(f.confidence).toBe(0.9);
    expect(f.verified).toBe(true);
    expect(f.flags).toHaveLength(0);
    expect(f.warnings).toHaveLength(1);
    expect(f.warnings![0]).toMatch(/existing-2/);
  });

  it("does nothing when neither tier matched", () => {
    const scored = mkScored({ invoiceNo: mkField() });
    applyDuplicateResult(scored, { hardMatch: null, softMatch: null });

    const f = scored.fields.invoiceNo;
    expect(f.confidence).toBe(0.9);
    expect(f.flags).toHaveLength(0);
    expect(f.warnings).toBeUndefined();
  });

  it("is a no-op when invoiceNo was never extracted", () => {
    const scored = mkScored({});
    expect(() =>
      applyDuplicateResult(scored, { hardMatch: { id: "x", reason: "gstin_invoiceno_total" }, softMatch: null }),
    ).not.toThrow();
    expect(scored.fields.invoiceNo).toBeUndefined();
  });
});
