"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAsyncAction } from "@/app/_components/useAsyncAction";

/** Resolves a Tier-1 hard-duplicate stalemate (D48/D49) — a genuine duplicate has no field
 *  to correct, so the only real fix is removing the redundant record. Two-step confirm
 *  (not a native `confirm()` dialog) since this is destructive and irreversible. */
export function DeleteDuplicateButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const { loading, error, run } = useAsyncAction();

  async function doDelete() {
    await run(async () => {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Delete failed");
      }
      router.push("/invoices");
    });
  }

  if (!confirming) {
    return (
      <div className="mt-1">
        <button
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger-bg px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
        >
          Delete this upload
        </button>
        <p className="mt-1 max-w-[220px] text-[11px] text-muted">
          Same document as the invoice above — removes this redundant copy.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-1 flex max-w-[240px] flex-col items-start gap-1.5 rounded-md border border-danger/40 bg-danger-bg px-2.5 py-2">
      <span className="text-[11px] text-danger">Delete permanently — this cannot be undone.</span>
      <span className="flex gap-2">
        <button
          onClick={doDelete}
          disabled={loading}
          className="rounded-md bg-danger px-2.5 py-1 text-xs font-medium text-danger-bg hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted hover:bg-border/30"
        >
          Cancel
        </button>
      </span>
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </div>
  );
}
