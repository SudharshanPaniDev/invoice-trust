import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "@/app/api/invoices/[id]/route";
import { prisma } from "@/lib/db";
import { revalidateDuplicate } from "@/lib/correct";

vi.mock("@/lib/db", () => ({
  prisma: { invoice: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn() } },
}));
vi.mock("@/lib/correct", () => ({
  applyCorrection: vi.fn(),
  revalidateDuplicate: vi.fn(),
}));

const params = (id: string) => ({ params: Promise.resolve({ id }) });

/** A row shaped for BOTH live classification (vendorGSTINField/total/invoiceDate, read by
 *  `classifyAllDuplicates`, D50) and the stale-flag staleIds selection that still runs after
 *  a delete (invoiceNoField.flags/.warnings, read by `classifyDuplicateField`). */
function identityRow(overrides: {
  id: string;
  gstin?: string;
  invoiceNo?: string;
  total?: number;
  invoiceDate?: Date;
  flags?: string[];
  warnings?: string[];
}) {
  return {
    id: overrides.id,
    vendorGSTINField: overrides.gstin ? { value: overrides.gstin } : null,
    invoiceNoField: {
      value: overrides.invoiceNo ?? null,
      flags: overrides.flags ?? [],
      ...(overrides.warnings ? { warnings: overrides.warnings } : {}),
    },
    total: overrides.total ?? null,
    invoiceDate: overrides.invoiceDate ?? null,
  };
}

beforeEach(() => {
  vi.mocked(prisma.invoice.findUnique).mockReset();
  vi.mocked(prisma.invoice.findMany).mockReset().mockResolvedValue([]);
  vi.mocked(prisma.invoice.delete).mockReset();
  vi.mocked(revalidateDuplicate).mockReset();
});

describe("DELETE /api/invoices/:id — only while a LIVE hard-duplicate match exists (D48/D49/D50)", () => {
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
    expect((await res.json()).error).toMatch(/hard-duplicate flag/);
    expect(prisma.invoice.delete).not.toHaveBeenCalled();
  });

  it("409s for a soft (non-blocking) live match — only a hard match authorizes delete", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({ id: "inv1" } as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      identityRow({ id: "inv1", gstin: "G1", invoiceNo: "INV-1", total: 100, invoiceDate: new Date("2026-01-01") }),
      identityRow({ id: "inv2", gstin: "G1", invoiceNo: "INV-OLD", total: 100, invoiceDate: new Date("2026-01-03") }),
    ] as never);

    const res = await DELETE(new Request("http://x"), params("inv1"));

    expect(res.status).toBe(409);
    expect(prisma.invoice.delete).not.toHaveBeenCalled();
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

  it("deletes and returns 200 when a LIVE hard match currently exists", async () => {
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
  });

  it("re-validates only remaining invoices that currently show a STORED duplicate signal (D49)", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({ id: "inv1" } as never);
    // Call #1: classifyAllDuplicates's live authorization check (inv1 hard-matches inv1match).
    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([
      identityRow({ id: "inv1", gstin: "G1", invoiceNo: "INV-1", total: 100 }),
      identityRow({ id: "inv1match", gstin: "G1", invoiceNo: "INV-1", total: 100 }),
    ] as never);
    // Call #2: staleIds selection off the STORED flags/warnings text, post-delete.
    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([
      identityRow({ id: "inv2", flags: ["Possible duplicate of invoice inv1 (same GSTIN, invoice number, and total)"] }),
      identityRow({ id: "inv3", flags: [] }),
    ] as never);
    vi.mocked(prisma.invoice.delete).mockResolvedValue({} as never);

    await DELETE(new Request("http://x"), params("inv1"));

    expect(revalidateDuplicate).toHaveBeenCalledTimes(1);
    expect(revalidateDuplicate).toHaveBeenCalledWith("inv2");
    expect(revalidateDuplicate).not.toHaveBeenCalledWith("inv3");
  });

  it("does not re-validate anything when no remaining invoice shows a stored duplicate signal", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({ id: "inv1" } as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([
      identityRow({ id: "inv1", gstin: "G1", invoiceNo: "INV-1", total: 100 }),
      identityRow({ id: "inv1match", gstin: "G1", invoiceNo: "INV-1", total: 100 }),
    ] as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([
      identityRow({ id: "inv3", flags: [] }),
    ] as never);
    vi.mocked(prisma.invoice.delete).mockResolvedValue({} as never);

    await DELETE(new Request("http://x"), params("inv1"));

    expect(revalidateDuplicate).not.toHaveBeenCalled();
  });
});
