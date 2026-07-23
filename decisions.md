# Decisions

An honest log of the real calls made building this — what I chose, what I rejected, why,
and what I cut. Newest at the bottom. Not a changelog; the reasoning behind the code.

---

## D0 — How I got to Problem #3 (the path, not just the pick)

The final choice looks obvious in D1; getting there wasn't. This is the actual arc,
because how I moved through the ambiguity is the point the brief is testing.

**Started with all three open, and treated the choice as the first real deliverable.** The
brief says the ambiguity is deliberate and interpretation is part of the evaluation, so I
spent focused time up front — using AI (Claude and ChatGPT) as thinking partners to
pressure-test each reading — before writing any code.

**Cut #1 quickly.** Learn-by-watching, in a few days, is a macro recorder: record actions,
replay them. The genuinely hard part (generalizing behavior) is a research problem, and a
reviewer would see straight through a replay demo.

**Then got genuinely stuck between #2 and #3.** I leaned #3 early for the trust/confidence
angle, but kept re-opening #2 — a conversation agent maps closest to Zamp's product and
felt more ambitious. I did not resolve this on the first pass; I sat in it.

**A reframe nearly flipped me to #2.** I'd been treating Zamp as a document-tool company.
It isn't — it sells autonomous AI "employees" for finance. That made #2 look like "build a
lite version of their actual product," and for a moment it pulled ahead.

**The same reframe is what settled it on #3.** The thing that gates an AI finance employee
is *trust*: can you let it act on money, tax, compliance? That is Zamp's company-level
problem — and #3 lets me build exactly it, scoped to one skill. So the reframe didn't flip
me; it sharpened #3 from "a doc parser" into "the trust layer an AI finance employee
needs."

**Tempted by a hybrid, then deliberately cut the risky half.** I considered layering a
conversational query on top ("why is this GST wrong?", "compare to last month"). I rejected
the narration: a model speaking over financial numbers is the exact untrustworthy thing
I'm fighting. I kept only a *structured* query — the model picks filters, the system
returns exact rows, no number is ever narrated (see D4).

**Then I forced a commit.** Past a point the real risk stops being "wrong idea" and becomes
"never starting." Once the trust thesis held up against the brief's criteria, I locked it
and moved to execution — quality of execution matters more here than whether some other
idea was 5% better. Everything from D1 on is a concrete call under that commitment.

---

## D1 — Problem #3, scoped to invoices

**The decision:** Problem #3 (messy documents → structured, queryable data), scoped to
invoices. Read as a document extraction **and trust** system — validation, confidence,
provenance, human correction — not the commodity "upload PDF → LLM → table" version. LLMs
already extract well, so that alone only proves I can wire an API; the trust layer is the
whole point (see D2). "Trust layer for an AI finance employee" is positioning (why it
matters), not scope — the deliverable is a document system, not an agent.

**The alternatives:**
- **#1 (learn by watching)** — in a few days it's a macro recorder; real behavior
  generalization is a research problem a reviewer sees through.
- **#2 (conversation agent)** — closest to Zamp's product, but short builds become a thin
  chat wrapper with unverifiable success. Kept a strict slice as a stretch (see D4).

**The reasoning:** invoices give the richest structured fields, hard cross-checks (line-item
sums, tax math, GSTIN checksum), and messy real-world samples that are easy to source for
tests — the best substrate to prove trust, not just extraction.

**What I deliberately cut:** auth/multi-tenant · non-invoice types · multi-doc
reconciliation · job queue · free-form chat — each trades depth on the trust core for
shallow breadth.

---

## D2 — Confidence is earned by validation, not reported by the model

**The decision:** per-field confidence from verifiable rules (line-item sums, tax math,
GSTIN checksum, date sanity) combined with the model's signal — never the model's
self-reported confidence alone. Every low-confidence flag states a human-readable reason.

**The alternatives:** trust the model's own confidence score (simplest); show raw output
with no scoring (fastest).

**The reasoning:** a model that hallucinates a total will confidently vouch for it —
self-reported confidence is theatre. In finance, confidence only means something when
anchored to arithmetic that *must* hold. This is the hard sub-problem and where the
meaningful tests live. Tradeoff accepted: more upfront work on a rules engine, and rules
are invoice-specific — worth it, it's the whole thesis.

**What I deliberately cut:** model-self-confidence as the trust source; any un-anchored
"score" shown to the user.

---

## D3 — One document type, behind an honest modular seam

