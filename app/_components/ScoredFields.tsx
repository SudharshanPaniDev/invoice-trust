import type { ScoredField } from "@/lib/validation/confidence";
import { EditableField } from "../invoices/[id]/EditableField";
import { Tooltip } from "./Tooltip";

const FIELDS: [string, string][] = [
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
const LINE_KEYS = ["description", "quantity", "unitPrice", "lineAmount"];

function confColor(c: number): string {
  if (c >= 0.8) return "text-success bg-success-bg";
  if (c >= 0.5) return "text-warning bg-warning-bg";
  return "text-danger bg-danger-bg";
}

/** Explains *why* this field landed at its confidence tier — the ceiling is deliberate
 *  (D13/D35), never 100%, but nothing on the badge itself says so without this. */
function confidenceTitle(f: ScoredField): string {
  if (f.flags.length > 0) return f.flags.join(" · ");
  if (f.corrected) {
    return "Human-corrected — no rule can verify this field further; 95% is this system's ceiling for unverifiable fields, not partial trust.";
  }
  if (f.verified) {
    return "Verified by a rule (arithmetic, checksum, date order, or currency check); 90% is this system's ceiling even when a check passes.";
  }
  return "No rule can check this field — this is a damped model estimate, not a validated result.";
}

function Confidence({ f }: { f: ScoredField | undefined }) {
  if (!f) return <span className="text-muted">—</span>;
  const low = f.confidence < 0.5;
  return (
    <Tooltip content={confidenceTitle(f)}>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium ${confColor(f.confidence)}`}
      >
        {low && <span aria-hidden="true">⚠</span>}
        {Math.round(f.confidence * 100)}%{f.verified ? " ✓" : ""}
      </span>
    </Tooltip>
  );
}

/** A flag's full arithmetic/reason text can run long (e.g. "Subtotal 15000.00 + tax
 *  2700.00 = 17700.00, but total says 17000.00") — showing that inline breaks the table's
 *  row rhythm. `<details>` keeps the row compact (one truncated line) and reveals the full
 *  text on click, natively keyboard- and touch-accessible (no JS, no tooltip-only text). */
function FlagDisclosure({ flag }: { flag: string }) {
  return (
    <details className="cursor-pointer">
      <summary className="max-w-[220px] truncate marker:content-none [&::-webkit-details-marker]:hidden">
        ⚠ {flag}
      </summary>
      <p className="mt-1 max-w-[260px] whitespace-normal text-danger">{flag}</p>
    </details>
  );
}

function Value({
  editInvoiceId,
  fieldKey,
  f,
}: {
  editInvoiceId?: string;
  fieldKey: string;
  f: ScoredField | undefined;
}) {
  const corrected = f?.corrected ? (
    <span className="ml-1 rounded-full bg-border/40 px-1.5 py-0.5 text-[10px] font-medium text-muted">
      edited
    </span>
  ) : null;
  if (editInvoiceId) {
    return (
      <>
        <EditableField invoiceId={editInvoiceId} fieldKey={fieldKey} value={f?.value ?? null} />
        {corrected}
      </>
    );
  }
  return (
    <span className="font-medium">
      {f?.value ?? "—"}
      {corrected}
    </span>
  );
}

export function ScoredFields({
  fields,
  editInvoiceId,
  selectedField,
  onSelectField,
}: {
  fields: Record<string, ScoredField>;
  editInvoiceId?: string;
  /** Currently-highlighted field key (for the provenance viewer). */
  selectedField?: string | null;
  /** Called when a field is clicked, to highlight its source in the document viewer. */
  onSelectField?: (key: string) => void;
}) {
  const lineCount = Object.keys(fields)
    .filter((k) => k.startsWith("lineItems."))
    .reduce((max, k) => Math.max(max, Number(k.split(".")[1]) + 1 || 0), 0);

  return (
    <>
      <p className="mb-2 text-xs text-muted">
        Confidence caps at 90% (rule-verified) or 95% (human-verified) — hover a badge for
        why. This system never claims 100%, only what's actually been checked.
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="py-1.5 pr-4 font-normal">Field</th>
            <th className="py-1.5 pr-4 font-normal">Value</th>
            <th className="py-1.5 pr-4 font-normal">Confidence</th>
            <th className="py-1.5 font-normal">Flags</th>
          </tr>
        </thead>
        <tbody>
          {FIELDS.map(([key, label]) => {
            const f = fields[key];
            const hasSource = onSelectField && f?.bbox;
            return (
              <tr
                key={key}
                onClick={hasSource ? () => onSelectField(key) : undefined}
                className={`border-b border-border align-top ${hasSource ? "cursor-pointer hover:bg-surface" : ""} ${
                  selectedField === key ? "bg-accent/10" : ""
                }`}
              >
                <td className="py-1.5 pr-4 text-muted">{label}</td>
                <td className="py-1.5 pr-4">
                  <Value editInvoiceId={editInvoiceId} fieldKey={key} f={f} />
                </td>
                <td className="py-1.5 pr-4"><Confidence f={f} /></td>
                <td className="py-1.5 text-xs text-danger">
                  {f?.flags.map((flag, i) => <FlagDisclosure key={i} flag={flag} />)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {lineCount > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-sm font-semibold">Line items</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-1.5 pr-4 font-normal">#</th>
                <th className="py-1.5 pr-4 font-normal">Description</th>
                <th className="py-1.5 pr-4 font-normal">Qty</th>
                <th className="py-1.5 pr-4 font-normal">Unit</th>
                <th className="py-1.5 pr-4 font-normal">Amount</th>
                <th className="py-1.5 font-normal">Flags</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: lineCount }, (_, i) => {
                const g = (f: string) => fields[`lineItems.${i}.${f}`];
                const flags = [...new Set(LINE_KEYS.flatMap((f) => g(f)?.flags ?? []))];
                return (
                  <tr key={i} className="border-b border-border align-top">
                    <td className="py-1.5 pr-4 text-muted">{i + 1}</td>
                    {LINE_KEYS.map((col) => {
                      const cellKey = `lineItems.${i}.${col}`;
                      const cellField = g(col);
                      const hasSource = onSelectField && cellField?.bbox;
                      return (
                        <td
                          key={col}
                          onClick={hasSource ? () => onSelectField(cellKey) : undefined}
                          className={`py-1.5 pr-4 ${hasSource ? "cursor-pointer hover:bg-surface" : ""} ${
                            selectedField === cellKey ? "bg-accent/10" : ""
                          }`}
                        >
                          <Value editInvoiceId={editInvoiceId} fieldKey={cellKey} f={cellField} />
                        </td>
                      );
                    })}
                    <td className="py-1.5 text-xs text-danger">
                      {flags.map((flag, k) => <FlagDisclosure key={k} flag={flag} />)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
