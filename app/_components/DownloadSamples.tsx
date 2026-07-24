import Link from "next/link";

interface SeededSample {
  id: string;
  label: string;
  description: string;
}

interface StaticSample {
  href: string;
  label: string;
  description: string;
}

const STATIC_SAMPLES: StaticSample[] = [
  {
    href: "/samples/scanned-invoice.pdf",
    label: "Scanned copy",
    description: "Office-scanner look — slight skew, washed contrast, paper grain",
  },
  {
    href: "/samples/phone-photo-invoice.jpg",
    label: "Phone photo",
    description: "Rotated, mild glare/vignette, JPEG compression — shot on a phone",
  },
  {
    href: "/samples/stamped-scan-invoice.pdf",
    label: "Stamped copy",
    description: "Low-quality scan with a \"PAID\" stamp and a pen annotation",
  },
  {
    href: "/samples/multipage-invoice.pdf",
    label: "Multi-page invoice",
    description: "Line items split across two pages",
  },
  {
    href: "/samples/missing-fields-invoice.pdf",
    label: "Missing/illegible fields",
    description: "No GSTIN or due date printed; total too faint to read confidently",
  },
];

/**
 * Realistic documents to safely experiment with instead of a real invoice (D21/D29) — the
 * app never retains what a real user uploads, so this is the sandbox: download one, upload
 * it back through the normal extraction flow, and watch the trust engine score it live. The
 * first three are also seeded with a stored copy, so they get a "see how it was scored" link;
 * the rest are plain downloads, scored fresh whenever someone uploads them.
 */
export function DownloadSamples({ seeded }: { seeded: SeededSample[] }) {
  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Download sample invoices</h2>
      <p className="mt-1 text-xs text-muted">
        Don&apos;t upload your own invoice — grab one of these instead, then upload it below.
      </p>
      <ul className="mt-3 divide-y divide-border">
        {seeded.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div>
              <span className="font-medium">{s.label}</span>
              <span className="ml-2 text-xs text-muted">{s.description}</span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <a
                href={`/api/invoices/${s.id}/file`}
                download
                className="text-accent hover:text-accent-hover hover:underline"
              >
                download
              </a>
              <Link href={`/invoices/${s.id}`} className="text-muted hover:text-foreground hover:underline">
                see how it was scored
              </Link>
            </div>
          </li>
        ))}
        {STATIC_SAMPLES.map((s) => (
          <li key={s.href} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div>
              <span className="font-medium">{s.label}</span>
              <span className="ml-2 text-xs text-muted">{s.description}</span>
            </div>
            <a href={s.href} download className="shrink-0 text-accent hover:text-accent-hover hover:underline">
              download
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
