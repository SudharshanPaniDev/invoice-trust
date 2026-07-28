# Invoice Trust Layer

Messy invoices → structured, **trustworthy**, queryable data. Every extracted field is
confidence-scored (confidence *earned by validation*, not claimed by the model), traceable
to its source in the document, and correctable by a human.

**Live demo:** https://invoice-trust.vercel.app — don't upload a real invoice; download one
of the sample documents on the landing page instead (see below).

![Upload page with the download-sample-invoices section](docs/images/screenshot.png)

Zamp Engineering Project · Problem #3. See [`SCOPE.md`](SCOPE.md) for what this does and
doesn't do, [`decisions.md`](decisions.md) for the reasoning behind every call made
getting here, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a reviewer-facing
tour of the system — stack, diagrams, API/data model, and a feature-flow walkthrough.
[`docs/plan.md`](docs/plan.md) has the original plan.

## What it does

- Extracts vendor, GSTIN, dates, amounts, and line items from a PDF or image invoice
- Scores each field's confidence from verifiable rules (line-item sums, tax math, GSTIN
  checksum) — never from the model's own self-reported confidence
- Lets a human correct a flagged field; the whole invoice re-validates on save
- Gates "mark trusted" server-side — blocked while any flag is open, not just hidden in the UI
- Filters stored invoices by vendor, status, amount range, and date
- Shows provenance (click a field → see its source on the document) for a curated sample set
- Ships 8 downloadable sample invoices — clean, invalid GSTIN, arithmetic mismatch, scanned,
  phone photo, stamped/annotated, multi-page, missing fields — so nobody needs to upload a
  real document to try it
- Exports the filtered invoice list as CSV or JSON — trusted invoices only by default, with
  an explicit override, always including confidence/flags so nothing leaves ambiguous
- Flags cross-invoice duplicates — GSTIN+invoice-number+total (fiscal-year bound), a
  date-proximity match, or a vendor-name fallback when GSTIN is missing all surface as one
  "possible duplicate," always blocking trust until a human deletes the redundant invoice
  or dismisses the pair as not-a-match

## Screenshots

**A flagged field, explained in plain English.** The GSTIN's checksum fails, so it's
flagged with the exact reason — the invoice can't be marked trusted until a human resolves it.

![An invoice detail page showing a failed GSTIN checksum flag](docs/images/flagged-field.png)

**The same invoice uploaded twice, caught automatically.** No fuzzy guessing — an exact
match on vendor, invoice number, and total blocks trust until a human says "same document"
(deletes the extra copy) or "not a duplicate" (dismisses it, remembered permanently).

![An invoice detail page showing a duplicate flag with resolve/dismiss buttons](docs/images/duplicate-detected.png)

**Trust gate: blocked.** Three open flags (an arithmetic mismatch) — "Mark trusted" is
disabled server-side, not just hidden in the UI.

![An invoice with open flags and a disabled Mark trusted button](docs/images/trust-gate-blocked.png)

**Trust gate: passed.** Every check verified, marked trusted.

![An invoice with all checks passed and a Marked trusted confirmation](docs/images/trust-gate-trusted.png)

**Search, filter, and export — never ambiguous about what's verified.** Every export
carries each field's confidence with it, and defaults to trusted invoices only.

![The invoices list with filters, duplicate badges, and export buttons](docs/images/invoices-list.png)

## Stack

