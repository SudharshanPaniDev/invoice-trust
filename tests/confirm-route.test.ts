import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/invoices/[id]/confirm/route";
import { applyConfirmation } from "@/lib/correct";
import type { ScoredInvoice } from "@/lib/validation/confidence";

vi.mock("@/lib/correct", () => ({
  applyConfirmation: vi.fn(),
}));

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(body: unknown) {
  return new Request("http://x", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const fakeScored = { isInvoice: true, fields: {}, overall: { confidence: 0.85, status: "high", canTrust: true, openFlags: 0 }, rules: [] } as unknown as ScoredInvoice;

beforeEach(() => {
  vi.mocked(applyConfirmation).mockReset();
});

describe("POST /api/invoices/:id/confirm — human confirmation without an edit (D48)", () => {
  it("400s on invalid JSON", async () => {
    const res = await POST(req("{not json"), params("inv1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON body");
    expect(applyConfirmation).not.toHaveBeenCalled();
  });

  it("400s when field is missing or the wrong type", async () => {
    const res = await POST(req({}), params("inv1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Expected \{ field: string \}/);
    expect(applyConfirmation).not.toHaveBeenCalled();
  });

  it("404s when the invoice doesn't exist", async () => {
    vi.mocked(applyConfirmation).mockResolvedValue(null);

    const res = await POST(req({ field: "vendorName" }), params("missing"));

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Invoice not found");
  });

  it("confirms and returns the fresh scored result on success", async () => {
    vi.mocked(applyConfirmation).mockResolvedValue(fakeScored);

    const res = await POST(req({ field: "vendorName" }), params("inv1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "inv1", scored: fakeScored });
    expect(applyConfirmation).toHaveBeenCalledWith("inv1", "vendorName");
  });

  it("400s with the thrown message when confirmation fails (e.g. no value to confirm)", async () => {
    vi.mocked(applyConfirmation).mockRejectedValue(new Error("Cannot confirm vendorName: no value to confirm"));

    const res = await POST(req({ field: "vendorName" }), params("inv1"));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Cannot confirm vendorName: no value to confirm");
  });
});
