import { NextResponse } from "next/server";
import { applyCorrection } from "@/lib/correct";

export const runtime = "nodejs";

/**
 * Inline correction (D17): edit one field, re-validate the whole invoice, persist, and
 * return the fresh scored result so the UI reflects updated confidence/flags and the gate.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { field?: unknown; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { field, value } = body;
  if (typeof field !== "string" || typeof value !== "string") {
    return NextResponse.json({ error: "Expected { field: string, value: string }" }, { status: 400 });
  }

  try {
    const scored = await applyCorrection(id, field, value);
    if (!scored) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json({ id, scored });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }
}
