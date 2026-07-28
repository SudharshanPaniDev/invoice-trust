import { NextResponse } from "next/server";
import { dismissDuplicate } from "@/lib/duplicate";

export const runtime = "nodejs";

/**
 * Records that a human has looked at this pair and decided they are NOT the same document
 * (D53) — the other half of resolving a duplicate candidate, alongside DELETE. Symmetric
 * and idempotent: dismissing (A, B) also clears (B, A), and dismissing an already-dismissed
 * pair is a no-op, not an error.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { matchedInvoiceId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { matchedInvoiceId } = body;
  if (typeof matchedInvoiceId !== "string") {
    return NextResponse.json({ error: "Expected { matchedInvoiceId: string }" }, { status: 400 });
  }

  await dismissDuplicate(id, matchedInvoiceId);
  return NextResponse.json({ id, dismissed: matchedInvoiceId });
}
