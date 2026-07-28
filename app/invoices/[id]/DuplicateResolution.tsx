"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAsyncAction } from "@/app/_components/useAsyncAction";

/**
 * Resolves a duplicate candidate (D53) — exactly two outcomes, both a human decision, both
 * remembered. "Same document" removes the redundant record (there's nothing to fix, only
 * deleting is honest, D49). "Not a duplicate" records a dismissal for this specific pair, so
 * it never nags about this same match again — a genuinely persisted fact, since a human's
 * judgment isn't re-derivable from the invoice data the way the match itself is.
 */
export function DuplicateResolution({ invoiceId, matchId }: { invoiceId: string; matchId: string }) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const del = useAsyncAction();
  const dismiss = useAsyncAction();

  async function doDelete() {
    await del.run(async () => {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Delete failed");
      }
      router.push("/invoices");
    });
  }

  async function doDismiss() {
    await dismiss.run(async () => {
      const res = await fetch(`/api/invoices/${invoiceId}/dismiss-duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchedInvoiceId: matchId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Dismiss failed");
      }
      router.refresh();
    });
  }

  if (confirmingDelete) {
    return (
      <div className="mt-1 flex max-w-[240px] flex-col items-start gap-1.5 rounded-md border border-danger/40 bg-danger-bg px-2.5 py-2">
        <span className="text-[11px] text-danger">Delete permanently — this cannot be undone.</span>
        <span className="flex gap-2">
          <button
            onClick={doDelete}
            disabled={del.loading}
            className="rounded-md bg-danger px-2.5 py-1 text-xs font-medium text-danger-bg hover:opacity-90 disabled:opacity-40"
          >
            {del.loading ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted hover:bg-border/30"
          >
            Cancel
          </button>
        </span>
        {del.error && <span className="text-[11px] text-danger">{del.error}</span>}
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <button
        onClick={() => setConfirmingDelete(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger-bg px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
      >
        Yes, same document
      </button>
      <button
        onClick={doDismiss}
        disabled={dismiss.loading}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted hover:bg-border/30 disabled:opacity-40"
      >
        {dismiss.loading ? "…" : "Not a duplicate"}
      </button>
      {dismiss.error && <span className="text-[11px] text-danger">{dismiss.error}</span>}
    </div>
  );
}
