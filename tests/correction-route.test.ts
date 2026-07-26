import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "@/app/api/invoices/[id]/route";
import { applyCorrection } from "@/lib/correct";
import type { ScoredInvoice } from "@/lib/validation/confidence";

vi.mock("@/lib/correct", () => ({
  applyCorrection: vi.fn(),
}));

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(body: unknown) {
  return new Request("http://x", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const fakeScored = { isInvoice: true, fields: {}, overall: { confidence: 0.9, status: "high", canTrust: true, openFlags: 0 }, rules: [] } as unknown as ScoredInvoice;

beforeEach(() => {
  vi.mocked(applyCorrection).mockReset();
});

describe("PATCH /api/invoices/:id — inline correction (D17)", () => {
  it("400s on invalid JSON", async () => {
    const res = await PATCH(req("{not json"), params("inv1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON body");
    expect(applyCorrection).not.toHaveBeenCalled();
  });

  it("400s when field or value is missing or the wrong type", async () => {
    const res = await PATCH(req({ field: "vendorName" }), params("inv1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Expected \{ field: string, value: string \}/);
    expect(applyCorrection).not.toHaveBeenCalled();
  });

  it("404s when the invoice doesn't exist", async () => {
    vi.mocked(applyCorrection).mockResolvedValue(null);

    const res = await PATCH(req({ field: "vendorName", value: "Acme" }), params("missing"));

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Invoice not found");
  });

  it("re-validates the whole invoice and returns the fresh scored result on success", async () => {
    vi.mocked(applyCorrection).mockResolvedValue(fakeScored);

    const res = await PATCH(req({ field: "vendorName", value: "Acme Corp" }), params("inv1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "inv1", scored: fakeScored });
    expect(applyCorrection).toHaveBeenCalledWith("inv1", "vendorName", "Acme Corp");
  });

  it("400s with the thrown message when correction fails (e.g. unknown field)", async () => {
    vi.mocked(applyCorrection).mockRejectedValue(new Error("Unknown field: bogusField"));

    const res = await PATCH(req({ field: "bogusField", value: "x" }), params("inv1"));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Unknown field: bogusField");
  });
});
