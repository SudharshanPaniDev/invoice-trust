"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkTrusted({ id, canTrust }: { id: string; canTrust: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/invoices/${id}/trust`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Could not mark trusted");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={onClick}
        disabled={!canTrust || loading}
        title={canTrust ? "" : "Resolve all open flags first"}
        className="rounded bg-green-700 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Marking…" : "Mark trusted"}
      </button>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
