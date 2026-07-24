"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkTrusted({
  id,
  canTrust,
  openFlags,
}: {
  id: string;
  canTrust: boolean;
  openFlags: number;
}) {
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
        className="rounded-md bg-success px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success disabled:cursor-not-allowed disabled:bg-border disabled:text-muted"
      >
        {loading ? "Marking…" : "Mark trusted"}
      </button>
      {!canTrust && (
        <p className="mt-2 text-xs text-muted">
          Resolve {openFlags} open flag{openFlags === 1 ? "" : "s"} to enable.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
