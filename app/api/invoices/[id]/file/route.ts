import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Serves the source PDF — ONLY exists for seeded sample invoices used to demo provenance
 * (D21/D22). Real user uploads never have `fileData` set, so this 404s for every real row.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await prisma.invoice.findUnique({
    where: { id },
    select: { fileData: true },
  });

  if (!row?.fileData) {
    return NextResponse.json({ error: "No source document stored for this invoice" }, { status: 404 });
  }

  const bytes = Buffer.from(row.fileData, "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
