"use client";

import { useState } from "react";
import type { RawInvoice, RawField } from "@/lib/schema";

interface UploadResponse {
  id: string;
  status: string;
  data: RawInvoice;
}

const FIELDS: [keyof RawInvoice, string][] = [
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

function val(f: RawField | undefined): string {
  return f?.value ?? "—";
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

  return (
    <main className="mx-auto max-w-3xl p-8 font-sans">
      <h1 className="text-2xl font-semibold">Invoice Trust Layer</h1>
      <p className="mt-1 text-sm text-gray-500">
        Upload an invoice (PDF or image) — thin end-to-end slice: upload → Gemini → store → show.
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

      {error && (
        <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {result && (
        <section className="mt-8">
          <div className="mb-4 text-sm text-gray-500">
            Stored invoice <code>{result.id}</code> · status:{" "}
            <span className="font-medium">{result.status}</span>
          </div>

          <table className="w-full border-collapse text-sm">
            <tbody>
              {FIELDS.map(([key, label]) => (
                <tr key={key} className="border-b">
                  <td className="py-1.5 pr-4 text-gray-500">{label}</td>
                  <td className="py-1.5 font-medium">
                    {val(result.data[key] as RawField | undefined)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="mt-6 mb-2 text-sm font-semibold">Line items</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-1.5 pr-4 font-normal">Description</th>
                <th className="py-1.5 pr-4 font-normal">Qty</th>
                <th className="py-1.5 pr-4 font-normal">Unit Price</th>
                <th className="py-1.5 font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {result.data.lineItems.map((li, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1.5 pr-4">{val(li.description)}</td>
                  <td className="py-1.5 pr-4">{val(li.quantity)}</td>
                  <td className="py-1.5 pr-4">{val(li.unitPrice)}</td>
                  <td className="py-1.5">{val(li.lineAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
