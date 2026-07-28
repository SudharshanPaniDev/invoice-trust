import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  findDuplicates,
  applyDuplicateInfo,
  classifyAllDuplicates,
  overlayLiveDuplicateStatus,
  dismissDuplicate,
} from "@/lib/duplicate";
import { prisma } from "@/lib/db";
import type { ScoredInvoice, ScoredField } from "@/lib/validation/confidence";

vi.mock("@/lib/db", () => ({
  prisma: {
    invoice: { findMany: vi.fn() },
    dismissedDuplicate: { findMany: vi.fn(), upsert: vi.fn() },
  },
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
  vi.mocked(prisma.dismissedDuplicate.findMany).mockReset().mockResolvedValue([]);
  vi.mocked(prisma.dismissedDuplicate.upsert).mockReset();
});

describe("findDuplicates — GSTIN-anchored match (D53: one tier, not hard/soft)", () => {
  it("no match, no DB call, when total is missing — nothing to compare", async () => {
    const result = await findDuplicates(identity({ invoiceNo: "INV-1" }));
    expect(result).toBeNull();
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it("finds a match: same GSTIN, invoice number, and total, same financial year", async () => {
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
    expect(result).toEqual({ matchId: "existing-1", reason: "gstin_invoiceno_total" });
  });

  it("matches total within MONEY_TOL, not just exact equality", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500.01 }),
    ] as never);

    const result = await findDuplicates(identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500.0 }));
    expect(result?.matchId).toBe("existing-1");
  });

  it("GSTIN/invoice-number comparisons are case- and whitespace-insensitive", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27aapfu0939f1zv", invoiceNo: " inv-100 ", total: 500 }),
    ] as never);

    const result = await findDuplicates(identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }));
    expect(result?.matchId).toBe("existing-1");
  });

  it("still a candidate (different reason) when the exact same match spans two different financial years", async () => {
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
    expect(result).toEqual({ matchId: "existing-1", reason: "gstin_invoiceno_total_crossyear" });
  });

  it("still matches when dates are missing on either side", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
    ] as never);

    const result = await findDuplicates(identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }));
    expect(result?.matchId).toBe("existing-1");
  });

  it("a currency mismatch vetoes an otherwise-exact match", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500, currency: "USD" }),
    ] as never);

    const result = await findDuplicates(
      identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500, currency: "EUR" }),
    );
    expect(result).toBeNull();
  });

  it("a currency mismatch vetoes even when one side's currency is a symbol, not a code", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500, currency: "$" }),
    ] as never);

    const result = await findDuplicates(
      identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500, currency: "₹" }),
    );
    expect(result).toBeNull();
  });

  it("does not veto on currency when it's unknown on one side", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
    ] as never);

    const result = await findDuplicates(
      identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500, currency: "INR" }),
    );
    expect(result?.matchId).toBe("existing-1");
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
    expect(result).toBeNull();
  });
});

describe("findDuplicates — GSTIN + date proximity, different invoice number", () => {
  it("finds a match: same GSTIN/total, different invoice number, date within 7 days", async () => {
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
    expect(result).toEqual({ matchId: "existing-2", reason: "gstin_total_dateproximity" });
  });

  it("does not match when the dates are more than 7 days apart", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({
        id: "existing-3",
        gstin: "27AAPFU0939F1ZV",
        invoiceNo: "INV-OLD",
        total: 500,
        invoiceDate: new Date("2026-01-01"),
      }),
    ] as never);

    // a month later — the recurring-invoice case this must not catch
    const result = await findDuplicates(
      identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-NEW", total: 500, invoiceDate: new Date("2026-02-01") }),
    );
    expect(result).toBeNull();
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

  it("skips a candidate whose pair has been explicitly dismissed", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
    ] as never);
    vi.mocked(prisma.dismissedDuplicate.findMany).mockResolvedValue([
      { invoiceIdLow: "existing-1", invoiceIdHigh: "self-id" },
    ] as never);

    const result = await findDuplicates(
      identity({ gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
      "self-id",
    );
    expect(result).toBeNull();
  });
});

describe("findDuplicates — no-GSTIN fallback (exact vendor name + invoice number)", () => {
  it("catches an exact duplicate when GSTIN wasn't extracted on either side", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
    ] as never);

    const result = await findDuplicates(
      identity({ vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
    );
    expect(result).toEqual({ matchId: "existing-1", reason: "vendor_invoiceno_total_no_gstin" });
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
    expect(result?.reason).toBe("vendor_invoiceno_total_no_gstin");
  });

  it("is case/whitespace-insensitive on vendor name and invoice number", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", vendorName: "northgate   electricals", invoiceNo: "nge-0056", total: 21918.5 }),
    ] as never);

    const result = await findDuplicates(
      identity({ vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
    );
    expect(result?.matchId).toBe("existing-1");
  });

  it("never matches on total alone — vendor name and invoice number are both required", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", total: 21918.5 }), // no vendor name, no invoice number
    ] as never);

    const result = await findDuplicates(identity({ total: 21918.5 }));
    expect(result).toBeNull();
  });

  it("does not match when the vendor name differs", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
    ] as never);

    const result = await findDuplicates(
      identity({ vendorName: "Southgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
    );
    expect(result).toBeNull();
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
    expect(result).toBeNull();
  });
});

