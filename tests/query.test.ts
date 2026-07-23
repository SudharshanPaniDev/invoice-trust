import { describe, it, expect } from "vitest";
import { buildInvoiceWhere, parseFilter } from "@/lib/query";

describe("buildInvoiceWhere", () => {
  it("is empty for no filters", () => {
    expect(buildInvoiceWhere({})).toEqual({});
  });

  it("does a case-insensitive vendor contains", () => {
    expect(buildInvoiceWhere({ vendor: "acme" }).vendorName).toEqual({
      contains: "acme",
      mode: "insensitive",
    });
  });

  it("builds an amount range", () => {
    expect(buildInvoiceWhere({ minTotal: 100, maxTotal: 500 }).total).toEqual({
      gte: 100,
      lte: 500,
    });
    expect(buildInvoiceWhere({ minTotal: 100 }).total).toEqual({ gte: 100 });
  });

  it("builds a date range", () => {
    const from = new Date("2026-07-01");
    const to = new Date("2026-07-31");
    expect(buildInvoiceWhere({ from, to }).invoiceDate).toEqual({ gte: from, lte: to });
  });

  it("filters by exact status", () => {
    expect(buildInvoiceWhere({ status: "trusted" }).status).toBe("trusted");
  });

  it("ignores blank strings", () => {
    expect(buildInvoiceWhere({ vendor: "  ", status: "" })).toEqual({});
  });
});

describe("parseFilter", () => {
  it("coerces and sanitizes raw params", () => {
    const f = parseFilter({
      vendor: "Acme",
      status: "needs_review",
      minTotal: "100",
      maxTotal: "abc", // invalid -> dropped
      from: "2026-07-01",
      to: "not-a-date", // invalid -> dropped
    });
    expect(f.vendor).toBe("Acme");
    expect(f.minTotal).toBe(100);
    expect(f.maxTotal).toBeUndefined();
    expect(f.from).toBeInstanceOf(Date);
    expect(f.to).toBeUndefined();
  });
});
