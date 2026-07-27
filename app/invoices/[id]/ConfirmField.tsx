"use client";

import { useRouter } from "next/navigation";
import { useAsyncAction } from "@/app/_components/useAsyncAction";

/** Affirms a field's current value is correct without editing it (D48) — for a field no
 *  rule can check, this is real (if weaker) evidence than an unchecked model guess, so it
 *  earns 85% instead of staying at the damped model estimate. */
export function ConfirmField({ invoiceId, fieldKey }: { invoiceId: string; fieldKey: string }) {
  const router = useRouter();
  const { loading, error, run } = useAsyncAction();

  async function confirm() {
    await run(async () => {
      const res = await fetch(`/api/invoices/${invoiceId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: fieldKey }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Confirm failed");
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={confirm}
        disabled={loading}
        title="No rule can check this field — confirm the value is correct as-is"
        className="text-xs text-accent hover:underline disabled:opacity-40"
      >
        {loading ? "…" : "confirm"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
