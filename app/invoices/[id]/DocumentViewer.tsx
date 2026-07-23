"use client";

import { useEffect, useRef, useState } from "react";
import type { BBox } from "@/lib/schema";

/**
 * Renders the source PDF (page 1) to a canvas and overlays a highlight box for the
 * currently-selected field's bbox. Only ever has something to show for seeded sample
 * invoices (D21/D22) — the file route 404s for every real upload, and we render a plain
 * "no source document" message in that case instead of erroring.
 */
export function DocumentViewer({
  invoiceId,
  highlightBbox,
}: {
  invoiceId: string;
  highlightBbox: BBox | null | undefined;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setStatus("loading");
      const res = await fetch(`/api/invoices/${invoiceId}/file`);
      if (!res.ok) {
        if (!cancelled) setStatus("unavailable");
        return;
      }

      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const data = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d");
        if (!context) return;

        await page.render({ canvasContext: context, viewport, canvas }).promise;
        if (!cancelled) {
          setPageSize({ width: viewport.width, height: viewport.height });
          setStatus("ready");
        }
      } catch (e) {
        console.error("PDF render failed:", e);
        if (!cancelled) setStatus("error");
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  if (status === "unavailable") {
    return (
      <div className="flex h-64 items-center justify-center rounded border border-dashed text-sm text-gray-400">
        No source document stored for this invoice.
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex h-64 items-center justify-center rounded border border-dashed text-sm text-red-500">
        Couldn&apos;t render the document.
      </div>
    );
  }

  // bbox is [ymin, xmin, ymax, xmax] normalized 0-1000 (D8) -> map to canvas pixels.
  const overlay =
    pageSize && highlightBbox
      ? {
          top: (highlightBbox[0] / 1000) * pageSize.height,
          left: (highlightBbox[1] / 1000) * pageSize.width,
          height: ((highlightBbox[2] - highlightBbox[0]) / 1000) * pageSize.height,
          width: ((highlightBbox[3] - highlightBbox[1]) / 1000) * pageSize.width,
        }
      : null;

  return (
    <div className="relative inline-block">
      {status === "loading" && (
        <div className="flex h-64 w-full items-center justify-center text-sm text-gray-400">
          Loading document…
        </div>
      )}
      <canvas ref={canvasRef} className="max-w-full rounded border" />
      {overlay && (
        <div
          className="pointer-events-none absolute rounded border-2 border-amber-500 bg-amber-400/25 transition-all"
          style={{
            top: overlay.top,
            left: overlay.left,
            width: overlay.width,
            height: overlay.height,
          }}
        />
      )}
    </div>
  );
}
