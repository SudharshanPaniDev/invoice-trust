# Invoice Trust Layer — Implementation Plan

> Zamp Engineering Project Round · Problem #3 (messy documents → structured, queryable data)

## Thesis

Autonomous AI finance employees are only as good as the data they trust. The hard
problem is **not** extracting data — modern LLMs do that out of the box. The hard
problem is making extracted financial data **trustworthy enough to act on**.

So what I build is a **document extraction + trust system** for invoices: it parses
messy invoices into structured data where every field is _confidence-scored_,
_traceable to its source in the document_, and _correctable by a human_ — and where
confidence is **earned by verifiable business rules**, not claimed by the model.

To be explicit about scope: this is **Problem #3 (a document system), not Problem #2
(a conversational agent)**. "Trust layer for an AI finance employee" is _positioning_
— it frames why trustworthy data matters for finance automation like Zamp's — not a
claim that I'm building an agent. The parser is a component _inside_ the system; the
product is the trust layer around it.

## The one hard sub-problem I own: *earned confidence*

Most submissions surface the model's self-reported confidence. That is theatre — an
LLM that hallucinates a total will also confidently vouch for it. Instead, confidence
here is **derived from cross-checks that must hold for a real invoice**:

- Line items sum to the subtotal.
- `qty × unitPrice == lineAmount` per line.
- `subtotal + taxAmount == total`.
- `taxAmount ≈ subtotal × taxRate`.
- GSTIN passes format **and checksum** (the 15th char is a computed check digit).
- Dates parse; `dueDate >= invoiceDate`.
- Required fields present; currency in a known set.

A field's trust = model signal **∧** the rules it participates in. Every low-confidence
flag names _why_ in human language ("Line items sum to ₹9,500 but subtotal says ₹9,000").
That explainability is the finance-grade touch, and it is where the real tests live.

---

## Architecture

```
Upload PDF
   │
   ▼
Blob storage (Vercel Blob)  ──►  render page(s) to image (pdfjs)
   │                                     │
   │                                     ▼
   │                          Gemini vision extraction
   │                          → fields + per-field bbox + raw model signal
   │                                     │
   ▼                                     ▼
Persist (Postgres/Prisma) ◄──  Validation + earned-confidence engine
   │                          → per-field trust + explainable flags
   ▼
Review UI:  document viewer  │  field panel
            click field ─► highlight source bbox
            edit field  ─► re-run validation ─► trust updates live
   │
   ▼
Trusted store  ──►  [STRETCH] query layer (resolved query + exact rows, no narration)
```

### Tech stack

| Concern      | Choice                                  | Why (short) |
| ------------ | --------------------------------------- | ----------- |
| Framework    | Next.js 15 (App Router, TS)             | Full-stack in one repo; one-command deploy to Vercel = clean setup story. |
| DB           | Postgres (Neon) + Prisma                | Query patterns are relational (invoices↔line items); one datastore for a short build; enables the SQL stretch. |
| File storage | Vercel Blob                             | Zero-config with Vercel; keeps PDFs out of the DB. |
| Extraction   | Google Gemini (Flash, free tier)        | Free (no card), reads scanned/image-only PDFs, JSON-schema structured output, returns per-field bbox — covers extraction at zero cost (see [decisions D8]). Model-agnostic behind a seam (D3). |
| PDF render   | `pdfjs-dist`                            | Render page→image for the model AND for the on-screen provenance overlay. |
| Validation   | Zod (LLM output) + pure TS rules engine | Zod guards malformed model JSON; rules engine is deterministic and unit-testable. |
| Tests        | Vitest + Testing Library                | Fast; the rules engine is the high-value test target. |
| Deploy       | Vercel + Neon                           | Testable URL, one-shot setup. |

### Data model (Prisma sketch)

