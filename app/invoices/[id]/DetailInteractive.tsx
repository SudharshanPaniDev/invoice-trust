"use client";

import { useState } from "react";
import type { ScoredField } from "@/lib/validation/confidence";
import { ScoredFields } from "../../_components/ScoredFields";
import { DocumentViewer } from "./DocumentViewer";

/**
 * Ties the document viewer to the field table: clicking a field with a bbox highlights its
 * source region on the page (provenance, D21/D22 — only ever present for seeded samples).
 */
export function DetailInteractive({
  invoiceId,
  fields,
  hasDocument,
}: {
  invoiceId: string;
  fields: Record<string, ScoredField>;
  hasDocument: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (!hasDocument) {
    return (
      <>
        <p className="mb-2 text-xs text-muted">
          Hover a value to edit — corrections re-validate the whole invoice.
        </p>
        <ScoredFields fields={fields} editInvoiceId={invoiceId} />
      </>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs text-muted">
          Click a highlighted field to see where it was read from.
        </p>
        <DocumentViewer invoiceId={invoiceId} highlightBbox={selected ? fields[selected]?.bbox : null} />
      </div>
      <div>
        <p className="mb-2 text-xs text-muted">
          Hover a value to edit — corrections re-validate the whole invoice.
        </p>
        <ScoredFields
          fields={fields}
          editInvoiceId={invoiceId}
          selectedField={selected}
          onSelectField={setSelected}
        />
      </div>
    </div>
  );
}
