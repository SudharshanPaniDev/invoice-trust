import { describe, it, expect, vi } from "vitest";
import { extractInvoice, type GenAILike } from "@/lib/extract";

function mockClient(impl: () => Promise<{ text?: string }>): GenAILike {
  return { models: { generateContent: vi.fn(impl) } };
}

const input = { data: Buffer.from("%PDF-fake"), mimeType: "application/pdf" };

describe("extractInvoice", () => {
  it("parses valid structured output into a RawInvoice", async () => {
    const client = mockClient(async () => ({
      text: JSON.stringify({
        isInvoice: true,
        vendorName: { value: "Acme Corp", modelConfidence: 0.9 },
        total: { value: "9500.00" },
      }),
    }));
    const result = await extractInvoice(input, { client });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.vendorName?.value).toBe("Acme Corp");
  });

  it("returns a non-invoice result without erroring", async () => {
    const client = mockClient(async () => ({ text: JSON.stringify({ isInvoice: false }) }));
    const result = await extractInvoice(input, { client });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.isInvoice).toBe(false);
  });

  it("fails cleanly on non-JSON model output", async () => {
    const client = mockClient(async () => ({ text: "sorry, I can't do that" }));
    const result = await extractInvoice(input, { client });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/non-JSON/);
  });

  it("fails cleanly on an empty response", async () => {
    const client = mockClient(async () => ({ text: undefined }));
    const result = await extractInvoice(input, { client });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/empty/);
  });

  it("fails cleanly when the SDK throws (network / rate limit)", async () => {
    const client = mockClient(async () => {
      throw new Error("429 rate limit");
    });
    const result = await extractInvoice(input, { client });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Gemini request failed/);
  });

  it("fails cleanly on schema-invalid JSON (missing isInvoice)", async () => {
    const client = mockClient(async () => ({ text: JSON.stringify({ vendorName: { value: "x" } }) }));
    const result = await extractInvoice(input, { client });
    expect(result.ok).toBe(false);
  });
});
