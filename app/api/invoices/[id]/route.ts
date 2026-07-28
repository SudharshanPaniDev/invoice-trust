import { NextResponse } from "next/server";
import { applyCorrection } from "@/lib/correct";
import { prisma } from "@/lib/db";
import { classifyAllDuplicates } from "@/lib/duplicate";

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

/**
 * Delete an invoice — but only while it currently has an open, unresolved duplicate
 * candidate (D49, single-tier D53). Not a general "delete any invoice" capability: a
 * confirmed duplicate has no other legitimate resolution (D17's rule failures can't be
 * human-overridden, only fixed — and there's nothing to "fix" when both records are
 * correct, just redundant), so removing the redundant record is the actual correct action,
 * not a workaround. Server-enforced, the same way the trust gate is (D14): the condition is
 * re-checked here, not just hidden in the UI — checked LIVE (`classifyAllDuplicates`), not
 * from a stored flag, so a stale flag can neither wrongly allow nor wrongly block a delete.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await prisma.invoice.findUnique({ where: { id }, select: { id: true } });
  if (!row) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const duplicates = await classifyAllDuplicates();
  if (!duplicates.has(id)) {
    return NextResponse.json(
      { error: "Can only delete an invoice that currently has an open duplicate candidate" },
      { status: 409 },
    );
  }

  await prisma.invoice.delete({ where: { id } });
  return NextResponse.json({ id, deleted: true });
}