describe("classifyAllDuplicates — live classification for every current invoice at once (D50, one tier D53)", () => {
  it("classifies a match both ways (each is the other's duplicate)", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "a", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
      candidate({ id: "b", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
    ] as never);

    const result = await classifyAllDuplicates();

    expect(result.get("a")).toEqual({ matchId: "b", reason: "gstin_invoiceno_total" });
    expect(result.get("b")).toEqual({ matchId: "a", reason: "gstin_invoiceno_total" });
  });

  it("classifies the no-GSTIN vendor-name fallback the same way for both sides", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "a", vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
      candidate({ id: "b", vendorName: "Northgate Electricals", invoiceNo: "NGE-0056", total: 21918.5 }),
    ] as never);

    const result = await classifyAllDuplicates();

    expect(result.get("a")?.reason).toBe("vendor_invoiceno_total_no_gstin");
    expect(result.get("b")?.reason).toBe("vendor_invoiceno_total_no_gstin");
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

  it("omits a pair that's been dismissed", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "a", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
      candidate({ id: "b", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
    ] as never);
    vi.mocked(prisma.dismissedDuplicate.findMany).mockResolvedValue([
      { invoiceIdLow: "a", invoiceIdHigh: "b" },
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

describe("dismissDuplicate — the one genuinely persisted fact (D53)", () => {
  it("normalizes the pair regardless of argument order", async () => {
    await dismissDuplicate("b", "a");

    expect(prisma.dismissedDuplicate.upsert).toHaveBeenCalledWith({
      where: { invoiceIdLow_invoiceIdHigh: { invoiceIdLow: "a", invoiceIdHigh: "b" } },
      create: { invoiceIdLow: "a", invoiceIdHigh: "b" },
      update: {},
    });
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

describe("applyDuplicateInfo — the shared field-mutation logic, one treatment (D53)", () => {
  it("is a no-op when info is undefined", () => {
    const f = mkField();
    applyDuplicateInfo(f, undefined);
    expect(f.flags).toHaveLength(0);
    expect(f.duplicate).toBeUndefined();
  });

  it("floors confidence, unverifies, adds a flag, and sets the structured duplicate field", () => {
    const f = mkField();
    applyDuplicateInfo(f, { matchId: "existing-1", reason: "gstin_invoiceno_total" });

    expect(f.confidence).toBeLessThanOrEqual(0.3);
    expect(f.verified).toBe(false);
    expect(f.flags[0]).toMatch(/existing-1/);
    expect(f.flags[0]).toMatch(/same GSTIN, invoice number, and total/);
    expect(f.duplicate).toEqual({ matchId: "existing-1", reason: "gstin_invoiceno_total" });
  });

  it("applies the exact same treatment regardless of which reason fired — no tier distinction", () => {
    const viaFallback = mkField();
    applyDuplicateInfo(viaFallback, { matchId: "x", reason: "vendor_invoiceno_total_no_gstin" });

    const viaGstin = mkField();
    applyDuplicateInfo(viaGstin, { matchId: "y", reason: "gstin_total_dateproximity" });

    expect(viaFallback.confidence).toBe(viaGstin.confidence);
    expect(viaFallback.verified).toBe(viaGstin.verified);
  });
});

describe("overlayLiveDuplicateStatus — the single live overlay every consumer uses (D52/D53)", () => {
  it("computes the live match and applies it to invoiceNo, without persisting anything itself", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
    ] as never);

    const scored = mkScored({
      vendorGSTIN: mkField({ value: "27AAPFU0939F1ZV" }),
      invoiceNo: mkField({ value: "INV-100" }),
      total: mkField({ value: "500" }),
    });

    await overlayLiveDuplicateStatus(scored, "self-id");

    expect(scored.fields.invoiceNo.confidence).toBeLessThanOrEqual(0.3);
    expect(scored.fields.invoiceNo.flags[0]).toMatch(/existing-1/);
    expect(scored.fields.invoiceNo.duplicate?.matchId).toBe("existing-1");
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: "self-id" } }) }),
    );
  });

  it("does nothing when there's no match", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);

    const scored = mkScored({ invoiceNo: mkField() });
    await overlayLiveDuplicateStatus(scored);

    expect(scored.fields.invoiceNo.flags).toHaveLength(0);
    expect(scored.fields.invoiceNo.duplicate).toBeUndefined();
  });
});
