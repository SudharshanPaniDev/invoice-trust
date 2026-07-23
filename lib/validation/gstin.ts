/**
 * GSTIN validation: format AND checksum. The 15th character is a computed check digit,
 * so a GSTIN can be the right shape but still invalid — checking the checksum is the edge
 * that catches a transposed or hallucinated digit (D2).
 *
 * Format: 2 state digits | 5 PAN letters | 4 PAN digits | 1 PAN letter | 1 entity code |
 *         'Z' | 1 checksum char.
 */

const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CODEPOINTS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MOD = CODEPOINTS.length; // 36

/** Compute the GSTIN check digit for the first 14 characters. */
export function gstinCheckDigit(first14: string): string {
  let factor = 2;
  let sum = 0;
  for (let i = first14.length - 1; i >= 0; i--) {
    const cp = CODEPOINTS.indexOf(first14[i]);
    if (cp < 0) return ""; // illegal char -> no valid check digit
    let digit = factor * cp;
    factor = factor === 2 ? 1 : 2;
    digit = Math.floor(digit / MOD) + (digit % MOD);
    sum += digit;
  }
  const checkCp = (MOD - (sum % MOD)) % MOD;
  return CODEPOINTS[checkCp];
}

export interface GstinResult {
  ok: boolean;
  reason?: string;
}

/** Validate a GSTIN string: normalizes case/spaces, checks format, then the checksum. */
export function validateGSTIN(raw: string | null | undefined): GstinResult {
  if (raw == null || raw.trim() === "") {
    return { ok: false, reason: "GSTIN is missing" };
  }
  const gstin = raw.replace(/\s/g, "").toUpperCase();

  if (gstin.length !== 15) {
    return { ok: false, reason: `GSTIN must be 15 characters (got ${gstin.length})` };
  }
  if (!GSTIN_FORMAT.test(gstin)) {
    return { ok: false, reason: "GSTIN format is invalid" };
  }
  const expected = gstinCheckDigit(gstin.slice(0, 14));
  if (expected !== gstin[14]) {
    return {
      ok: false,
      reason: `GSTIN checksum failed (expected '${expected}', got '${gstin[14]}')`,
    };
  }
  return { ok: true };
}

export function isValidGSTIN(raw: string | null | undefined): boolean {
  return validateGSTIN(raw).ok;
}