Next.js 16 (App Router, TS) · Postgres (Neon) + Prisma 7 (driver adapter) · Google Gemini
(vision extraction, free tier) · Zod · Vitest + Playwright · Tailwind v4. Deploy: Vercel +
Neon, GitHub Actions (attempts to keep Neon compute warm — see `decisions.md` D31/D56 for
why this doesn't fully work on a low-traffic repo).

## One-shot setup

```bash
# 1. Install deps
pnpm install

# 2. Configure environment
cp .env.example .env
#    then fill in:
#    - GEMINI_API_KEY  — free, no card:  https://aistudio.google.com
#    - DATABASE_URL    — free Postgres:   https://neon.tech
#    (no file storage token needed — real uploaded documents are never persisted, see below)

# 3. Create the database schema
pnpm db:push        # push the Prisma schema to your database
pnpm db:generate    # generate the typed Prisma client

# 4. Seed the 3 provenance sample invoices (clean / invalid-GSTIN / mismatch)
pnpm db:seed

# 5. Run
pnpm dev            # http://localhost:3000
```

## Scripts

| Command             | What it does                                  |
| ------------------- | ---------------------------------------------- |
| `pnpm dev`          | Start the dev server                          |
| `pnpm build`        | Production build                              |
| `pnpm test`         | Run the test suite (Vitest)                   |
| `pnpm db:push`      | Apply the Prisma schema to the database       |
| `pnpm db:migrate`   | Create + apply a migration (dev)              |
| `pnpm db:generate`  | Regenerate the typed Prisma client            |
| `pnpm db:seed`      | Seed the 3 provenance sample invoices          |
| `pnpm eval`         | Run live extraction against all 8 samples (real Gemini calls, not CI-safe) |
| `pnpm a11y`         | axe-core accessibility check against all page types (needs `pnpm dev` running) |
| `pnpm check:provenance` | Regression check for the provenance overlay position (needs `pnpm dev` + seeded DB) |
| `pnpm e2e`          | Playwright end-to-end flow check — confirm/correct/trust, duplicate resolution, export, search (needs `pnpm dev` running; creates and cleans up its own test invoices) |

The other 5 sample invoices (scanned/photo/stamped/multi-page/missing-fields) are static
files checked into `public/samples/`, generated by `scripts/generate-samples.ts` — that
script is build-time-only tooling, not something you need to run to use the app.

## Data handling, in short

- **Gemini's free tier may use submitted data to improve Google's models** — sample or
  synthetic invoices only, never real confidential financials (`decisions.md` D8).
- **A real user's uploaded document is never persisted, in any form.** It's processed
  in-memory for extraction and discarded once the request completes — no source-document
  retention, deliberately, given this is a public deployment with no access controls or audit
  logging. A production system would normally retain the source in encrypted object storage;
  full reasoning in `decisions.md` D21/D22, and the tradeoff is stated in `SCOPE.md`.

## Known limitations

- One document type, one template family (Indian GST tax invoices) — not tested against
  arbitrary layouts, languages, or other document types. Deliberate depth-over-breadth
  scope, not an oversight (`decisions.md` D3).
- Search is structured filters (vendor/status/amount/date), not full-text or semantic
  search over document content — cut on purpose (`decisions.md` D3/D6).
- No authentication or per-user data isolation — one shared public instance
  (`decisions.md` D18).
- Provenance (click-a-field-to-see-its-source) only works on the curated sample set, never
  on a real upload, since real uploads are never persisted (`decisions.md` D21).
- The *extracted structured fields* from real uploads are stored in plaintext, unencrypted
  — an explicitly named gap, not something silently overlooked (`decisions.md` D22).
- Neon's free-tier compute auto-suspends after idle; the first request after a suspension
  can take an extra ~0.8–1.2s. A scheduled keep-warm ping exists but doesn't fire reliably
  enough on a low-traffic repo to prevent this — a hosting-tier limitation, deliberately
  left as a stated limitation rather than patched with a third-party uptime-monitor
  dependency (`decisions.md` D31/D56).
- Duplicate detection is exact-field matching (GSTIN, invoice number, total, date), not
  fuzzy — the vendor-name fallback used when GSTIN is missing still requires an exact
  vendor-name/invoice-number/total match (`decisions.md` D51/D53).

## Project context

Solo submission for Zamp's Engineering Project Round (Problem #3) — not an open-source
project seeking contributions, and no license is specified.
