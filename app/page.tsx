"use client";

import { useState } from "react";
import Link from "next/link";
import type { ScoredInvoice } from "@/lib/validation/confidence";
import { ScoredFields, TrustBanner } from "./_components/ScoredFields";

interface UploadResponse {
  id: string;
  status: string;
  scored: ScoredInvoice;
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

  return (
    <main className="mx-auto max-w-4xl p-8 font-sans">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Invoice Trust Layer</h1>
        <Link href="/invoices" className="text-sm text-blue-600 hover:underline">
          All invoices →
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Upload an invoice — each field&apos;s confidence is earned by validation (sums, tax
        math, GSTIN checksum), not claimed by the model.
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
          <div className="mb-5">
            <TrustBanner
              canTrust={scored.overall.canTrust}
              openFlags={scored.overall.openFlags}
              confidence={scored.overall.confidence}
            />
            <p className="mt-2 text-xs text-gray-500">
              Stored <code>{result!.id}</code> ·{" "}
              <Link href={`/invoices/${result!.id}`} className="text-blue-600 hover:underline">
                open detail →
              </Link>
            </p>
          </div>
          <ScoredFields fields={scored.fields} />
        </section>
      )}
    </main>
  );
}
