import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseFilter, buildInvoiceWhere } from "@/lib/query";
import { toView, type StoredInvoice, type InvoiceView } from "@/lib/invoice-view";

export const runtime = "nodejs";

/**
 * Structured export (D42) — the first place trust has to survive leaving the UI. Defaults
 * to trusted invoices only within whatever's currently filtered; `includeAll=true` respects
 * the filter's own status as-is instead (e.g. exporting a needs-review batch on purpose).
 * `status`/`confidence`/`flags` are always present columns/fields regardless of scope, so
 * nothing exported is ever ambiguous about its trust state.
 */

const FIELD_COLUMNS: [string, string][] = [
  ["vendorName", "Vendor"],
  ["vendorGSTIN", "GSTIN"],
  ["invoiceNo", "Invoice No"],
  ["invoiceDate", "Invoice Date"],
  ["dueDate", "Due Date"],
  ["currency", "Currency"],
  ["subtotal", "Subtotal"],
  ["taxRate", "Tax Rate"],
  ["taxAmount", "Tax Amount"],
  ["total", "Total"],
];

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(views: InvoiceView[]): string {
  const headers = [
    "id",
    "status",
    "canTrust",
    "openFlags",
    "Flags",
    "createdAt",
    ...FIELD_COLUMNS.flatMap(([, label]) => [label, `${label} Confidence`]),
  ];
  const rows = views.map((v) => {
    // One combined column, not one per field: for the trusted-only default (the common
    // case), every per-field flags column would be empty on every row by definition
    // (trusted requires openFlags === 0, D14) — real, always-blank noise. Consolidating
    // loses no information (only matters when includeAll=true anyway) and keeps the CSV
    // shape identical regardless of scope.
    const flagSummary = FIELD_COLUMNS.flatMap(([key, label]) => {
      const f = v.fields[key];
      return f?.flags.map((flag) => `${label}: ${flag}`) ?? [];
    }).join("; ");

    const base = [v.id, v.status, v.canTrust, v.openFlags, flagSummary, v.createdAt.toISOString()];
    const fieldCells = FIELD_COLUMNS.flatMap(([key]) => {
      const f = v.fields[key];
      return [f?.value ?? "", f ? `${Math.round(f.confidence * 100)}%` : ""];
    });
    return [...base, ...fieldCells];
  });
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const filter = parseFilter(params);
  const where = buildInvoiceWhere(filter);
  const format = params.format === "json" ? "json" : "csv";
  const includeAll = params.includeAll === "true";

  const finalWhere = includeAll ? where : { ...where, status: "trusted" };

  const rows = await prisma.invoice.findMany({
    where: finalWhere,
    orderBy: { createdAt: "desc" },
    include: { lineItems: true },
  });
  const views = rows.map((r) => toView(r as unknown as StoredInvoice));

  if (format === "json") {
    return new NextResponse(JSON.stringify(views, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="invoices-export.json"',
      },
    });
  }

  return new NextResponse(toCsv(views), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="invoices-export.csv"',
    },
  });
}