```prisma
model Invoice {
  id          String    @id @default(cuid())
  fileUrl     String
  status      String    // processing | needs_review | trusted | failed
  vendorName  Field?    // Field = value + confidence + bbox + flags (embedded JSON)
  vendorGSTIN Field?
  invoiceNo   Field?
  invoiceDate Field?
  dueDate     Field?
  currency    Field?
  subtotal    Field?
  taxRate     Field?
  taxAmount   Field?
  total       Field?
  lineItems   LineItem[]
  createdAt   DateTime  @default(now())
}
// Field stored as JSON: { value, modelConfidence, confidence, bbox, flags[] }
```

---

## Scope tiers

**CORE — this IS the submission. Ships even if nothing else does.**

1. Upload invoice (drag-drop, multi-file), graceful non-invoice rejection.
2. Extraction pipeline (render → Claude vision → Zod-typed fields + bbox).
3. Earned-confidence engine with explainable flags (the hard core, TDD).
4. Review UI: document viewer + field panel, low-confidence fields flagged, click field → source highlight, inline edit → live re-validation.
5. Trusted store: list/history, empty state, processing state, error state.
6. **Structured query/search** over the trusted store — filter by vendor, amount range,
   date, status → **exact rows**. This is baseline, not optional: the problem statement
   asks for "structured, *queryable* data … searched and queried" (see [decisions D4]).

**STRETCH — only if core is genuinely done. Non-negotiable rule: no free-form chat.**

7. NL → **resolved structured query** — show the user the query it ran, return
   **exact rows**. Never let the model narrate numbers over financial data.

**Deliberately cut** (record in `decisions.md`): auth/multi-tenant, non-invoice doc
types, document classification, multi-doc reconciliation, background job queue,
free-form chat, embeddings/semantic search.

**Framing note.** This is a **document intelligence platform, v1 = invoices** — not an
"invoice parser." The pipeline (`Upload → Document Processor → Invoice Extractor (v1) →
Validation → Store → Search`) keeps extraction behind a modular seam so a second
extractor could be added without touching downstream validation/store/search. No fake
classifier — scope is owned explicitly (see [decisions D3]). North-star rule for every
feature: **it must strengthen the trust story, or we don't build it.**

**Timeline.** Brief's horizon is **5 days**, not 2–3. Core (steps 1–6) is the target;
the estimate table below is conservative and leaves real room for hardening + the stretch.

---

## Phases & effort (so we can decide the stretch)

| Phase | Work | Est. |
| ----- | ---- | ---- |
| 0 | Setup: Next scaffold, Prisma+Neon, Blob, env, deploy skeleton, one-shot `README` setup | ~1.5h |
| 1 | Extraction pipeline: upload → Blob → render → Claude vision → Zod parse | ~4h |
| 2 | **Confidence engine (TDD)**: rules, GSTIN checksum, earned confidence, flags | ~4h |
| 3 | Review UI: viewer + overlay highlight, field panel, flags, inline edit + recompute | ~6h |
| 4 | Trusted store: list/history + empty/processing/error states (journey polish) | ~3h |
| 5 | Tests pass, `decisions.md`, `README`, deploy live, seed nasty fixtures | ~3h |
| — | **Core subtotal** | **~21.5h (~2.5 days)** |
| 6 | **Stretch**: query layer (structured + NL→resolved-query, exact rows) | +4–5h |

---

## Task breakdown

### Phase 0 — Setup

- Scaffold `create-next-app` (TS, App Router, Tailwind).
- Add Prisma, init schema, connect Neon; `prisma migrate dev`.
- Add Anthropic SDK, `pdfjs-dist`, `zod`, Vitest.
- `.env.example` with every key (`GEMINI_API_KEY`, `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`).
- Deploy skeleton to Vercel (get the URL early — de-risks the deploy story).
- `README`: one-shot setup (clone → `pnpm i` → copy env → `pnpm db:push` → `pnpm dev`).
- **Commit:** `chore: scaffold next app + prisma + deploy skeleton`.

### Phase 1 — Extraction pipeline

