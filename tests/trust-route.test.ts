import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/invoices/[id]/trust/route";
import { prisma } from "@/lib/db";
import { getLiveScoredInvoice } from "@/lib/correct";
import type { ScoredInvoice } from "@/lib/validation/confidence";

vi.mock("@/lib/db", () => ({
  prisma: { invoice: { update: vi.fn() } },
}));
vi.mock("@/lib/correct", () => ({
  getLiveScoredInvoice: vi.fn(),
}));

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function mkScored(overall: Partial<ScoredInvoice["overall"]> = {}): ScoredInvoice {
  return {
    isInvoice: true,
    fields: {},
    overall: { confidence: 0.9, status: "high", canTrust: true, openFlags: 0, ...overall },
    rules: [],
  };
}

beforeEach(() => {
  vi.mocked(prisma.invoice.update).mockReset();
  vi.mocked(getLiveScoredInvoice).mockReset();
});

describe("POST /api/invoices/:id/trust — server-enforced gate (D14), now a LIVE check (D50)", () => {
  it("404s when the invoice doesn't exist", async () => {
    vi.mocked(getLiveScoredInvoice).mockResolvedValue(null);

    const res = await POST(new Request("http://x"), params("missing"));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Invoice not found" });
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("refuses (409) with an open flag — computed live via getLiveScoredInvoice, not a stored flag", async () => {
    vi.mocked(getLiveScoredInvoice).mockResolvedValue(mkScored({ canTrust: false, openFlags: 1 }));

    const res = await POST(new Request("http://x"), params("inv1"));

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/1 open flag/);
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("marks trusted and persists it when there are zero open flags", async () => {
    vi.mocked(getLiveScoredInvoice).mockResolvedValue(mkScored({ canTrust: true, openFlags: 0 }));
    vi.mocked(prisma.invoice.update).mockResolvedValue({} as never);

    const res = await POST(new Request("http://x"), params("inv1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "inv1", status: "trusted" });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "inv1" },
      data: { status: "trusted" },
    });
  });

  it("refuses when canTrust is false regardless of the open-flag count (e.g. a live duplicate match)", async () => {
    vi.mocked(getLiveScoredInvoice).mockResolvedValue(mkScored({ canTrust: false, openFlags: 0 }));

    const res = await POST(new Request("http://x"), params("inv1"));

    expect(res.status).toBe(409);
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("asks for the live check by invoice id, not a cached/stored verdict", async () => {
    vi.mocked(getLiveScoredInvoice).mockResolvedValue(mkScored());
    vi.mocked(prisma.invoice.update).mockResolvedValue({} as never);

    await POST(new Request("http://x"), params("inv1"));

    expect(getLiveScoredInvoice).toHaveBeenCalledWith("inv1");
  });
});
