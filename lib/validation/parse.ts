/**
 * Coerce the messy string values Gemini returns (grounded in the real fixture:
 * "INR 11,210.00", "5,000.00", "18%") into numbers/dates/rates. Every parser returns
 * null on failure rather than throwing — a value that won't parse becomes a
 * low-confidence flag downstream (D2), never a crash.
 */

/** Common currency symbols/entities the model may return instead of an ISO code. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  "₹": "INR",
  "&#8377;": "INR",
  "rs": "INR",
  "rs.": "INR",
  "$": "USD",
  "us$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
};

/**
 * Normalize a currency value to its ISO 4217 code. Real invoices (e.g. a Jio phone bill)
 * often render the symbol "₹" rather than the code "INR" — real data surfaced this gap
 * that synthetic fixtures didn't (D11). Returns the input uppercased if it's not a known
 * symbol, so an already-correct ISO code passes through unchanged.
 */
export function normalizeCurrency(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase();
  if (s === "") return null;
  return CURRENCY_SYMBOLS[s] ?? raw.trim().toUpperCase();
}

/**
 * Parse a monetary/quantity amount. Strips currency words/symbols and thousands
 * separators; keeps sign and decimal point. "INR 11,210.00" -> 11210, "5,000.00" -> 5000,
 * "₹9,500.00" -> 9500, "(1,200.50)" -> -1200.5 (accounting negative).
 */
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (s === "") return null;

  // Accounting negatives: (1,200) -> -1,200
  const negative = /^\(.*\)$/.test(s) || s.includes("-");
  s = s.replace(/[()]/g, "");

  // Drop everything except digits and separators.
  s = s.replace(/[^0-9.,]/g, "");
  if (s === "") return null;

  // Remove thousands separators (both "," and Indian grouping); keep the last "." as decimal.
  s = s.replace(/,/g, "");

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/**
 * Parse a tax rate into a FRACTION (0.18). Handles "18%" -> 0.18, "18" -> 0.18
 * (bare number > 1 assumed to be a percent), "0.18" -> 0.18.
 */
export function parseRate(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const hadPercent = raw.includes("%");
  const n = parseAmount(raw);
  if (n == null) return null;
  if (hadPercent) return n / 100;
  return n > 1 ? n / 100 : n;
}

export interface ParsedDate {
  date: Date;
  iso: string; // YYYY-MM-DD
}

/**
 * Parse a date leniently. Accepts ISO ("2026-07-15"), slash/dot formats
 * ("15/07/2026", "15.07.2026"), and anything Date can read ("Jul 15, 2026").
 * Ambiguous DD/MM vs MM/DD is resolved as DD/MM when the first part > 12
 * (invoices in this project are Indian — see the GSTIN focus).
 */
export function parseDate(raw: string | null | undefined): ParsedDate | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (s === "") return null;

  // ISO fast path
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return build(+iso[1], +iso[2], +iso[3]);

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    let d = +dmy[1];
    let m = +dmy[2];
    if (d <= 12 && m > 12) [d, m] = [m, d]; // looks like MM/DD, swap
    return build(+dmy[3], m, d);
  }

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return build(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth() + 1,
    parsed.getUTCDate(),
  );
}

function build(y: number, m: number, d: number): ParsedDate | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject overflow (e.g. Feb 31 -> Mar 3)
  if (date.getUTCMonth() + 1 !== m || date.getUTCDate() !== d) return null;
  const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { date, iso };
}
