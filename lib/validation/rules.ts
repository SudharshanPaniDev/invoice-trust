import type { RawInvoice } from "../schema";
import { parseAmount, parseRate, parseDate, normalizeCurrency } from "./parse";
import { validateGSTIN } from "./gstin";

/**
 * Verifiable business rules (D2). Each returns a result naming the fields it bears on, so
 * the confidence engine (D13) can floor those fields and attach the reason on failure.
 * status "na" means the rule couldn't run (inputs missing/unparseable) — not a pass.
 */
export type RuleStatus = "pass" | "fail" | "na";

export interface RuleResult {
  id: string;
  status: RuleStatus;
  message: string;
  /** Field keys this rule bears on. Invoice fields by name; line items as "lineItems.<i>.<field>". */
  fields: string[];
}

const MONEY_TOL = 0.02;
const KNOWN_CURRENCIES = new Set([
  "INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY", "AED", "CHF",
]);
const REQUIRED: [keyof RawInvoice, string][] = [
  ["vendorName", "Vendor name"],
  ["invoiceNo", "Invoice number"],
  ["invoiceDate", "Invoice date"],
  ["total", "Total"],
];

const approx = (a: number, b: number, tol = MONEY_TOL) =>
  Math.abs(a - b) <= tol + 1e-9;
const money = (n: number) => n.toFixed(2);
const fieldVal = (inv: RawInvoice, k: keyof RawInvoice) => {
  const f = inv[k];
  return f && typeof f === "object" && "value" in f ? (f.value ?? null) : null;
};

