import { NextRequest, NextResponse } from "next/server";
import { extractInvoice } from "@/lib/extract";
import { storeInvoice } from "@/lib/store";

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

  const invoice = await storeInvoice(result.data, file.name);
  return NextResponse.json({
    id: invoice.id,
    status: invoice.status,
    data: result.data,
  });
}
