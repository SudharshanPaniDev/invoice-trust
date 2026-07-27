import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLiveScoredInvoice } from "@/lib/correct";

export const runtime = "nodejs";

/**
 * Mark an invoice trusted. Server-enforced gate (D14): recompute open flags — including a
 * LIVE cross-invoice duplicate check, never a stored flag (D50) — and refuse (409) if any
 * are open. A client-side disable is not enough, since the whole product is that the system
 * won't vouch for unverified numbers; a stale persisted duplicate flag isn't enough either,
 * for the same reason — it could wrongly allow trust once its match is gone-but-unrefreshed,
 * or wrongly block it forever after the real duplicate was already resolved.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const scored = await getLiveScoredInvoice(id);
  if (!scored) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!scored.overall.canTrust) {
    return NextResponse.json(
      { error: `Cannot mark trusted: ${scored.overall.openFlags} open flag(s) must be resolved first` },
      { status: 409 },
    );
  }

  await prisma.invoice.update({ where: { id }, data: { status: "trusted" } });
  return NextResponse.json({ id, status: "trusted" });
}
