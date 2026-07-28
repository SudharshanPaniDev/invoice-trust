import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "@/app/api/invoices/[id]/route";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    invoice: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
    dismissedDuplicate: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/correct", () => ({
  applyCorrection: vi.fn(),
}));

const params = (id: string) => ({ params: Promise.resolve({ id }) });

/** Shaped for live classification (`classifyAllDuplicates`, D50/D52) — GSTIN/invoiceNo/
 *  total/date only; nothing about duplicate status is ever read from stored flags anymore. */
function identityRow(overrides: {
  id: string;
  gstin?: string;
  invoiceNo?: string;
  total?: number;
  invoiceDate?: Date;
}) {
  return {
    id: overrides.id,
    vendorGSTINField: overrides.gstin ? { value: overrides.gstin } : null,
    invoiceNoField: { value: overrides.invoiceNo ?? null },
    total: overrides.total ?? null,
    invoiceDate: overrides.invoiceDate ?? null,
  };
}

beforeEach(() => {
  vi.mocked(prisma.invoice.findUnique).mockReset();
  vi.mocked(prisma.invoice.findMany).mockReset().mockResolvedValue([]);
  vi.mocked(prisma.invoice.delete).mockReset();
  vi.mocked(prisma.dismissedDuplicate.findMany).mockReset().mockResolvedValue([]);
});

describe("DELETE /api/invoices/:id — only while a LIVE duplicate candidate exists (D48/D49/D50/D52, one tier D53)", () => {
  it("404s when the invoice doesn't exist", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null as never);

    const res = await DELETE(new Request("http://x"), params("missing"));

    expect(res.status).toBe(404);
    expect(prisma.invoice.delete).not.toHaveBeenCalled();
  });

  it("409s when no other invoice matches at all", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({ id: "inv1" } as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      identityRow({ id: "inv1", gstin: "G1", invoiceNo: "INV-1", total: 100 }),
    ] as never);

    const res = await DELETE(new Request("http://x"), params("inv1"));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/duplicate candidate/);
    expect(prisma.invoice.delete).not.toHaveBeenCalled();
  });

  it("allows delete for a GSTIN + date-proximity match too — any candidate authorizes it, not just an exact one", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({ id: "inv1" } as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      identityRow({ id: "inv1", gstin: "G1", invoiceNo: "INV-1", total: 100, invoiceDate: new Date("2026-01-01") }),
      identityRow({ id: "inv2", gstin: "G1", invoiceNo: "INV-OLD", total: 100, invoiceDate: new Date("2026-01-03") }),
    ] as never);
    vi.mocked(prisma.invoice.delete).mockResolvedValue({} as never);

    const res = await DELETE(new Request("http://x"), params("inv1"));

    expect(res.status).toBe(200);
    expect(prisma.invoice.delete).toHaveBeenCalledWith({ where: { id: "inv1" } });
  });

  it("409s when the invoice has no GSTIN/total to compare — nothing can ever match", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({ id: "inv1" } as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      identityRow({ id: "inv1", invoiceNo: "INV-1" }),
      identityRow({ id: "inv2", gstin: "G1", invoiceNo: "INV-1", total: 100 }),
    ] as never);

    const res = await DELETE(new Request("http://x"), params("inv1"));

    expect(res.status).toBe(409);
    expect(prisma.invoice.delete).not.toHaveBeenCalled();
  });

  it("409s when the only match has already been dismissed", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({ id: "inv1" } as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      identityRow({ id: "inv1", gstin: "G1", invoiceNo: "INV-1", total: 100 }),
      identityRow({ id: "inv2", gstin: "G1", invoiceNo: "INV-1", total: 100 }),
    ] as never);
    vi.mocked(prisma.dismissedDuplicate.findMany).mockResolvedValue([
      { invoiceIdLow: "inv1", invoiceIdHigh: "inv2" },
    ] as never);

    const res = await DELETE(new Request("http://x"), params("inv1"));

    expect(res.status).toBe(409);
    expect(prisma.invoice.delete).not.toHaveBeenCalled();
  });

  it("deletes and returns 200 when a LIVE duplicate candidate currently exists", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({ id: "inv1" } as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      identityRow({ id: "inv1", gstin: "G1", invoiceNo: "INV-1", total: 100 }),
      identityRow({ id: "inv2", gstin: "G1", invoiceNo: "INV-1", total: 100 }),
    ] as never);
    vi.mocked(prisma.invoice.delete).mockResolvedValue({} as never);

    const res = await DELETE(new Request("http://x"), params("inv1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "inv1", deleted: true });
    expect(prisma.invoice.delete).toHaveBeenCalledWith({ where: { id: "inv1" } });
    // D52: nothing is persisted for duplicates, so nothing needs revalidating after a
    // delete — exactly one findMany call (the authorization check), not a second pass.
    expect(prisma.invoice.findMany).toHaveBeenCalledTimes(1);
  });
});
