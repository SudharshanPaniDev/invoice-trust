"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface UploadResponse {
  id: string;
  status: string;
}

/** On success, redirect straight to the detail page (D32) — that's the one place a scored
 *  invoice is actually viewable (editing, provenance, trust gate), so there's no second,
 *  weaker read-only view to keep in sync here. */
export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/invoices", { method: "POST", body: fd });
    const json = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(json.error ?? "Upload failed");
      return;
    }
    router.push(`/invoices/${(json as UploadResponse).id}`);
  }

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
    </>
  );
}
