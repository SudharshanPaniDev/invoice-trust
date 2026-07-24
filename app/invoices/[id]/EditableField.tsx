"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Inline-editable field value. Saving PATCHes the invoice, which re-validates the whole
 *  thing (D17); router.refresh() then re-renders confidence/flags and the trust gate. */
export function EditableField({
  invoiceId,
  fieldKey,
  value,
}: {
  invoiceId: string;
  fieldKey: string;
  value: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: fieldKey, value: draft }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Save failed");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <span className="group inline-flex items-center gap-2">
        <span className="font-medium">{value ?? "—"}</span>
        <button
          onClick={() => { setDraft(value ?? ""); setEditing(true); }}
          className="text-xs text-accent opacity-0 group-hover:opacity-100 hover:underline"
        >
          edit
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="rounded-md border border-border bg-background px-1.5 py-0.5 text-sm"
      />
      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
      >
        {saving ? "…" : "save"}
      </button>
      <button onClick={() => setEditing(false)} className="text-xs text-muted hover:underline">
        cancel
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
