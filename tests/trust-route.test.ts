import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/invoices/[id]/trust/route";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    invoice: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const params = (id: string) => ({ params: Promise.resolve({ id }) });

/** Minimal Prisma row shape `toView` can reshape — a scored field just needs `confidence`
 *  and `flags` to be recognized by `asField` in lib/invoice-view.ts. */
function mkRow(overrides: { totalFlags?: string[]; status?: string } = {}) {
  return {
    id: "inv1",
    status: overrides.status ?? "needs_review",
    fileUrl: "x.pdf",
    createdAt: new Date("2026-01-01"),
    fileData: null,
    lineItems: [],
    totalField: { value: "100.00", confidence: 0.9, verified: true, flags: overrides.totalFlags ?? [] },
  };
}

beforeEach(() => {
  vi.mocked(prisma.invoice.findUnique).mockReset();
  vi.mocked(prisma.invoice.update).mockReset();
});

describe("POST /api/invoices/:id/trust — server-enforced gate (D14)", () => {
  it("404s when the invoice doesn't exist", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null as never);

    const res = await POST(new Request("http://x"), params("missing"));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Invoice not found" });
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("refuses (409) with an open flag, even though nothing about the request asked the UI first", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(
      mkRow({ totalFlags: ["Subtotal + tax doesn't match total"] }) as never,
    );

    const res = await POST(new Request("http://x"), params("inv1"));

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/1 open flag/);
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("marks trusted and persists it when there are zero open flags", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(mkRow() as never);
    vi.mocked(prisma.invoice.update).mockResolvedValue({} as never);

    const res = await POST(new Request("http://x"), params("inv1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "inv1", status: "trusted" });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "inv1" },
      data: { status: "trusted" },
    });
  });

  it("refuses even a 'failed' (not-an-invoice) row, regardless of flags", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(mkRow({ status: "failed" }) as never);

    const res = await POST(new Request("http://x"), params("inv1"));

    expect(res.status).toBe(409);
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });
});