**The decision:** invoices only, but deep — a modular pipeline (`Upload → Processor →
Invoice Extractor (v1) → Validation → Store → Search`) where extraction is a clean seam a
second extractor could slot into without touching anything downstream. No classifier that
always returns "invoice."

**The alternatives:**
- **Multiple types (receipts, POs, contracts, resumes)** — shallow on many, and most have
  no objective correctness to check (no math, no ground truth), so they can't show trust.
- **Stub classifier returning "invoice"** — dishonest; fake extensibility reads worse than
  an owned, explicit scope.

**The reasoning:** the brief says pick the hard problem and go deep. One type keeps the
pipeline's *shape* general while the trust core goes deep. The pattern (extract → validate →
earn confidence → provenance → correct → query) generalizes to any domain where "correct"
is definable; invoices are the first instance.

**What I deliberately cut:** document classification · multi-type support ·
embeddings/semantic search over document text.

---

## D4 — Query and search are baseline, not a stretch

**The decision:** structured search ships in the core build — filter by vendor, amount
range, date, status → exact rows.

**The alternatives:** keep query as an optional stretch; or drop it, submit extraction +
trust only.

**The reasoning:** the problem statement literally asks for "structured, *queryable* data …
searched and queried." Demoting it risks nailing the hard sub-problem while
under-delivering the stated one. On a 5-day budget, structured query fits comfortably.
Tradeoff accepted: more surface to build and test — worth it to complete the "messy in →
trustworthy, queryable out" story end to end.

**What I deliberately cut:** natural-language query stays a stretch, and even then resolves
to a **structured query shown with exact rows** — the model never narrates numbers (see
D2). Free-form chat stays cut.

---

## D5 — Next.js (one full-stack app) over React + separate backend

**The decision:** build the whole thing as a single Next.js 15 app (App Router, TS) —
React UI and server code (API routes) in one repo, one deploy.

**The alternatives:** 
- **Plain React (Vite) + separate Express/Node API** — two repos, two deploys, CORS
  wiring; and a browser-only frontend can't safely hold the `ANTHROPIC_API_KEY` or talk to
  Postgres, so a backend is mandatory anyway.
- **Remix / SvelteKit** — same full-stack shape, but I don't know them; Next.js reuses the
  React I already know.
- **HTML + Python (FastAPI)** — throws away the React strength entirely.

**The reasoning:** the app needs both a UI *and* a server (receive PDF, call Claude, run
validation, hit the DB). Next.js gives both in one language, one repo — server code hides
secrets by default, and it deploys to Vercel in one command, which keeps the reviewer's
clone-and-run story clean on a solo 5-day build. Next.js pages *are* React components, so
the only new concept is "files under `app/api/` run on the server." Tradeoffs accepted:
Next-specific conventions (App Router, server vs client components) to learn, and a soft
pull toward Vercel — leaned into on purpose for the deploy story.

**Context, stated honestly:** I've spent the last 5 years as a frontend engineer and have
not built backends before. So I made the stack choice deliberately, using Claude as a
thinking partner to pressure-test the options against a solo 5-day build (see D0 for how I
use AI). Next.js is the call that turns that into a strength: it builds on the React I know
deeply while keeping the backend surface I'm new to as small and conventional as possible
(a few `app/api/` route handlers), instead of standing up and wiring a separate service in
territory I'm less sure of. The trust core of this project (D2) is domain logic and plain
TypeScript, not backend plumbing — so minimizing unfamiliar infra is exactly what frees
time for the part that actually matters.

**What I deliberately cut:** a standalone backend service, and any non-React stack.

---

## D6 — Postgres (Neon) over a vector DB or NoSQL

**The decision:** one relational datastore — Postgres, hosted on Neon, with per-field data
(value + confidence + bbox + flags) stored as JSON inside the invoice row.

**The alternatives:**
- **Vector DB (Pinecone, etc.)** — built for semantic similarity; our queries are exact and
  relational (vendor =, total between, status =), not fuzzy — wrong tool, and a second
  datastore to run.
- **MongoDB / NoSQL** — flexible schema, but our data has real relationships (invoice ↔
  line items) and money math we *want* strictly typed; range/relational queries get clumsy.
- **SQLite** — zero-setup and fine locally, but doesn't host cleanly on serverless (Vercel),
  which would break the deploy story.
- **Plain JSON files** — no real querying, concurrency, or integrity; toy-grade.

