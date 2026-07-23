import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseExtraction } from "@/lib/schema";
import { scoreInvoice } from "@/lib/validation/confidence";

/**
 * Verifies the hand-authored sample-invoice fixtures each produce their INTENDED
 * demo outcome. These fixtures exist to reliably demonstrate designed rule behaviors
 * (D24) — extraction realism is already proven elsewhere (invoice-01, the real Jio bill).
 */

function loadScored(path: string) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const parsed = parseExtraction(raw);
  if (!parsed.ok) throw new Error(`${path} failed to parse: ${parsed.error}`);
  return scoreInvoice(parsed.data);
}

describe("sample-clean fixture", () => {
  const s = loadScored("tests/fixtures/sample-clean.extracted.json");

  it("passes every check and is trustable", () => {
    expect(s.overall.canTrust).toBe(true);
    expect(s.overall.openFlags).toBe(0);
  });

  it("earns high confidence on the arithmetic-corroborated fields", () => {
    expect(s.fields.total.verified).toBe(true);
    expect(s.fields.subtotal.verified).toBe(true);
    expect(s.fields.taxAmount.verified).toBe(true);
    expect(s.fields.vendorGSTIN.verified).toBe(true);
  });
});

describe("sample-mismatch fixture", () => {
  const s = loadScored("tests/fixtures/sample-mismatch.extracted.json");

  it("blocks trust — the one failed rule (subtotal+tax=total) floors every field it touches", () => {
    // A single failed rule floors ALL fields it bears on (subtotal, taxAmount, total) —
    // the engine can't know which of the three numbers is actually wrong, so it withholds
    // trust on all three rather than guessing. That's one broken RULE, not three unrelated ones.
    expect(s.overall.canTrust).toBe(false);
    expect(s.fields.total.flags[0]).toMatch(/17,?000/);
    expect(s.fields.subtotal.flags[0]).toMatch(/17,?000/);
    expect(s.fields.taxAmount.flags[0]).toMatch(/17,?000/);
  });

  it("isolates the defect to arithmetic — GSTIN and line items are unaffected", () => {
    expect(s.fields.vendorGSTIN.verified).toBe(true);
    expect(s.fields.vendorGSTIN.flags.length).toBe(0);
    expect(s.fields["lineItems.0.lineAmount"].flags.length).toBe(0);
    expect(s.fields["lineItems.1.lineAmount"].flags.length).toBe(0);
  });
});
