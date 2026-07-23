import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toView, type StoredInvoice } from "@/lib/invoice-view";

export const runtime = "nodejs";

/**
 * Mark an invoice trusted. Server-enforced gate (D14): recompute open flags from the stored
 * per-field trust JSON and refuse (409) if any flag is open — a client-side disable is not
 * enough, since the whole product is that the system won't vouch for unverified numbers.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await prisma.invoice.findUnique({
    where: { id },
    include: { lineItems: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const view = toView(row as unknown as StoredInvoice);
  if (!view.canTrust) {
    return NextResponse.json(
      { error: `Cannot mark trusted: ${view.openFlags} open flag(s) must be resolved first` },
      { status: 409 },
    );
  }

  await prisma.invoice.update({ where: { id }, data: { status: "trusted" } });
  return NextResponse.json({ id, status: "trusted" });
}
