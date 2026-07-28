import type { RawInvoice, RawField } from "../schema";
import { runRules, type RuleResult } from "./rules";
import type { MatchReason } from "../duplicate";

/**
 * Turn raw extraction + rule results into per-field EARNED confidence (D13):
 * rules dominate the model signal — a failed rule floors the field, corroboration lifts it,
 * and a field no rule can check falls back to a damped model score (never "high").
 */

export type FieldStatus = "high" | "medium" | "low";

export interface ScoredField {
  value: string | null;
  modelConfidence: number | null;
  confidence: number; // earned, 0..1
  bbox?: RawField["bbox"];
  sourceText?: string | null;
  verified: boolean; // corroborated by a passing rule, a human correction, or a human confirmation
  corrected?: boolean; // value was set by a human (D17)
  /** Value was left as-is, but a human explicitly affirmed it's correct (D48) — weaker
   *  evidence than a passing rule or an actual correction, so it earns less (0.85, not
   *  0.9/0.95). Mutually exclusive with `corrected` in practice: a field that was actually
   *  edited is `corrected`, not `confirmed`. */
  confirmed?: boolean;
  flags: string[];
  /** A live, cross-invoice duplicate candidate (D53) — structured, not just text inside
   *  `flags`, so the UI can wire up "same document" (delete) and "not a duplicate" (dismiss)
   *  without parsing a message string. Always accompanied by a `flags` entry too (a
   *  duplicate candidate always blocks trust until a human resolves it — one tier, not two). */
  duplicate?: { matchId: string; reason: MatchReason };
}

export interface ScoredInvoice {
  isInvoice: boolean;
  fields: Record<string, ScoredField>;
  overall: {
    confidence: number; // average across scored fields
    status: FieldStatus;
    canTrust: boolean; // no open flags and all required present (Phase 4 gate)
    openFlags: number;
  };
  rules: RuleResult[];
}

const REQUIRED_KEYS = new Set(["vendorName", "invoiceNo", "invoiceDate", "total"]);
const INVOICE_KEYS: (keyof RawInvoice)[] = [
  "vendorName", "vendorGSTIN", "invoiceNo", "invoiceDate", "dueDate",
  "currency", "subtotal", "taxRate", "taxAmount", "total",
];
const LINE_KEYS = ["description", "quantity", "unitPrice", "lineAmount"] as const;

function bucket(confidence: number): FieldStatus {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

function scoreField(
  key: string,
  field: RawField | undefined,
  rulesForField: RuleResult[],
  required: boolean,
  corrected: boolean,
  confirmed: boolean,
): ScoredField {
  const value = field?.value ?? null;
  const modelConfidence = field?.modelConfidence ?? null;
  const failed = rulesForField.filter((r) => r.status === "fail");
  // Only SUBSTANTIVE rules corroborate. A required-presence check passing means the field
  // exists, not that its value is correct — presence must not earn "high" (D13).
  const passedVerify = rulesForField.filter(
    (r) => r.status === "pass" && !r.id.startsWith("required."),
  );

  let confidence: number;
  let verified = false;
  let confirmedApplied = false;
  const flags: string[] = [];

  if (value == null && required) {
    confidence = 0;
    flags.push(...(failed.length ? failed.map((r) => r.message) : ["Required field is missing"]));
  } else if (failed.length > 0) {
    // A failed verifiable rule floors the field — even a human correction can't override
    // arithmetic/checksum (D17): fix it wrongly and it still flags.
    confidence = 0.3;
    flags.push(...failed.map((r) => r.message));
  } else if (passedVerify.length > 0) {
    // Corroborated by arithmetic/checksum/currency/date — earned high.
    confidence = 0.9;
    verified = true;
  } else if (corrected) {
    // No rule can check it, but a human explicitly set the value — human-verified (D17).
    confidence = 0.95;
    verified = true;
  } else if (confirmed) {
    // No rule can check it, and the value wasn't changed — but a human explicitly affirmed
    // it's correct (D48). Real evidence, so it beats an unchecked model guess, but weaker
    // than a passing rule or an actual correction, so it never reaches 90/95. Only reachable
    // here (failed/passedVerify/corrected all false), so a stray `confirmed` flag on an
    // otherwise rule-verified or corrected field is never misreported as "human-confirmed".
    confidence = 0.85;
    verified = true;
    confirmedApplied = true;
  } else {
    // Nothing could verify it: damped model signal, capped at medium (unverified).
    confidence = Math.min(0.7, (modelConfidence ?? 0.5) * 0.7);
  }

  return {
    value,
    modelConfidence,
    confidence,
    bbox: field?.bbox,
    sourceText: field?.sourceText,
    verified,
    ...(corrected ? { corrected: true } : {}),
    ...(confirmedApplied ? { confirmed: true } : {}),
    flags,
  };
}

export function scoreInvoice(
  inv: RawInvoice,
  correctedKeys: ReadonlySet<string> = new Set(),
  confirmedKeys: ReadonlySet<string> = new Set(),
): ScoredInvoice {
  const rules = runRules(inv);
  const rulesFor = (key: string) => rules.filter((r) => r.fields.includes(key));
  const fields: Record<string, ScoredField> = {};

  for (const key of INVOICE_KEYS) {
    const field = inv[key] as RawField | undefined;
    const required = REQUIRED_KEYS.has(key);
    if (field?.value == null && !required) continue; // skip absent optional fields
    fields[key] = scoreField(
      key, field, rulesFor(key), required, correctedKeys.has(key), confirmedKeys.has(key),
    );
  }

  inv.lineItems.forEach((li, i) => {
    for (const lk of LINE_KEYS) {
      const key = `lineItems.${i}.${lk}`;
      const field = li[lk];
      if (field?.value == null) continue;
      fields[key] = scoreField(
        key, field, rulesFor(key), false, correctedKeys.has(key), confirmedKeys.has(key),
      );
    }
  });

  const scored = Object.values(fields);
  const openFlags = scored.reduce((n, f) => n + f.flags.length, 0);
  const avg = scored.length
    ? scored.reduce((s, f) => s + f.confidence, 0) / scored.length
    : 0;
  const requiredPresent = [...REQUIRED_KEYS].every(
    (k) => (inv[k as keyof RawInvoice] as RawField | undefined)?.value != null,
  );

  return {
    isInvoice: inv.isInvoice,
    fields,
    overall: {
      confidence: avg,
      status: bucket(avg),
      canTrust: openFlags === 0 && requiredPresent && inv.isInvoice,
      openFlags,
    },
    rules,
  };
}
