import type { ScoredField } from "@/lib/validation/confidence";
import { EditableField } from "../invoices/[id]/EditableField";

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
  if (c >= 0.8) return "text-green-700 bg-green-50";
  if (c >= 0.5) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}

function Confidence({ f }: { f: ScoredField | undefined }) {
  if (!f) return <span className="text-gray-300">—</span>;
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${confColor(f.confidence)}`}>
      {Math.round(f.confidence * 100)}%{f.verified ? " ✓" : ""}
    </span>
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
    <span className="ml-1 rounded bg-blue-50 px-1 text-[10px] text-blue-700">edited</span>
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
}: {
  fields: Record<string, ScoredField>;
  editInvoiceId?: string;
}) {
  const lineCount = Object.keys(fields)
    .filter((k) => k.startsWith("lineItems."))
    .reduce((max, k) => Math.max(max, Number(k.split(".")[1]) + 1 || 0), 0);

  return (
    <>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-1.5 pr-4 font-normal">Field</th>
            <th className="py-1.5 pr-4 font-normal">Value</th>
            <th className="py-1.5 pr-4 font-normal">Confidence</th>
            <th className="py-1.5 font-normal">Flags</th>
          </tr>
        </thead>
        <tbody>
          {FIELDS.map(([key, label]) => {
            const f = fields[key];
            return (
              <tr key={key} className="border-b align-top">
                <td className="py-1.5 pr-4 text-gray-500">{label}</td>
                <td className="py-1.5 pr-4">
                  <Value editInvoiceId={editInvoiceId} fieldKey={key} f={f} />
                </td>
                <td className="py-1.5 pr-4"><Confidence f={f} /></td>
                <td className="py-1.5 text-xs text-red-700">
                  {f?.flags.map((flag, i) => <div key={i}>⚠ {flag}</div>)}
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
              <tr className="border-b text-left text-gray-500">
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
                  <tr key={i} className="border-b align-top">
                    <td className="py-1.5 pr-4 text-gray-400">{i + 1}</td>
                    {LINE_KEYS.map((col) => (
                      <td key={col} className="py-1.5 pr-4">
                        <Value editInvoiceId={editInvoiceId} fieldKey={`lineItems.${i}.${col}`} f={g(col)} />
                      </td>
                    ))}
                    <td className="py-1.5 text-xs text-red-700">
                      {flags.map((flag, k) => <div key={k}>⚠ {flag}</div>)}
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

export function TrustBanner({
  canTrust,
  openFlags,
  confidence,
}: {
  canTrust: boolean;
  openFlags: number;
  confidence?: number;
}) {
  return (
    <div
      className={`rounded p-3 text-sm ${
        canTrust ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"
      }`}
    >
      {canTrust
        ? "✓ All checks passed — safe to mark trusted."
        : `⚠ ${openFlags} open flag(s) — cannot mark trusted yet.`}
      {confidence != null && (
        <span className="ml-2 text-gray-500">overall {Math.round(confidence * 100)}%</span>
      )}
    </div>
  );
}
