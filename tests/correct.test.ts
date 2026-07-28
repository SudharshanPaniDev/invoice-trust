import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyCorrection, applyConfirmation, getLiveScoredInvoice } from "@/lib/correct";
import { prisma } from "@/lib/db";
import { updateInvoiceScored } from "@/lib/store";
import { overlayLiveDuplicateStatus } from "@/lib/duplicate";
import type { ScoredInvoice } from "@/lib/validation/confidence";

vi.mock("@/lib/db", () => ({
  prisma: { invoice: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/store", () => ({
  updateInvoiceScored: vi.fn(),
}));
vi.mock("@/lib/duplicate", () => ({
  overlayLiveDuplicateStatus: vi.fn(),
}));

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv1",
    status: "needs_review",
    fileUrl: "x",
    fileData: null,
    createdAt: new Date("2026-01-01"),
    lineItems: [],
    // No rule ever checks vendorName — it stays in the damped-model-estimate branch,
    // exactly the case D48's fix and the new confirm tier both target.
    vendorNameField: {
      value: "Metro Office Supplies Pvt Ltd",
      modelConfidence: 0.99,
      confidence: 0.69,
      verified: false,
      flags: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(prisma.invoice.findUnique).mockReset();
  vi.mocked(updateInvoiceScored).mockReset();
  vi.mocked(overlayLiveDuplicateStatus).mockReset().mockResolvedValue(undefined);
});

describe("applyCorrection — resubmitting the same value is not a correction (D48)", () => {
  it("marks a field corrected and raises confidence to 95% when the value actually changes", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(baseRow() as never);

    const scored = await applyCorrection("inv1", "vendorName", "Acme Corp");

    expect(scored!.fields.vendorName.corrected).toBe(true);
    expect(scored!.fields.vendorName.verified).toBe(true);
    expect(scored!.fields.vendorName.confidence).toBe(0.95);
  });

  it("does NOT mark corrected, does NOT raise confidence, when the resubmitted value is identical", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(baseRow() as never);

    const scored = await applyCorrection("inv1", "vendorName", "Metro Office Supplies Pvt Ltd");

    expect(scored!.fields.vendorName.corrected).toBeUndefined();
    expect(scored!.fields.vendorName.verified).toBe(false);
    // Same damped-model-estimate formula as before the "edit": min(0.7, modelConfidence * 0.7).
    expect(scored!.fields.vendorName.confidence).toBeCloseTo(0.693, 3);
  });

  it("a real edit clears any earlier confirmation on that field", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(
      baseRow({
        vendorNameField: {
          value: "Metro Office Supplies Pvt Ltd",
          modelConfidence: 0.99,
          confidence: 0.85,
          verified: true,
          confirmed: true,
          flags: [],
        },
      }) as never,
    );

    const scored = await applyCorrection("inv1", "vendorName", "Acme Corp");

    expect(scored!.fields.vendorName.confirmed).toBeUndefined();
    expect(scored!.fields.vendorName.corrected).toBe(true);
    expect(scored!.fields.vendorName.confidence).toBe(0.95);
  });

  it("still throws on an unknown field key, even though no value would actually change", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(baseRow() as never);

    await expect(applyCorrection("inv1", "bogusField", "x")).rejects.toThrow(/Unknown field: bogusField/);
  });

  it("returns null when the invoice doesn't exist", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null);

    const scored = await applyCorrection("missing", "vendorName", "x");

    expect(scored).toBeNull();
  });

  it("persists the pure scored result, then overlays a live duplicate check on the returned object only (D52)", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(baseRow() as never);
    let flagsAtPersistTime: string[] | undefined;
    vi.mocked(updateInvoiceScored).mockImplementation(async (_id, _raw, scoredArg) => {
      flagsAtPersistTime = [...(scoredArg as ScoredInvoice).fields.vendorName.flags];
      return {} as never;
    });
    vi.mocked(overlayLiveDuplicateStatus).mockImplementation(async (scoredArg) => {
      (scoredArg as ScoredInvoice).fields.vendorName.flags = [
        ...(scoredArg as ScoredInvoice).fields.vendorName.flags,
        "Possible duplicate of invoice other-id (same GSTIN, invoice number, and total)",
      ];
    });

    const scored = await applyCorrection("inv1", "vendorName", "Acme Corp");

    expect(flagsAtPersistTime).toEqual([]); // nothing about the duplicate check was persisted
    expect(scored!.fields.vendorName.flags).toContain(
      "Possible duplicate of invoice other-id (same GSTIN, invoice number, and total)",
    );
    expect(overlayLiveDuplicateStatus).toHaveBeenCalledWith(expect.anything(), "inv1");
  });
});

