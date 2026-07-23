"use client";

import { useState } from "react";
import type { ScoredInvoice, ScoredField } from "@/lib/validation/confidence";

interface UploadResponse {
  id: string;
  status: string;
  scored: ScoredInvoice;
}

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

function confColor(c: number): string {
  if (c >= 0.8) return "text-green-700 bg-green-50";
  if (c >= 0.5) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}

function Confidence({ f }: { f: ScoredField | undefined }) {
  if (!f) return <span className="text-gray-300">—</span>;
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${confColor(f.confidence)}`}>
      {Math.round(f.confidence * 100)}%
      {f.verified ? " ✓" : ""}
    </span>
  );
}

function FieldRow({ label, f }: { label: string; f: ScoredField | undefined }) {
  return (
    <tr className="border-b align-top">
      <td className="py-1.5 pr-4 text-gray-500">{label}</td>
      <td className="py-1.5 pr-4 font-medium">{f?.value ?? "—"}</td>
      <td className="py-1.5 pr-4">
        <Confidence f={f} />
      </td>
      <td className="py-1.5 text-xs text-red-700">
        {f?.flags.map((flag, i) => <div key={i}>⚠ {flag}</div>)}
      </td>
    </tr>
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/invoices", { method: "POST", body: fd });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? "Upload failed");
      return;
    }
    setResult(json as UploadResponse);
  }

  const scored = result?.scored;
  const lineCount = scored
    ? Object.keys(scored.fields).filter((k) => k.startsWith("lineItems.")).reduce((max, k) => {
        const i = Number(k.split(".")[1]);
        return Number.isFinite(i) ? Math.max(max, i + 1) : max;
      }, 0)
    : 0;

  return (
    <main className="mx-auto max-w-4xl p-8 font-sans">
      <h1 className="text-2xl font-semibold">Invoice Trust Layer</h1>
      <p className="mt-1 text-sm text-gray-500">
        Upload an invoice — extracted, then each field&apos;s confidence is earned by
        validation (sums, tax math, GSTIN checksum), not claimed by the model.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex items-center gap-3">
        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={!file || loading}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {loading ? "Extracting…" : "Extract"}
        </button>
      </form>

      {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {scored && (
        <section className="mt-8">
          <div
            className={`mb-5 rounded p-3 text-sm ${
              scored.overall.canTrust ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"
            }`}
          >
            {scored.overall.canTrust
              ? "✓ All checks passed — safe to mark trusted."
              : `⚠ ${scored.overall.openFlags} open flag(s) — cannot mark trusted yet.`}
            <span className="ml-2 text-gray-500">
              overall {Math.round(scored.overall.confidence * 100)}% · stored{" "}
              <code>{result!.id}</code> · {result!.status}
            </span>
          </div>

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
              {FIELDS.map(([key, label]) => (
                <FieldRow key={key} label={label} f={scored.fields[key]} />
              ))}
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
                    const g = (f: string) => scored.fields[`lineItems.${i}.${f}`];
                    const flags = ["description", "quantity", "unitPrice", "lineAmount"]
                      .flatMap((f) => g(f)?.flags ?? []);
                    return (
                      <tr key={i} className="border-b align-top">
                        <td className="py-1.5 pr-4 text-gray-400">{i + 1}</td>
                        <td className="py-1.5 pr-4">{g("description")?.value ?? "—"}</td>
                        <td className="py-1.5 pr-4">{g("quantity")?.value ?? "—"}</td>
                        <td className="py-1.5 pr-4">{g("unitPrice")?.value ?? "—"}</td>
                        <td className="py-1.5 pr-4">{g("lineAmount")?.value ?? "—"}</td>
                        <td className="py-1.5 text-xs text-red-700">
                          {[...new Set(flags)].map((flag, k) => <div key={k}>⚠ {flag}</div>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}
    </main>
  );
}
