import { Prisma } from "./generated/prisma/client";

/**
 * Structured query over the trusted store (D4). Filters map to the indexed searchable
 * columns (D9), so this is plain relational filtering — no JSON gymnastics. The filter
 * object is resolved and explicit: what you filter on is exactly what runs.
 */
export interface InvoiceFilter {
  vendor?: string;
  status?: string;
  minTotal?: number;
  maxTotal?: number;
  from?: Date;
  to?: Date;
}

export function buildInvoiceWhere(f: InvoiceFilter): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {};

  if (f.vendor && f.vendor.trim() !== "") {
    where.vendorName = { contains: f.vendor.trim(), mode: "insensitive" };
  }
  if (f.status && f.status.trim() !== "") {
    where.status = f.status;
  }
  if (f.minTotal != null || f.maxTotal != null) {
    where.total = {
      ...(f.minTotal != null ? { gte: f.minTotal } : {}),
      ...(f.maxTotal != null ? { lte: f.maxTotal } : {}),
    };
  }
  if (f.from != null || f.to != null) {
    where.invoiceDate = {
      ...(f.from != null ? { gte: f.from } : {}),
      ...(f.to != null ? { lte: f.to } : {}),
    };
  }
  return where;
}

type RawParams = Record<string, string | string[] | undefined>;

const str = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const num = (v: string | string[] | undefined): number | undefined => {
  const s = str(v);
  if (s == null || s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

const date = (v: string | string[] | undefined): Date | undefined => {
  const s = str(v);
  if (s == null || s.trim() === "") return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/** Parse raw URL search params into a typed, sanitized filter. */
export function parseFilter(params: RawParams): InvoiceFilter {
  return {
    vendor: str(params.vendor),
    status: str(params.status),
    minTotal: num(params.minTotal),
    maxTotal: num(params.maxTotal),
    from: date(params.from),
    to: date(params.to),
  };
}
