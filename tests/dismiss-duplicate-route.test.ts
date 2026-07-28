import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/invoices/[id]/dismiss-duplicate/route";
import { dismissDuplicate } from "@/lib/duplicate";

vi.mock("@/lib/duplicate", () => ({
  dismissDuplicate: vi.fn(),
}));

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(body: unknown) {
  return new Request("http://x", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(dismissDuplicate).mockReset().mockResolvedValue(undefined);
});

describe("POST /api/invoices/:id/dismiss-duplicate — the other half of resolving a candidate (D53)", () => {
  it("400s on invalid JSON", async () => {
    const res = await POST(req("{not json"), params("inv1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON body");
    expect(dismissDuplicate).not.toHaveBeenCalled();
  });

  it("400s when matchedInvoiceId is missing or the wrong type", async () => {
    const res = await POST(req({}), params("inv1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Expected \{ matchedInvoiceId: string \}/);
    expect(dismissDuplicate).not.toHaveBeenCalled();
  });

  it("records the dismissal and returns 200", async () => {
    const res = await POST(req({ matchedInvoiceId: "inv2" }), params("inv1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "inv1", dismissed: "inv2" });
    expect(dismissDuplicate).toHaveBeenCalledWith("inv1", "inv2");
  });
});
