"use client";

import { useState } from "react";
import Link from "next/link";
import type { ScoredInvoice } from "@/lib/validation/confidence";
import { ScoredFields, TrustBanner } from "./ScoredFields";

interface UploadResponse {
  id: string;
  status: string;
  scored: ScoredInvoice;
}

export function UploadForm() {
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
    <>
      <form
        onSubmit={onSubmit}
        className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="flex-1 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-border/50"
        />
        <button
          type="submit"
          disabled={!file || loading}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Extracting…" : "Extract"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg border border-danger/30 bg-danger-bg p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {scored && (
        <section className="mt-10">
          <div className="mb-5">
            <TrustBanner
              canTrust={scored.overall.canTrust}
              openFlags={scored.overall.openFlags}
              confidence={scored.overall.confidence}
            />
            <p className="mt-2 text-xs text-muted">
              Stored <code className="rounded bg-background px-1 py-0.5">{result!.id}</code> ·{" "}
              <Link
                href={`/invoices/${result!.id}`}
                className="text-accent hover:text-accent-hover hover:underline"
              >
                open detail →
              </Link>
            </p>
          </div>
          <ScoredFields fields={scored.fields} />
        </section>
      )}
    </>
  );
}