export function runRules(inv: RawInvoice): RuleResult[] {
  const out: RuleResult[] = [];

  // 1. Required fields present
  for (const [key, label] of REQUIRED) {
    const present = fieldVal(inv, key) != null;
    out.push({
      id: `required.${key}`,
      status: present ? "pass" : "fail",
      message: present ? `${label} present` : `${label} is missing`,
      fields: [key],
    });
  }

  // 2. Currency in a known set (symbols like "₹" are normalized to their ISO code first)
  const curRaw = fieldVal(inv, "currency");
  const cur = normalizeCurrency(curRaw);
  out.push(
    cur == null
      ? { id: "currency.known", status: "na", message: "No currency to check", fields: ["currency"] }
      : {
          id: "currency.known",
          status: KNOWN_CURRENCIES.has(cur) ? "pass" : "fail",
          message: KNOWN_CURRENCIES.has(cur)
            ? `Currency ${curRaw} recognized (${cur})`
            : `Unrecognized currency "${curRaw}"`,
          fields: ["currency"],
        },
  );

  // 3. GSTIN format + checksum
  const gstinRaw = fieldVal(inv, "vendorGSTIN");
  if (gstinRaw == null) {
    out.push({ id: "gstin", status: "na", message: "No GSTIN to check", fields: ["vendorGSTIN"] });
  } else {
    const r = validateGSTIN(gstinRaw);
    out.push({
      id: "gstin",
      status: r.ok ? "pass" : "fail",
      message: r.ok ? "GSTIN format and checksum valid" : r.reason ?? "GSTIN invalid",
      fields: ["vendorGSTIN"],
    });
  }

  // 4. subtotal + taxAmount == total
  {
    const s = parseAmount(fieldVal(inv, "subtotal"));
    const t = parseAmount(fieldVal(inv, "taxAmount"));
    const tot = parseAmount(fieldVal(inv, "total"));
    const fields = ["subtotal", "taxAmount", "total"];
    if (s == null || t == null || tot == null) {
      out.push({ id: "total.sum", status: "na", message: "Missing subtotal/tax/total", fields });
    } else {
      const ok = approx(s + t, tot);
      out.push({
        id: "total.sum",
        status: ok ? "pass" : "fail",
        message: ok
          ? `Subtotal + tax = total (${money(tot)})`
          : `Subtotal ${money(s)} + tax ${money(t)} = ${money(s + t)}, but total says ${money(tot)}`,
        fields,
      });
    }
  }

  // 5. taxAmount ~= subtotal * taxRate
  {
    const s = parseAmount(fieldVal(inv, "subtotal"));
    const rate = parseRate(fieldVal(inv, "taxRate"));
    const t = parseAmount(fieldVal(inv, "taxAmount"));
    const fields = ["subtotal", "taxRate", "taxAmount"];
    if (s == null || rate == null || t == null) {
      out.push({ id: "tax.rate", status: "na", message: "Missing subtotal/rate/tax", fields });
    } else {
      const expected = s * rate;
      const ok = approx(expected, t, Math.max(MONEY_TOL, Math.abs(expected) * 0.01));
      out.push({
        id: "tax.rate",
        status: ok ? "pass" : "fail",
        message: ok
          ? `Tax matches ${(rate * 100).toFixed(2)}% of subtotal`
          : `${(rate * 100).toFixed(2)}% of ${money(s)} = ${money(expected)}, but tax says ${money(t)}`,
        fields,
      });
    }
  }

  // 6. Line items sum to subtotal
  {
    const s = parseAmount(fieldVal(inv, "subtotal"));
    const amounts = inv.lineItems.map((li) => parseAmount(li.lineAmount?.value));
    const fields = ["subtotal", ...inv.lineItems.map((_, i) => `lineItems.${i}.lineAmount`)];
    if (s == null || inv.lineItems.length === 0 || amounts.some((a) => a == null)) {
      out.push({ id: "lineitems.sum", status: "na", message: "Missing subtotal or line amounts", fields });
    } else {
      const sum = amounts.reduce<number>((acc, a) => acc + (a as number), 0);
      const ok = approx(sum, s);
      out.push({
        id: "lineitems.sum",
        status: ok ? "pass" : "fail",
        message: ok
          ? `Line items sum to subtotal (${money(s)})`
          : `Line items sum to ${money(sum)}, but subtotal says ${money(s)}`,
        fields,
      });
    }
  }

  // 7. Per line: qty * unitPrice == lineAmount
  inv.lineItems.forEach((li, i) => {
    const q = parseAmount(li.quantity?.value);
    const u = parseAmount(li.unitPrice?.value);
    const a = parseAmount(li.lineAmount?.value);
    const fields = [`lineItems.${i}.quantity`, `lineItems.${i}.unitPrice`, `lineItems.${i}.lineAmount`];
    if (q == null || u == null || a == null) {
      out.push({ id: `lineitem.${i}.math`, status: "na", message: `Line ${i + 1}: missing qty/price/amount`, fields });
    } else {
      const ok = approx(q * u, a);
      out.push({
        id: `lineitem.${i}.math`,
        status: ok ? "pass" : "fail",
        message: ok
          ? `Line ${i + 1}: qty × price = amount`
          : `Line ${i + 1}: ${money(q)} × ${money(u)} = ${money(q * u)}, but amount says ${money(a)}`,
        fields,
      });
    }
  });

  // 8. Dates parse; dueDate >= invoiceDate
  {
    const inv0 = parseDate(fieldVal(inv, "invoiceDate"));
    const due = parseDate(fieldVal(inv, "dueDate"));
    if (fieldVal(inv, "invoiceDate") != null && inv0 == null) {
      out.push({ id: "date.invoice", status: "fail", message: "Invoice date is unparseable", fields: ["invoiceDate"] });
    }
    if (fieldVal(inv, "dueDate") != null && due == null) {
      out.push({ id: "date.due", status: "fail", message: "Due date is unparseable", fields: ["dueDate"] });
    }
    if (inv0 && due) {
      const ok = due.date.getTime() >= inv0.date.getTime();
      out.push({
        id: "date.order",
        status: ok ? "pass" : "fail",
        message: ok ? "Due date is on/after invoice date" : `Due date ${due.iso} is before invoice date ${inv0.iso}`,
        fields: ["invoiceDate", "dueDate"],
      });
    }
  }

  return out;
}