- `POST /api/invoices` — accept file, store to Blob, create `Invoice(status=processing)`.
- `lib/pdf.ts` — render page(s) to PNG data URL via pdfjs.
- `lib/extract.ts` — Gemini vision call with a **strict JSON schema** (structured output): every field returns `{ value, modelConfidence, bbox, sourceText }`. bbox arrives normalized to a 1000×1000 grid → convert to real pixel dims for the overlay.
- `lib/schema.ts` — Zod schema; reject/repair malformed model output (don't trust the model's JSON).
- Handle: non-invoice input → `status=failed` + reason; timeout/rate-limit (free tier ~15 req/min) → retry then graceful fail.
- **Tests:** mock Gemini; assert Zod rejects malformed output; assert non-invoice path.
- **Commit:** `feat: invoice extraction pipeline (upload → vision → typed fields)`.

### Phase 2 — Confidence engine (TDD, the hard core)

- `lib/validation/rules.ts` — pure functions, one per business rule; each returns `{ ok, message }`.
- `lib/validation/gstin.ts` — format regex + **checksum** validator.
- `lib/validation/confidence.ts` — combine model signal + rule results → per-field `confidence` + `flags[]`.
- **Write tests FIRST** for each rule with good/bad/edge fixtures (missing fields, sum mismatch, bad GSTIN checksum, tax rounding).
- **Commit:** `feat: earned-confidence engine with explainable flags`.

### Phase 3 — Review UI + provenance

- `/invoices/[id]` — split view: PDF viewer (pdfjs canvas) + field panel.
- Low-confidence fields visually flagged with the _reason_.
- Click a field → overlay highlight its `bbox` on the page; bbox-unreliable fallback → text-search highlight.
- Inline edit → PATCH field → re-run validation server-side → trust + flags update live.
- **Commit:** `feat: review UI with source provenance + inline correction`.

### Phase 4 — Trusted store + journey

- `/invoices` list with status badges (processing / needs review / trusted / failed).
- Empty state (first-run), processing state, failed state with retry.
- "Mark trusted" gate — can't trust while unresolved flags exist (nice trust touch).
- **Commit:** `feat: invoice list + first-run/empty/error states`.

### Phase 5 — Harden & ship

- Full test run green; add a fixtures folder of ~15 messy invoices (clean, scanned, sum-mismatch, missing GSTIN, multi-currency, multi-page).
- Fill `decisions.md` with every real call.
- `README` polished; verify one-shot setup on a clean clone.
- Confirm live URL works.
- **Commit:** `docs: decisions log + setup guide` / `test: nasty-invoice fixture suite`.

### Phase 6 — Stretch

- `/query` — structured filters (vendor, amount range, date, status) → exact rows.
- NL box → translate to a **typed query object** (not raw SQL from the model) → run → show resolved filters + exact rows.
- **Tests:** NL→query translation correctness on a fixture set.
- **Commit:** `feat: verifiable query layer (resolved query, exact rows)`.

---

## Above-and-beyond checklist (depth, not bells)

- [ ] Confidence **earned by validation**, not model self-report — with human-readable "why".
- [ ] GSTIN **checksum** (not just regex) — the edge nobody bothers with.
- [ ] Source **provenance highlighting** — every field auditable back to the document.
- [ ] Graceful degradation on garbage: non-invoice, scanned, partial, malformed model JSON.
- [ ] "Can't mark trusted while flags open" — the product actually enforces trust.
- [ ] Tests that catch **real** finance bugs (math mismatch, bad checksum), not coverage padding.
- [ ] One-shot setup a stranger can run; live URL.

## Open risks

- **LLM bbox accuracy** for provenance → mitigate with sourceText fallback (text-search highlight). Also convert Gemini's 0–1000 normalized coords back to real pixels.
- **Free-tier data use** → Gemini free tier may train on submitted data; use sample/synthetic invoices only, never real confidential financials (see [decisions D8]). Escape hatch: paid tier or local model — a one-seam change (D3).
- **Free-tier rate limit (~15 req/min) / latency** → space calls, batch small over the ~15-invoice fixture set, cache extraction, show processing state; not a constraint at demo scale.
- **Neon/Vercel/Blob wiring** eating setup time → do Phase 0 deploy skeleton first to de-risk.