**The reasoning:** the data is relational (invoices with many line items) and the queries
are relational (filter by exact fields and ranges) — exactly what SQL is for. I didn't want
to run two datastores for a 5-day build, so one Postgres covers storage *and* all query
needs; its JSON columns still give flexible per-field blobs where useful. Neon hosts it with
near-zero config on Vercel, same one-command-setup logic as D5. Tradeoffs accepted: a schema
defined upfront (wanted, for money data) and no semantic search.

**What I deliberately cut:** vector DB / embeddings, NoSQL, and semantic search over
document text (already in the D3 cut list) — our search is exact-filter, which is what
finance trust needs.

---

## D7 — Prisma (typed ORM) over raw SQL

**The decision:** talk to Postgres through Prisma — one schema file defines the tables and
generates a fully typed client, with `prisma migrate` handling DB changes.

**The alternatives:**
- **Raw SQL (`pg` / `postgres.js`)** — max control, but query results are `any`-typed and
  migrations are hand-written; a mistyped column fails at runtime, not while coding.
- **Drizzle** — typed query builder, closer to SQL; solid, but Prisma has smoother docs and
  tooling for someone new to databases, and the plan already assumes it.
- **Kysely** — typed SQL builder; still requires thinking in SQL rather than objects.

**The reasoning:** Postgres speaks SQL; the app is TypeScript — something must translate.
Prisma makes the database feel like typed frontend code: autocomplete on every field, type
errors surfaced *before* running, no hand-written SQL strings to get wrong, and generated
migrations instead of manual `ALTER TABLE`. As a frontend engineer new to backends (see
D5), that shrinks the unfamiliar surface and keeps the source of truth in one schema. The
project's hard value is the validation/trust layer (D2), not clever queries — so trading a
little query-level control for safety and speed is the right call. Tradeoffs accepted: some
generated "magic" (the SQL is hidden but loggable) and a `prisma generate` build step.

**What I deliberately cut:** raw-SQL data access and hand-written migrations.

---

## D8 — Gemini free tier for extraction, over paid Claude vision

**The decision:** use Google Gemini (Flash / Flash-Lite, Google AI Studio free tier) as the
vision extractor instead of the Anthropic Claude vision originally sketched in the plan.
Verified online before committing (free-tier limits, vision/PDF, structured output,
bounding-box support, data-use terms).

**The alternatives:**
- **Claude vision (Anthropic SDK)** — the original plan; excellent, but pay-per-token and
  needs a billing account set up before Phase 1.
- **OCR + parsing (Tesseract)** — free, but layout-blind and brittle; already rejected in D1
  reasoning (extraction quality would undercut the whole demo).
- **Local vision model (Ollama + Qwen-VL / Llama Vision)** — fully free and fully private,
  but heavier setup, needs local RAM, and lower output quality.

**The reasoning:** the trust thesis (D2) is model-agnostic — confidence is *earned by
validation* (line-item sums, tax math, GSTIN checksum), not supplied by the model, so a free
extractor costs the project nothing in credibility. D3 already put extraction behind a
modular seam, so swapping the extractor is exactly the one clean change that seam was built
for; nothing downstream (validation, store, search) moves. Online check confirmed Gemini
covers every need: free with no card (~1,500 requests/day, ~15/min, 1M tokens/min, no
expiry), reads invoice images and PDFs, supports JSON-schema structured output on the free
tier, and returns per-field bounding boxes (`[ymin,xmin,ymax,xmax]`, normalized 0–1000) —
which powers the provenance highlight in Phase 3. Bounding-box coords convert from the
1000×1000 grid back to real pixels (minor math). This also removes the "set up billing
before you can build" blocker for a solo 5-day build.

**Tradeoffs accepted:**
- **Free tier trains on submitted data** — Google may use free-tier prompts/images to
  improve models, and the terms warn against sensitive data. Acceptable because the demo
  uses sample/synthetic invoices only; the rule is *no real confidential financials on the
  free tier*. (EEA/UK/Switzerland get paid-tier privacy even on free.) If this ever went
  near real data, the fix is the paid tier or a local model — a one-seam change by D3.
- **~15 requests/min rate limit** — fine for building and the ~15-invoice fixture set (space
  calls or batch small); only a constraint at high volume, which this build isn't.

**What I deliberately cut:** paid Claude vision, OCR+parsing, and local models — each either
adds cost/setup or loses quality without strengthening the trust story (the north-star test
from the plan). The modular seam keeps all three as drop-in options if constraints change.
