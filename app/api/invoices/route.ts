import { NextRequest, NextResponse } from "next/server";
import { extractInvoice } from "@/lib/extract";
import { scoreInvoice } from "@/lib/validation/confidence";
import { storeInvoice } from "@/lib/store";
import { findDuplicates, applyDuplicateResult } from "@/lib/duplicate";
import { parseAmount, parseDate } from "@/lib/validation/parse";

// Prisma (pg adapter) + Gemini SDK need the Node runtime, not edge.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await extractInvoice({
    data: bytes,
    mimeType: file.type || "application/pdf",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  const scored = scoreInvoice(result.data);

  // Cross-invoice duplicate detection (D44) — never blocks the upload itself, only flags/
  // warns the stored result, same as every other validation issue in this app.
  const dup = await findDuplicates(
    scored.fields.vendorGSTIN?.value ?? null,
    scored.fields.invoiceNo?.value ?? null,
    parseAmount(scored.fields.total?.value) ?? null,
    parseDate(scored.fields.invoiceDate?.value)?.date ?? null,
  );
  applyDuplicateResult(scored, dup);

  const invoice = await storeInvoice(result.data, scored, file.name);
  return NextResponse.json({
    id: invoice.id,
    status: invoice.status,
    scored,
  });
}