describe("applyConfirmation — affirming a value without editing it (D48)", () => {
  it("marks a field confirmed and raises confidence to 85%, without touching its value", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(baseRow() as never);

    const scored = await applyConfirmation("inv1", "vendorName");

    expect(scored!.fields.vendorName.value).toBe("Metro Office Supplies Pvt Ltd");
    expect(scored!.fields.vendorName.confirmed).toBe(true);
    expect(scored!.fields.vendorName.corrected).toBeUndefined();
    expect(scored!.fields.vendorName.verified).toBe(true);
    expect(scored!.fields.vendorName.confidence).toBe(0.85);
  });

  it("refuses to confirm a field with no value", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(baseRow({ vendorNameField: null }) as never);

    await expect(applyConfirmation("inv1", "vendorName")).rejects.toThrow(
      /Cannot confirm vendorName: no value to confirm/,
    );
  });

  it("throws on an unknown field key", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(baseRow() as never);

    await expect(applyConfirmation("inv1", "bogusField")).rejects.toThrow(/Unknown field: bogusField/);
  });

  it("returns null when the invoice doesn't exist", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null);

    const scored = await applyConfirmation("missing", "vendorName");

    expect(scored).toBeNull();
  });

  it("a rule-verified field confirmed anyway still shows 90%, not 85% — a passed rule always outranks a confirm", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(
      baseRow({
        vendorNameField: null,
        totalField: { value: "118.00", modelConfidence: 0.9, confidence: 0.9, verified: true, flags: [] },
        subtotalField: { value: "100.00", modelConfidence: 0.9, confidence: 0.9, verified: true, flags: [] },
        taxAmountField: { value: "18.00", modelConfidence: 0.9, confidence: 0.9, verified: true, flags: [] },
      }) as never,
    );

    const scored = await applyConfirmation("inv1", "total");

    expect(scored!.fields.total.confidence).toBe(0.9);
    expect(scored!.fields.total.confirmed).toBeUndefined();
  });

  it("overlays the live duplicate check after persisting, same as applyCorrection (D52)", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(baseRow() as never);

    await applyConfirmation("inv1", "vendorName");

    expect(updateInvoiceScored).toHaveBeenCalled();
    expect(overlayLiveDuplicateStatus).toHaveBeenCalledWith(expect.anything(), "inv1");
  });
});

describe("getLiveScoredInvoice — read-only live duplicate check, nothing persisted (D50/D52)", () => {
  it("overlays the live duplicate check and returns the scored result WITHOUT persisting anything", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(baseRow() as never);

    const scored = await getLiveScoredInvoice("inv1");

    expect(scored!.fields.vendorName.value).toBe("Metro Office Supplies Pvt Ltd");
    expect(overlayLiveDuplicateStatus).toHaveBeenCalledWith(expect.anything(), "inv1");
    expect(updateInvoiceScored).not.toHaveBeenCalled();
  });

  it("accepts an already-fetched row and skips a second DB fetch", async () => {
    const row = baseRow();

    const scored = await getLiveScoredInvoice("inv1", row as never);

    expect(scored!.fields.vendorName.value).toBe("Metro Office Supplies Pvt Ltd");
    expect(prisma.invoice.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the invoice doesn't exist", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null);

    const scored = await getLiveScoredInvoice("missing");

    expect(scored).toBeNull();
  });
});
