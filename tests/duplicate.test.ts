import { describe, it, expect, vi, beforeEach } from "vitest";
import { findDuplicates, applyDuplicateResult } from "@/lib/duplicate";
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
}) {
  return {
    id: overrides.id,
    vendorGSTINField: overrides.gstin ? { value: overrides.gstin } : null,
    invoiceNoField: overrides.invoiceNo ? { value: overrides.invoiceNo } : null,
    total: overrides.total ?? null,
    invoiceDate: overrides.invoiceDate ?? null,
  };
}

beforeEach(() => {
  vi.mocked(prisma.invoice.findMany).mockReset();
});

describe("findDuplicates", () => {
  it("skips the check entirely when GSTIN is missing, no DB call made", async () => {
    const result = await findDuplicates(null, "INV-1", 100, new Date("2026-01-01"));
    expect(result).toEqual({ hardMatchId: null, softMatchId: null });
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it("finds a Tier 1 hard match: same GSTIN, invoice number, and total", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500 }),
    ] as never);

    const result = await findDuplicates("27AAPFU0939F1ZV", "INV-100", 500, null);
    expect(result).toEqual({ hardMatchId: "existing-1", softMatchId: null });
  });

  it("matches total within MONEY_TOL, not just exact equality", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({ id: "existing-1", gstin: "27AAPFU0939F1ZV", invoiceNo: "INV-100", total: 500.01 }),
    ] as never);

    const result = await findDuplicates("27AAPFU0939F1ZV", "INV-100", 500.0, null);
    expect(result.hardMatchId).toBe("existing-1");
  });

  it("finds a Tier 2 soft match: same GSTIN/total, different invoice number, date within 7 days", async () => {
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
      "27AAPFU0939F1ZV",
      "INV-NEW",
      500,
      new Date("2026-01-05"),
    );
    expect(result).toEqual({ hardMatchId: null, softMatchId: "existing-2" });
  });

  it("does not flag a Tier 2 match when the dates are more than 7 days apart", async () => {
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
      "27AAPFU0939F1ZV",
      "INV-NEW",
      500,
      new Date("2026-02-01"),
    );
    expect(result).toEqual({ hardMatchId: null, softMatchId: null });
  });

  it("prefers a Tier 1 match over a Tier 2 match when both are present", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      candidate({
        id: "soft-candidate",
        gstin: "27AAPFU0939F1ZV",
        invoiceNo: "INV-OLD",
        total: 500,
        invoiceDate: new Date("2026-01-01"),
      }),
      candidate({
        id: "hard-candidate",
        gstin: "27AAPFU0939F1ZV",
        invoiceNo: "INV-100",
        total: 500,
      }),
    ] as never);

    const result = await findDuplicates("27AAPFU0939F1ZV", "INV-100", 500, new Date("2026-01-05"));
    expect(result).toEqual({ hardMatchId: "hard-candidate", softMatchId: null });
  });

  it("excludes the given id from candidates (used on correction, so an invoice never matches itself)", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);

    await findDuplicates("27AAPFU0939F1ZV", "INV-100", 500, null, "self-id");

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "self-id" } }),
      }),
    );
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
    applyDuplicateResult(scored, { hardMatchId: "existing-1", softMatchId: null });

    const f = scored.fields.invoiceNo;
    expect(f.confidence).toBeLessThanOrEqual(0.3);
    expect(f.verified).toBe(false);
    expect(f.flags).toHaveLength(1);
    expect(f.flags[0]).toMatch(/existing-1/);
  });

  it("adds a warning without touching confidence, verified, or flags on a soft match", () => {
    const scored = mkScored({ invoiceNo: mkField() });
    applyDuplicateResult(scored, { hardMatchId: null, softMatchId: "existing-2" });

    const f = scored.fields.invoiceNo;
    expect(f.confidence).toBe(0.9);
    expect(f.verified).toBe(true);
    expect(f.flags).toHaveLength(0);
    expect(f.warnings).toHaveLength(1);
    expect(f.warnings![0]).toMatch(/existing-2/);
  });

  it("does nothing when neither tier matched", () => {
    const scored = mkScored({ invoiceNo: mkField() });
    applyDuplicateResult(scored, { hardMatchId: null, softMatchId: null });

    const f = scored.fields.invoiceNo;
    expect(f.confidence).toBe(0.9);
    expect(f.flags).toHaveLength(0);
    expect(f.warnings).toBeUndefined();
  });

  it("is a no-op when invoiceNo was never extracted", () => {
    const scored = mkScored({});
    expect(() => applyDuplicateResult(scored, { hardMatchId: "x", softMatchId: null })).not.toThrow();
    expect(scored.fields.invoiceNo).toBeUndefined();
  });
});
