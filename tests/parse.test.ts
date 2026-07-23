import { describe, it, expect } from "vitest";
import { parseAmount, parseRate, parseDate } from "@/lib/validation/parse";

describe("parseAmount", () => {
  it("strips currency words and thousands separators (real fixture formats)", () => {
    expect(parseAmount("INR 11,210.00")).toBe(11210);
    expect(parseAmount("5,000.00")).toBe(5000);
    expect(parseAmount("₹9,500.00")).toBe(9500);
    expect(parseAmount("900.00")).toBe(900);
  });

  it("handles Indian lakh grouping", () => {
    expect(parseAmount("1,00,000.00")).toBe(100000);
  });

  it("handles accounting negatives", () => {
    expect(parseAmount("(1,200.50)")).toBe(-1200.5);
  });

  it("returns null for unparseable / empty input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount("N/A")).toBeNull();
  });
});

describe("parseRate", () => {
  it("parses percent strings to a fraction", () => {
    expect(parseRate("18%")).toBeCloseTo(0.18);
    expect(parseRate("5%")).toBeCloseTo(0.05);
  });
  it("treats a bare number > 1 as a percent", () => {
    expect(parseRate("18")).toBeCloseTo(0.18);
  });
  it("treats a fraction as-is", () => {
    expect(parseRate("0.18")).toBeCloseTo(0.18);
  });
  it("returns null for junk", () => {
    expect(parseRate("abc")).toBeNull();
  });
});

describe("parseDate", () => {
  it("parses ISO dates", () => {
    expect(parseDate("2026-07-15")?.iso).toBe("2026-07-15");
  });
  it("parses DD/MM/YYYY", () => {
    expect(parseDate("15/07/2026")?.iso).toBe("2026-07-15");
  });
  it("swaps when it looks like MM/DD/YYYY", () => {
    expect(parseDate("07/15/2026")?.iso).toBe("2026-07-15");
  });
  it("rejects impossible dates", () => {
    expect(parseDate("2026-02-31")).toBeNull();
    expect(parseDate("not a date")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});
