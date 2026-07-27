import { NextResponse } from "next/server";
import { applyConfirmation } from "@/lib/correct";

export const runtime = "nodejs";

/**
 * Confirm a field's current value without editing it (D48) — a human affirms an
 * otherwise-unverifiable value is correct. Distinct endpoint from the main PATCH
 * correction route because it's a distinct action: no value is written, and it earns a
 * different, lower confidence tier (85%, not 90/95) than an actual correction.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { field?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { field } = body;
  if (typeof field !== "string") {
    return NextResponse.json({ error: "Expected { field: string }" }, { status: 400 });
  }

  try {
    const scored = await applyConfirmation(id, field);
    if (!scored) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json({ id, scored });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }
}
