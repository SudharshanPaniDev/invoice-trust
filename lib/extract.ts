import { GoogleGenAI, Type } from "@google/genai";
import { parseExtraction, type RawInvoice } from "./schema";

// Confirmed working against the live API (D11). Override via env if needed.
const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

/** Minimal shape we depend on — lets tests inject a fake instead of the real SDK. */
export interface GenAILike {
  models: {
    generateContent(args: unknown): Promise<{ text?: string }>;
  };
}

const EXTRACTION_PROMPT = `You are an invoice data extractor. Extract the fields from the
attached document.

Rules:
- If the document is NOT an invoice, set "isInvoice" to false and leave fields null.
- For every field, return the value EXACTLY as written on the document, as a string
  (e.g. keep currency symbols and separators: "₹9,500.00"). Do not reformat or compute.
- If a field is absent, set its "value" to null. NEVER invent a value.
- "modelConfidence" is your own 0..1 confidence for that field.
- "bbox" is [ymin, xmin, ymax, xmax] normalized to 0-1000 over the page.
- "sourceText" is the raw text snippet you read the value from.
- Extract every line item in order.`;

// A single extracted field, as Gemini structured output.
const fieldSchema = {
  type: Type.OBJECT,
  properties: {
    value: { type: Type.STRING, nullable: true },
    modelConfidence: { type: Type.NUMBER, nullable: true },
    bbox: { type: Type.ARRAY, items: { type: Type.NUMBER }, nullable: true },
    sourceText: { type: Type.STRING, nullable: true },
  },
  required: ["value"],
} as const;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    isInvoice: { type: Type.BOOLEAN },
    vendorName: fieldSchema,
    vendorGSTIN: fieldSchema,
    invoiceNo: fieldSchema,
    invoiceDate: fieldSchema,
    dueDate: fieldSchema,
    currency: fieldSchema,
    subtotal: fieldSchema,
    taxRate: fieldSchema,
    taxAmount: fieldSchema,
    total: fieldSchema,
    lineItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: fieldSchema,
          quantity: fieldSchema,
          unitPrice: fieldSchema,
          lineAmount: fieldSchema,
        },
      },
    },
  },
  required: ["isInvoice"],
} as const;

export interface ExtractInput {
  /** Raw file bytes (PDF or image). Sent to Gemini inline — no server-side render (D11). */
  data: Uint8Array | Buffer;
  /** e.g. "application/pdf", "image/png". */
  mimeType: string;
}

export interface ExtractOptions {
  client?: GenAILike;
  model?: string;
}

function defaultClient(): GenAILike {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey }) as unknown as GenAILike;
}

/**
 * Extract structured fields from an invoice file via Gemini. Returns a result rather than
 * throwing on bad model output: network/SDK errors and malformed JSON both come back as
 * { ok: false }, so the caller can mark the invoice `failed` with a reason (plan Phase 1).
 */
export async function extractInvoice(
  input: ExtractInput,
  opts: ExtractOptions = {},
): Promise<{ ok: true; data: RawInvoice } | { ok: false; error: string }> {
  const client = opts.client ?? defaultClient();
  const model = opts.model ?? DEFAULT_MODEL;
  const base64 = Buffer.from(input.data).toString("base64");

  let text: string | undefined;
  try {
    const response = await client.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { inlineData: { mimeType: input.mimeType, data: base64 } },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });
    text = response.text;
  } catch (e) {
    return { ok: false, error: `Gemini request failed: ${String(e)}` };
  }

  if (!text) return { ok: false, error: "Gemini returned an empty response" };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "Gemini returned non-JSON output" };
  }

  return parseExtraction(json);
}
