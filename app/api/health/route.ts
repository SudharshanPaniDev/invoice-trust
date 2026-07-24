import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trivial DB round-trip, pinged on a schedule (.github/workflows/keep-warm.yml) so Neon's
 * free-tier compute doesn't auto-suspend between visits — the cold-start-after-idle wake-up
 * otherwise shows up as a several-hundred-ms-to-2s lag on whichever page a visitor clicks
 * first. Free workaround since upgrading Neon's plan is off the table.
 */
export async function GET() {
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ ok: true });
}
