import { describe, it, expect } from "vitest";
import { validateGSTIN, isValidGSTIN, gstinCheckDigit } from "@/lib/validation/gstin";

describe("gstinCheckDigit", () => {
  it("computes the correct check digit for valid GSTINs", () => {
    expect(gstinCheckDigit("27AAPFU0939F1Z")).toBe("V");
    expect(gstinCheckDigit("24AAACC1206D1Z")).toBe("M");
  });
});

describe("validateGSTIN", () => {
  it("accepts valid GSTINs (format + checksum)", () => {
    expect(isValidGSTIN("27AAPFU0939F1ZV")).toBe(true);
    expect(isValidGSTIN("24AAACC1206D1ZM")).toBe(true);
  });

  it("normalizes case and whitespace", () => {
    expect(isValidGSTIN("  27aapfu0939f1zv  ")).toBe(true);
  });

  it("rejects a wrong checksum with an explanatory reason", () => {
    const r = validateGSTIN("29AABCT1332L1ZT"); // right shape, wrong check digit
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/checksum/i);
  });

  it("rejects bad format", () => {
    expect(validateGSTIN("27AAPFU0939F1Z").ok).toBe(false); // 14 chars
    expect(validateGSTIN("ABCDEFGHIJKLMNO").ok).toBe(false);
  });

  it("rejects missing input with a reason", () => {
    expect(validateGSTIN(null).ok).toBe(false);
    expect(validateGSTIN("").reason).toMatch(/missing/i);
  });
});
