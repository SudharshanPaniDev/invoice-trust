"use client";

import { useCallback, useState } from "react";

/**
 * Shared loading/error state for the fetch-then-handle-response pattern that was
 * independently hand-rolled in EditableField, MarkTrusted, and UploadForm (same three
 * useState calls, same try/catch shape, three times). The caller's action throws an
 * Error with the user-facing message on failure; success handling (refresh, redirect,
 * exit-edit-mode) stays local to each component, since that part is genuinely different
 * per call site.
 */
export function useAsyncAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, run };
}
