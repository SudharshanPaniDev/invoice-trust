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

---

## D9 — Denormalize searchable values alongside the per-field trust JSON

**The decision:** store each searchable field **twice** in the `Invoice` row — a per-field
trust JSON (`<field>Field: Json` holding `{ value, modelConfidence, confidence, bbox,
flags[] }`) *and* a plain, indexed, typed column for the searchable subset (`vendorName:
String`, `total: Decimal`, `invoiceDate: DateTime`). `status` was already a top-level String.

**The alternatives:**
- **JSON-only (original plan sketch)** — every field lives solely in its trust JSON. Query
  (D4) then has to filter *inside* JSON: Postgres JSON filtering is clumsy, can't cleanly do
  numeric range (amount) or date comparison, and can't be indexed → slow, awkward query code.
- **Typed-columns-only** — drop the JSON, keep just typed values. Loses the confidence, bbox,
  and flags per field — i.e. loses the entire trust layer (D2). Non-starter.

**The reasoning:** D4 makes structured search (filter by vendor, amount range, date, status)
a *core* deliverable, not a stretch. That requires those values to be first-class,
indexable columns. But D2's trust core requires the rich per-field metadata. The two needs
don't fit one representation, so store both: JSON for trust detail, typed columns for the
queryable projection — the standard "rich metadata + searchable projection" pattern. Keeps
D4 query code trivial and fast, and leaves the trust thesis fully intact.

**Tradeoffs accepted:** small duplication — the extracted value is mirrored into both the
JSON and the typed column, so the writer sets both from the same source in one place. Worth
it for indexed, clean search. Cheap to adopt now (no data yet, `db push` only).

**What I deliberately cut:** JSON-path querying for the searchable fields, and any
typed-only design that would drop trust metadata.

---

## D10 — Neon: pooled connection for the app, direct for migrations

**The decision:** point the app's runtime `DATABASE_URL` at Neon's **pooled** endpoint
(`-pooler` host, via the Prisma `pg` driver adapter), and add a separate non-pooled
`DIRECT_URL` (`directUrl` in `prisma.config.ts`) used only by `prisma migrate` / `db push`.

**The alternatives:**
- **Direct-only (simplest)** — one non-pooled URL for everything. Fine for a demo, but on
  serverless (Vercel) many function instances each open a direct connection → connection
  exhaustion; not production-shaped.
- **Pooled-only** — one pooled URL for everything. The app is happy, but `migrate` / `db
  push` flake or hang: Neon's pooler (PgBouncer, transaction mode) can't hold the
  session-level locks the migrate engine needs. This is the classic Neon+Prisma trap.

**The reasoning:** the two access patterns want opposite things. Runtime (serverless, many
short-lived connections) wants pooling; migrations (long session, advisory locks) want a
direct connection. Splitting them is the documented Neon+Prisma setup and costs only one
extra env var plus one config line — minimal, not "unnecessary complexity," and it avoids a
gotcha we'd otherwise hit later under load or on the first `migrate dev`.

**Tradeoffs accepted:** one extra env var (`DIRECT_URL`) to manage. (`db push` on the small
schema happened to succeed over the pooler too, but `directUrl` is wired correctly for
`migrate dev` going forward.)

**What I deliberately cut:** direct-only and pooled-only single-URL setups.

---

## D11 — Build order: extraction-first vertical slice, not validation-first

**The decision:** build a thin end-to-end slice first — `extract.ts` (Gemini) → minimal
store → bare page that shows extracted fields — capturing real Gemini outputs as fixtures
along the way; *then* build the validation / earned-confidence engine (the differentiator)
deep and TDD **against those real fixtures**; then provenance + journey polish. Extraction
uses: **PDF sent directly to Gemini** (no server-side render), **Flash** model, and
**structured output** (`responseSchema`) validated by our Zod contract (D9/`lib/schema.ts`).

**The alternatives:**
- **Validation engine first** (my initial recommendation) — the thesis is the trust layer,
  it's pure TS with no external deps, and it's the most test-provable part, so build it
  first in isolation.
- **Render PDF → image server-side** (pdfjs + node-canvas) before sending to Gemini —
  instead of sending the PDF directly.
- **Flash-Lite** instead of Flash for extraction.

**The reasoning:** I recommended validation-first and then pressure-tested it against a
"reviewer clones tomorrow, demos end-to-end, 15–20 min" lens. It flipped on two points.
(1) **Feedback loop:** the validation engine's whole job is surviving real-world mess
(`"₹9,500.00"` vs `9500`, spaced GSTINs, odd date formats, nulls) — the code most sensitive
to real input shape. Testing it on hand-authored mocks proves only that it handles shapes I
imagined; the bugs live in the gap between assumption and reality. Real Gemini output is the
ground truth it must be tested against, so extraction has to come first to generate it.
(2) **Risk:** every unknown lives in extraction (does Gemini return usable structured output
+ bboxes on messy invoices? does PDF-direct work? free-tier behavior?); validation is fully
in our control. Retire the external risk first, not the day before the deadline. Demo value
and vertical-slice-over-horizontal-layers both point the same way: the earliest interactive
system a reviewer can touch *is* the extraction entry point, and a thin working end-to-end
path beats two polished disconnected subsystems. On the extract.ts sub-calls: PDF-direct
avoids `node-canvas` on serverless (pdfjs stays browser-only for the Phase 3 viewer); Flash
for accuracy (both free); structured output for a reliable contract match.

**What changed:** I had conflated "most important" with "build first." "Validation is the
differentiator" is an argument to guarantee it works on *real* data — which requires
extraction first, not last. Validation-first optimized for building the impressive part in
isolation (a horizontal-layers instinct), wrong for a one-day, demo-end-to-end build.

**Tradeoffs accepted:** extraction gets built before the differentiator, so it must stay
**thin** — just enough to flow real data and capture fixtures, not gold-plated — so the bulk
of remaining time still goes to the trust engine. Risk if ignored: polishing extraction
starves the differentiator.

**What I deliberately cut:** validation-first ordering; server-side PDF rendering for
extraction; Flash-Lite.

---

## D12 — Direct URL on `config.url`, not `directUrl` (supersedes D10's mechanism)

**The decision:** implement D10's pooled-app / direct-migrations split by setting
`prisma.config.ts`'s `datasource.url` to `process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]`,
and **not** using a `directUrl` field. D10's *intent* stands unchanged; only the mechanism
changes.

**What went wrong with D10's mechanism:** D10 said to add `directUrl` to `prisma.config.ts`.
`prisma db push` accepted it at runtime (it ignores unknown keys), so it looked fine — but
`next build` typechecks `prisma.config.ts`, and the Prisma 7 config type has no `directUrl`
(only `url` / `shadowDatabaseUrl`). The build failed. The skill doc that suggested
`directUrl` was aspirational for this SDK version.

**The reasoning:** in Prisma 7 with a **driver adapter**, there are already two separate
connections: the *app* connects through the adapter (`lib/db.ts`, pooled `DATABASE_URL`,
serverless-safe), and `prisma.config.ts`'s `url` is used *only by the CLI* (migrate / db
push). So the direct connection just goes on `config.url` — the CLI is exactly the thing
that needs it. The Prisma-6 `directUrl` datasource concept is redundant here because the
adapter URL and the CLI URL are already distinct. The `?? DATABASE_URL` fallback keeps the
CLI working if only `DATABASE_URL` is set.

**Why this is a new entry, not an edit to D10:** the decision log records real calls as they
happened, including course corrections. D10 was a genuine (partly wrong) call; D12 is the
correction. Keeping both shows the actual path rather than a tidied-up rewrite.

**Tradeoffs accepted:** none beyond D10's (still one extra env var). Lesson banked: typecheck
config files, don't trust that a CLI accepting a key means it's type-valid.

**What I deliberately cut:** the `directUrl` config field.

---

## D13 — Earned-confidence scoring model (the thesis, made concrete)

**The decision:** per-field confidence is computed by letting **validation rules dominate**
the model's self-report, not by averaging them. Concretely, for each field:
- **Missing required field** → confidence `0`, flagged "required field missing".
- **Participates in a FAILED rule** → confidence floored **low (≤ 0.3)** and the rule's
  human-readable message attached as a flag. A failure wins regardless of how confident the
  model was.
- **All participating rules PASS** → confidence **high (≥ 0.9)**: arithmetic corroboration
  (sums, tax math, checksum) is strong evidence, so it outranks the model signal.
- **No rule can verify the field** (e.g. `vendorName` has no arithmetic check), rules are
  **NA** → fall back to a **damped** model confidence (`modelConfidence × 0.7`, capped ~0.7)
  and mark it "unverified". Never "high" on model signal alone.

UI buckets: high ≥ 0.8 · medium 0.5–0.8 · low < 0.5. Money comparisons use a small absolute
tolerance (0.02) plus a relative allowance for tax rounding.

**The alternatives:**
- **Weighted average of model confidence and a rule score** — rejected: averaging lets a
  confident model *mask* a rule failure (0.95 model + 0.1 rule ≈ 0.5 "medium"), exactly the
  theatre D2 rejects. A failed arithmetic check must floor the field, not dilute.
- **Rules-only, ignore the model** — rejected: fields with no arithmetic rule (vendor name,
  invoice number) would have no signal at all. The model is a *fallback* for the unverifiable,
  explicitly damped and never promoted to "high".
- **Trust the model's self-reported confidence** — rejected in D2; restated here as the
  scoring rule that model-alone caps at "medium/unverified".

**The reasoning:** this is D2 turned into arithmetic. "Confidence earned by validation, not
claimed by the model" only means something if a rule failure *overrides* a confident model
and an unverifiable field can't reach "high". Flooring on failure and capping on
model-only signal encode exactly that; corroborated fields earn their high score.

**Tradeoffs accepted:** the thresholds (0.3 / 0.7 / 0.9, 0.02 tolerance) are chosen, not
learned — reasonable defaults for a demo, tunable later. Fields with no rule can only ever
be "medium", which is correct (we genuinely can't verify them) even if it looks
conservative.

**What I deliberately cut:** averaging/weighted-blend scoring; model-self-report as a path
to high confidence; learned/estimated thresholds.

---

## D14 — Trust is a server-enforced human gate; trust state derived, not stored

**The decision:** "trusted" is a deliberate **human** status transition, and the gate is
enforced **server-side**: `POST /api/invoices/:id/trust` recomputes the open flags from the
stored per-field trust JSON and returns `409` if any flag is open — it does not just hide
the button in the UI. The gate condition (`canTrust`, `openFlags`) is **derived on read**
from the per-field flags (via `toView`), not persisted as its own column.

**The alternatives:**
- **UI-only gate** — grey out the button when flags are open, but let the API set
  `trusted` unconditionally. Rejected: trust is the whole product; a client-only check is
  bypassable (curl the endpoint) and would let an untrustworthy invoice be marked trusted.
- **Persist an overall `canTrust` / `openFlags` / `overallConfidence` column** — denormalize
  the trust verdict alongside the fields. Rejected as the source of truth: once inline field
  correction (Phase 3) re-runs validation, a stored overall verdict can drift out of sync
  with the per-field flags. Deriving on read keeps a single source of truth (the field
  flags). (A cached column could be added later purely as a query optimization if needed.)

**The reasoning:** the thesis (D2) is that the system won't vouch for numbers it can't
verify. That only holds if "trusted" can't be set while a verifiable check is failing — and
"can't" has to mean server-enforced, not merely unclickable. Deriving the gate from the same
per-field flags the engine produced avoids a second, drift-prone copy of the truth; the
searchable columns (D9) already cover query performance, so there's no need to denormalize
the verdict too.

**Tradeoffs accepted:** recomputing open flags on each read/trust call is a small scan of
the row's JSON — negligible at this scale; if a status filter on "trustable" ever needs to
be fast across many rows, add a cached column then.

**What I deliberately cut:** UI-only trust gating; a persisted overall-trust/confidence
column as the source of truth.

---

## D15 — Function-to-form: the UI stays deliberately plain until the core is done

**The decision:** keep the UI intentionally minimal (plain tables, a couple of colors, no
visual design) while building, and treat UI/UX polish as a **single dedicated pass at the
end**, after the functional core (extraction, trust engine, journey, query, correction) is
working. Function first, form later.

**The alternatives:**
- **Polish as we go** — style each screen when it's built. Rejected: screens are still
  changing (query and inline-correction will add/alter surfaces), so styling now means
  styling twice; and time spent on visuals is time not spent on the differentiator.
- **Ship it plain** — never do a polish pass. Rejected: the brief values execution quality,
  and a finance-trust product that looks unfinished undersells the work; one focused pass is
  worth it.

**The reasoning:** the evaluation weights the trust layer and execution of the hard problem;
a beautiful shell over a shallow core would be the wrong trade on a one-day build. A plain
but honest UI that clearly surfaces confidence, flags, and the trust gate communicates the
thesis fine. Polishing once at the end means styling the *final* set of screens together
(consistent look) rather than repeatedly restyling moving targets. The build owner is a
frontend engineer (5 yrs), so the form pass is low-risk to defer — it's the comfortable part.

**Tradeoffs accepted:** interim demos look bland; if the deadline is hit before the polish
pass, the UI ships plain — an acceptable failure mode since the substance is the trust core,
not the chrome.

**What I deliberately cut:** per-screen styling during the build; any UI framework/design
system work before the core is complete.

---

## D16 — Query as URL-param filters over indexed columns, server-rendered (implements D4)

**The decision:** implement the structured query (D4) as a plain GET filter form whose fields
live in the URL search params (`?vendor=&status=&minTotal=&maxTotal=&from=&to=`), read by the
`/invoices` server component, turned into a Prisma `where` by a pure `buildInvoiceWhere`, and
run against the **indexed searchable columns** from D9. Filters compose (AND); `vendor` is a
case-insensitive contains, `total` a numeric range, `invoiceDate` a date range, `status` exact.

**The alternatives:**
- **Client-side filtering** — fetch all rows, filter in the browser. Rejected: doesn't scale,
  and it isn't a real query — the point of D4/D9 is genuine indexed DB filtering.
- **A separate `/api/invoices` GET + client fetch/state** — more moving parts than needed;
  the server component can query directly and render.
- **Natural-language query now** — still cut (D4): even the stretch NL version must resolve to
  a structured query with exact rows and never let the model narrate numbers. The structured
  form *is* that resolved query, shown explicitly in the URL — so it satisfies D4's core and
  keeps the trust invariant (no model in the query path).

**The reasoning:** URL params make every query shareable, bookmarkable, and reload-safe with
zero client state, and the resolved filter is visible in the address bar — literally "the
query it ran," which is exactly D4's "resolved query → exact rows" property. Filtering maps
1:1 to the D9 indexed columns, so this is the payoff of that denormalization: trivial, fast,
honest SQL with no JSON gymnastics and no model involvement.

**Tradeoffs accepted:** `total` uses the parsed numeric column, so rows whose total didn't
parse (null) won't match amount filters — acceptable; an unparseable total is a
low-confidence field anyway. Pure server-render means each filter change is a round trip (no
instant client filtering) — fine and simpler at this scale.

**What I deliberately cut:** client-side filtering, a dedicated query API endpoint, and
(still) natural-language query.

---

## D17 — Inline correction re-validates the whole invoice; a human edit counts as verification

**The decision:** editing any single field re-runs the full validation pass over the whole
invoice (not just the edited field), because the rules are cross-field. A human-edited field
is marked `corrected` and treated as **human-verified**: for a field no rule can check
(vendor name, invoice number) the correction earns high confidence instead of the damped
model score; for a field a rule *can* check, the arithmetic/checksum still runs and can still
flag the corrected value. Corrections persist (the `corrected` marker is stored), and the
trust gate (D14) re-evaluates from the fresh flags.

**The alternatives:**
- **Re-validate only the edited field** — rejected: rules are cross-field. Fixing `subtotal`
  changes the line-items-sum and subtotal+tax=total checks, which touch `total` and
  `taxAmount`. Scoring one field in isolation would leave stale flags on the others.
- **Trust the human edit unconditionally** (force the field valid) — rejected: a human can
  mis-type too. Arithmetic must still check a corrected value; correction changes the
  *value*, it doesn't switch off validation. Human-as-verification applies only where no rule
  exists to check.
- **Recompute nothing; let the user also clear flags manually** — rejected: that makes trust
  a manual assertion again, the opposite of D2/D14.

**The reasoning:** this closes the trust loop the thesis promises — "messy in → correct →
re-validate → trustworthy." Re-running the whole pass keeps every dependent flag honest after
an edit. Counting a human edit as verification for otherwise-uncheckable fields is right
because an explicit human correction is stronger evidence than a model guess — while still
letting arithmetic overrule a human who fixes a value wrongly. The result: fix the bad GSTIN
→ checksum passes → flag clears → gate opens; fix it wrongly → checksum still fails → still
blocked.

**Tradeoffs accepted:** a full re-score per edit (cheap — pure functions over one invoice).
`modelConfidence` is dropped for a corrected field (there's no model signal for a human value)
— the `corrected` marker records provenance instead.

**What I deliberately cut:** single-field re-validation; unconditional trust of human edits;
manual flag-clearing.

---

## D18 — Deploy posture: public demo URL, no auth, synthetic-invoices-only disclaimer

**The decision:** deploy to Vercel as a public, unauthenticated demo URL. Add a visible
disclaimer in the UI telling users to upload sample/synthetic invoices only, not real
confidential financial documents. No login, no per-user data isolation, no rate limiting
beyond what Gemini's free tier already enforces.

**The alternatives:**
- **Password-gate the deploy** (Vercel deployment protection) — adds friction for a reviewer
  who just wants to click a link and try it; the brief already frames this as a reviewable
  demo, not a product with real users.
- **Add real auth (D1 already cut this)** — out of scope for the same reason D1 cut
  auth/multi-tenant: it's depth we'd be trading away from the trust core for breadth that
  doesn't serve the thesis.
- **Skip deploy entirely, rely on local `pnpm dev`** — rejected: a live URL is the highest-
  leverage thing for a reviewer cloning tomorrow; it proves the app runs outside my machine
  and removes "does the setup even work" as a risk.

**The reasoning:** this is the D8 data-use constraint amplified by publicness — anyone who
finds the URL can upload a file, and Gemini's free tier may use that data to improve
Google's models (D8). A private, single-developer demo already carried that risk implicitly;
a public URL makes it explicit, so the disclaimer needs to be visible on the page itself, not
just in `decisions.md`. No auth is consistent with D1's explicit scope cut and doesn't need
re-litigating — it's a consequence of that decision, not a new tradeoff being introduced now.

**Tradeoffs accepted:** anyone with the link can upload data (subject to the same free-tier
training risk as D8), and there's no isolation between uploads — all invoices land in one
shared list. Acceptable for a time-boxed evaluation demo; would need auth + per-tenant data
before any real use.

**What I deliberately cut:** deployment protection/password gate; real authentication;
per-user data isolation.

---

## D19 — Deploy now (mid-build), not after the feature set is complete

**The decision:** connect to Vercel and get a live URL now, while inline correction is the
most recently finished piece and the fixture suite / provenance / UI polish are still
outstanding — rather than waiting until every planned feature is done and locally verified.

**The alternatives:**
- **Deploy last** — finish and locally test the full feature set (provenance, fixture suite,
  UI polish), then deploy once at the very end, right before the deadline.

**The reasoning:** deploy environments differ from local in ways that only surface once
deployed — already hit one (the generated Prisma client isn't committed, so Vercel needed a
`postinstall` hook to run `prisma generate`, see the commit right before this). Other
platform-specific risks are still unverified: serverless function timeout limits (Gemini
extraction takes ~15s), env var wiring, Node runtime behavior. Deploying now, with a full
day of runway left, means any such bug is caught and fixed while there's still time — not
discovered at 11pm before the deadline with no buffer. The cost of deploying now is small:
once the GitHub repo is connected, Vercel **auto-deploys on every push to main**, so this
isn't "redeploy repeatedly" as a manual task — it happens for free while local development
continues as the primary loop.

**Tradeoffs accepted:** the live URL will show an incomplete feature set for a while (no
provenance, unpolished UI) until later work lands — acceptable since it's a parallel safety
check, not the thing being evaluated yet. Vercel's GitHub connection means every future
commit is public near-instantly, including any in-progress or broken states between commits
(mitigated by only pushing commits that pass build + tests locally first, which has been
the practice throughout).

**What I deliberately cut:** waiting to deploy until the entire feature set is locally
verified.

---

## D20 — Normalize currency symbols to ISO codes before validating (real-user-data finding)

**The decision:** add `normalizeCurrency()` mapping common currency symbols/entities (`₹`,
`$`, `€`, `£`, `¥`, `Rs.`) to their ISO 4217 code before the currency-known rule checks it,
so a real invoice that renders the symbol instead of the code (`₹` vs `INR`) is recognized
correctly rather than flagged as invalid.

**The alternatives:**
- **Leave it as a false-positive flag** — rejected: it's not a real invoice defect, it's a
  gap in the rule's recognition. A trust system that cries wolf on valid data erodes the
  credibility of every other flag it raises — the opposite of the thesis (D2).
- **Widen `KNOWN_CURRENCIES` to include symbols directly** — rejected: symbols and codes
  aren't equivalent values (multiple symbols can map to the same code, e.g. Rs./₹ → INR),
  and the rest of the system (display, comparisons) should work off one canonical
  representation. Normalizing once, then checking against the ISO set, keeps that single
  source of truth.

**The reasoning:** discovered by testing against a real personal invoice (the user's own
Jio phone bill, uploaded to local dev only, not the public deploy) — Gemini extracted the
currency as the rupee *symbol*, not the ISO code my synthetic fixture always used as literal
text. This is the D11 thesis playing out a second time: real data surfaces gaps a
hand-authored fixture can't. Every other field on that real bill scored exactly as designed
(dates/subtotal/tax/total verified via arithmetic; vendor/invoice-no correctly capped at
medium as unverifiable) — only the currency symbol was a genuine engine gap, not a false
"working as intended."

**Tradeoffs accepted:** the symbol map is a fixed, manually curated list — an obscure
currency symbol not in the map still gets correctly flagged as unrecognized (a real
degradation, not a false positive, so acceptable).

**What I deliberately cut:** widening the known-currency set to include raw symbols instead
of normalizing to one canonical code first.

---

## D21 — Never persist a real user's uploaded document; provenance runs on my own samples only

**The decision:** a real user's uploaded invoice is **never persisted** anywhere — file
bytes are used only in-memory for the Gemini extraction call, then discarded, exactly as
today. If/when provenance (click a field → highlight its source on the document) is built,
it demos against a small set of **my own synthetic sample invoices**, stored once by me
(Postgres `Bytes`/`bytea` column, not Vercel Blob — see reasoning). The "upload your own
invoice" flow and the "see provenance in action" flow are kept as two separate paths on
purpose, so they never share a file.

**Production note:** a real financial platform would normally retain the source document —
usually in encrypted object storage — to support audits, regulatory retention requirements,
dispute resolution, and reprocessing if extraction logic changes later. That retention is
justified there by controls this deployment doesn't have: access control, audit logging, and
often contractual or regulatory obligations. I'm deliberately departing from that default
here because this is a public, unauthenticated assessment deployment without those controls
— not because retention is the wrong choice in general.

**The alternatives:**
- **Store every upload in Vercel Blob to enable provenance for any file** — this was the
  original plan (plan.md's stack table, and the direction D11 deferred). Rejected once
  actually reasoned through: a real person's document would then remain accessible under my
  storage credentials until explicitly deleted — a bigger, more concrete exposure than the
  transient Gemini-inference risk already accepted in D8/D18. Asking an anonymous visitor to
  trust an unaudited, single-operator deployment with a persistent copy of their real invoice
  is a reasonable basis for them to decline, and it's a disproportionate ask in exchange for
  demonstrating a single UI capability.
- **Same idea, but store in Postgres instead of Blob** — considered as a pure storage-tech
  swap. Correctly identified as **not fixing the actual problem**: whether the file lives in
  Blob or in the database, it's the same category of exposure (persisted under my control).
  Swapping storage backends was a red herring for the trust question, though it's still the
  right call for the *separate* question of where to keep files I do choose to persist (see
  below).
- **Add a manual "delete my file" button / short TTL on Blob** — rejected as a mitigation,
  not a fix: it still requires trusting that I've implemented and honored it correctly, and
  still means the file existed on someone else's infrastructure in the meantime. Simpler and
  stronger to just never store it.

**The reasoning:** this comes down to data minimization — keep only the data a feature
actually needs, and extraction only needs the file transiently, not permanently. Given that,
the right default is not retaining the document at all, regardless of who's operating the
system. Encryption at rest is a mitigation for a file I've *already decided* to keep; it
doesn't answer whether to keep it in the first place. In this deployment specifically
there's also no separation between the person who'd implement that encryption and whoever
could invoke decryption — a gap an organization's access controls would normally close —
which is a supporting reason encryption isn't a substitute for minimization here, not the
main reason minimization is right. Splitting "extract from *your* file" (ephemeral, as now)
from "see provenance on *my* file" (a canned example I already own and chose to share)
preserves the differentiator (provenance) without asking a stranger to trust me with their
real data long-term. This eliminates the retention risk outright rather than mitigating it —
a stronger property than any partial control like a TTL or delete button.

**Why Postgres over Blob for the sample files specifically:** no second external service or
signup; deleting the sample invoice's row also deletes its file — no orphaned files
requiring separate cleanup or lifecycle tracking — genuinely simpler, independent of the
trust question above.

**Tradeoffs accepted:** provenance can only ever be demonstrated on my pre-chosen sample
invoices, never on whatever a visitor happens to upload — a real limitation on the "wow"
factor of a live demo, accepted because the alternative asks something of users the product
shouldn't ask.

**What I deliberately cut:** persisting any real user's uploaded document in any storage
backend; TTL/delete-button mitigations as a substitute for not storing it at all; Vercel Blob
for the sample-file storage (kept the file-hosting decision in Postgres instead).

---

## D22 — Considered encrypting the retained sample invoices, decided not to implement it

**The decision:** I looked at encrypting the sample-invoice bytes at rest (AES-256-GCM, a
key from an env var, decrypt on read) once D21 settled that a small set of my own sample
invoices would be stored for the provenance feature. After pressure-testing it against the
actual threat model, I'm **not implementing it** — I'm documenting it here as a recognized
gap instead of building a hollow version of the control.

**The alternatives:**
- **Implement AES-256-GCM encryption on the sample invoice bytes** — the original plan.
  Rejected: see reasoning below.
- **Implement it, log it, and call it done** — rejected as dishonest engineering: doing work
  because it "sounds like good security practice" without it addressing a real threat is
  exactly the checkbox-security instinct I want to avoid in this project.

**The reasoning:** the data this would protect is my own invented sample invoices — fake
vendor, fake GSTIN, fake amounts. Encrypting them protects nothing real. Worse, the more
sensitive data in this system is the *extracted fields* from real user uploads (vendor
names, GSTINs, amounts, dates), which per D9 are stored as indexed, searchable, plaintext
columns for every real invoice, indefinitely — D21 only stops the raw *file bytes* from
persisting, it says nothing about the structured data pulled from them. Encrypting the
sample files while that stays in plaintext protects the least sensitive thing in the
database and leaves the most sensitive thing untouched right next to it — that's not a
threat model, that's decorating a decoy. It also doesn't move the needle on user trust: a
reviewer's actual concern is their own upload, and that's already fully resolved by D21 (it
was never stored in the first place); encrypting my sample data touches none of the data
path a real upload travels through. In production, encrypting retained financial documents
is clearly the right call, because what's retained there is real. Here, applying a
production-grade control to a non-production-grade asset just to have built it is
cargo-culting the form of a security practice without the risk that justifies it.

**Tradeoffs accepted:** the extracted structured fields from real uploads remain unencrypted
in Postgres, which is the actually-relevant gap this exercise surfaced — noted here as a
real, honest limitation rather than solved by the wrong fix. If this became a genuine
production system, encryption at rest would apply to *that* data (and to any retained
documents), with proper key management and access control — consistent with the Production
note in D21.

**What I deliberately cut:** implementing encryption for the sample invoice files; treating
"I added a crypto function" as equivalent to "I reduced a real risk."

---

## D23 — Store sample-invoice bytes as base64 text, not a native `Bytes` column

**The decision:** implementing provenance (D21) needed to persist the seeded sample
invoices' PDF bytes. `fileData` is a plain `String` column holding base64, not Prisma's
native `Bytes` type — encoded on write, decoded on read.

**The alternatives:**
- **`Bytes` / Postgres `bytea` (the obvious choice)** — this was the original plan. Tried
  it first; it broke.

**The reasoning:** with `Bytes`, writing worked (a raw SQL `octet_length()` check confirmed
the correct byte count, 1704, actually landed in Postgres), but every typed read
(`prisma.invoice.findFirst`, etc.) threw `Expected a byte array in column 'fileData', got
object: %PDF-1.3...` — Prisma's client couldn't deserialize the bytea value the `pg` driver
adapter (`@prisma/adapter-pg` 7.9.0) handed back into a proper `Buffer`. Confirmed with raw
SQL that the data itself was intact, so this is a real gap in this adapter version's binary
type handling, not corrupted data or a mistake in my write path. Rather than spend the
remaining time chasing an adapter-internals bug, I moved the PDF to base64 text — a
`String` column is unambiguous across every driver and adapter, sidesteps the broken binary
mapping entirely, and costs a well-known, bounded ~33% size overhead, which is negligible
for invoice-sized PDFs.

**Tradeoffs accepted:** ~33% larger storage for the sample files; one extra
encode/decode step in `storeSampleInvoice` and the file-serving route. Both trivial at this
scale (a handful of KB-sized sample PDFs).

**What I deliberately cut:** debugging further into `@prisma/adapter-pg`'s bytea handling,
or pinning/downgrading the adapter version to find one without the bug — not worth the time
against a one-line, fully verified workaround (confirmed byte-for-byte round-trip against
the original file).

---

## D24 — Three curated samples, hand-authored ground truth, clearly badged in the UI

**The decision:** expand the seeded sample set from one to three, each demonstrating a
distinct trust outcome: `invoice-01` (invalid GSTIN, from the real Gemini extraction, D11) —
unchanged; `sample-clean` (every check passes, immediately trustable) and `sample-mismatch`
(subtotal + tax ≠ total, blocks trust) — both new. For the two new samples, I generated a
real PDF (pdfkit) but **hand-authored the extracted JSON** as the ground truth fed into
`scoreInvoice`, rather than running another live Gemini call. Every sample also gets a
visible **"📄 sample"** badge — on the invoices list and the detail page — wherever
`fileData` is present, so a reviewer can never mistake a curated example for a real
submission.

**The alternatives:**
- **Run live Gemini extraction on the two new PDFs too** (matching how `invoice-01` was
  captured) — rejected for these two specifically. Real extraction is non-deterministic
  enough that I couldn't *guarantee* "clean" reads as fully clean or "mismatch" trips
  exactly the intended rule — and that reliability is the entire point of these two
  samples. `invoice-01` already proves real-extraction quality (further reinforced by the
  real bill test in D20); these two exist to reliably demonstrate the *rules engine's*
  designed behavior, a different job better served by deterministic ground truth.
- **A 4th sample specifically for "missing/invalid field"** — rejected: `invoice-01`
  already demonstrates this outcome (its GSTIN checksum fails), so a new file would be
  redundant. Reusing it keeps exactly one sample per requested outcome.
- **No UI marking, rely on `hasDocument` alone as an implicit signal** — rejected: a
  reviewer clicking through invoices has no reason to know that "has a document preview"
  means "curated by me," and that context matters for interpreting the results correctly.

**The reasoning:** hand-authoring these two fixtures still exercises the exact same code
path as everything else (`parseExtraction` → `scoreInvoice` → `storeSampleInvoice`) — the
"decision" here is only about *which extraction produced the input JSON*, not about
special-casing the samples in the app. I verified each hand-authored fixture against its
intended outcome with dedicated tests before seeding, the same discipline used everywhere
else in this project (see `tests/fixture-samples.test.ts`). One thing the test caught: my
first assumption that a `total` mismatch would flag only the `total` field was wrong — the
`total.sum` rule correctly floors *all three* fields it touches (subtotal, tax, total),
since the engine can't know which number is actually wrong. That's the rule engine behaving
correctly; I fixed my test expectations, not the app.

**Tradeoffs accepted:** the two hand-authored samples' bboxes are pdfkit-line-derived
estimates (tracked real y-positions, full-line-width x-ranges), not pixel-perfect per-value
extraction like Gemini would produce — good enough to land the provenance highlight over
the correct line, not tuned to word-level precision. Acceptable since the goal is
demonstrating the provenance *concept* reliably, not re-proving extraction fidelity
(already proven elsewhere).

**What I deliberately cut:** a 4th sample invoice; live Gemini extraction for the two new
fixtures; leaving the samples visually indistinguishable from real submissions.

---

## D25 — Fixed provenance highlight misalignment; overlay uses % not px; adopted Playwright

**The decision:** the click-to-highlight overlay (D-provenance feature) was landing on the
**wrong location** on the document — the user caught this by testing manually and called it
out hard, correctly, as a trust-breaking bug rather than a cosmetic one. Root cause: the
overlay's position was computed in pixels against the canvas's *native* render resolution
(918×1188, from `page.getViewport({scale: 1.5})`), but the canvas is displayed on-screen at
a smaller CSS size (`max-w-full` shrinks it to fit its column — verified at 404×522, ~44% of
native). Pixel offsets computed for one scale, placed inside a container at another scale,
landed proportionally wrong. Fixed by switching the overlay to **percentage-based**
positioning: since the bbox is already normalized 0–1000 (already a fraction of the page),
`top/left/width/height` as `%` strings track whatever size the canvas actually renders at,
regardless of any CSS scaling — eliminating this entire class of bug rather than patching
the specific scale mismatch.

**The alternatives:**
- **Fix the pixel math to also account for the canvas's displayed size** (read
  `canvas.getBoundingClientRect()` and rescale) — works, but adds a resize-tracking layer
  (window resize, layout shifts) that percentages get for free from the browser's own
  layout engine. More code for a strictly worse guarantee.
- **Force the canvas to always render at its displayed size 1:1** (drop `max-w-full`,
  render at whatever CSS size the container allows) — rejected: couples the render
  resolution to layout, and would need re-rendering the PDF on every container resize.

**Why I initially missed this:** I "verified" the provenance feature earlier using `curl` —
checking that a `<canvas>` element and some expected text existed in the raw HTML. That
proves the server rendered *something*; it says nothing about where a client-side JS-drawn
overlay ends up positioned after browser layout, since that only exists post-hydration and
isn't in the HTML `curl` sees at all. This was a real verification gap: for anything
involving CSS positioning or client-side layout, checking that markup exists is not the same
as checking that it displays correctly.

**The reasoning:** an overlay claiming "this is where I read that value from," while
visually pointing at the wrong part of the document, is worse than having no provenance
feature at all — it's a false claim asserted with visual confidence, which actively erodes
trust rather than building it. That risk is exactly why the user's reaction ("folks wont
trust") was the right reaction, not an overreaction.

**What changed as a result — adopted Playwright for this class of verification:** installed
`playwright` (dev dependency) to render the actual page in a real headless browser and read
back `getBoundingClientRect()` on both the canvas and the overlay, computing the
mathematically-expected overlay position from the bbox and the canvas's *actual* displayed
size, and asserting the two match — not eyeballing a screenshot, computing the geometry.
Confirmed correct on the exact three fields (Vendor, GSTIN, Subtotal) the user's screenshots
showed as broken, both via this geometric check and via saved screenshots.

**Tradeoffs accepted:** `playwright` plus its Chromium binary is a non-trivial dev
dependency (~100MB+) for a project this size — accepted because "does this pixel-level UI
behavior actually work" is a category of question `curl`/unit tests structurally cannot
answer, and this bug is proof that skipping it has a real cost.

**What I deliberately cut:** patching only the specific scale-mismatch math instead of
switching to percentages (would still be pixel-brittle to some other future scale change);
continuing to rely on `curl`-based checks for anything with client-side visual positioning.

---

## D26 — UI polish gets a dedicated pass now; evals continues as an ongoing thread

**The decision:** start the UI/UX polish pass (planned in D15) now, treating validation
strengthening (a growing eval/fixture suite) as an ongoing effort picked up alongside or
after, rather than a gate UI has to wait behind.

**The alternatives:**
- **Finish evals first, then do UI** — the naive "most important thing first" ordering.
- **Interleave both continuously from here on**, with no dedicated focus on either.

**The reasoning:** validation strengthening is open-ended by nature — there's always another
messy invoice format or edge case to add, so it has no natural finish line. Gating a
*finite*, boundable task (restyle the core pages to a consistent, non-generic look) behind
an *infinite* one means the finite task never starts. This is also exactly the moment D15
planned for: "function first, form later, one dedicated pass after the core is done." The
core is genuinely done now — extraction, trust engine, journey, query, correction,
provenance, three curated samples, a live deploy, and a real bug caught and fixed (D25) —
so this is that pass, not a detour from it.

**Tradeoffs accepted:** validation work pauses (or slows) while UI gets focused attention;
mitigated by treating it as "continues alongside/after," not "abandoned" — nothing about
this decision closes the door on adding more fixtures or tightening rules later.

**What I deliberately cut:** finishing the eval/fixture suite before starting any UI work.

---

## D27 — UI polish pass: warm design-system tokens, Tailwind inherited (not chosen), shared header

**The decision:** executed the D26 polish pass as one connected set of calls: (1) kept
Tailwind CSS as the styling approach — it shipped as part of `create-next-app`'s default
scaffold when D5 picked Next.js, so it was never separately evaluated against CSS Modules,
plain CSS, or styled-components in a side-by-side sense, but keeping it was still the right
call on its own merits: utility classes colocated with markup are faster to write and change
than hand-rolled CSS or CSS Modules (no context-switching to a separate stylesheet, no
inventing class names, no dead-CSS accumulation as screens change), and flexible enough to
express the whole warm-palette token system below without fighting the tool. For a solo
build under time pressure, that combination of speed and flexibility mattered more than
"CSS Modules give you real scoping" or "plain CSS has no build step" — neither alternative
would have gotten the same ground covered as fast. (2) Tailwind v4 (shipped with this Next.js version) moved
config from `tailwind.config.js` to a CSS-first `@theme`/`@theme inline` block inside
`globals.css` — a real mechanical difference from the v3 most engineers expect, worth
stating since it shaped how the token system below got built. (3) built a warm cream/rust
palette (light + dark, switched via `prefers-color-scheme`, no manual toggle) as semantic
CSS variables (`--background`, `--surface`, `--foreground`, `--muted`, `--border`, `--accent`
+`-hover`/`-foreground`, `--success`/`--warning`/`--danger` +`-bg`) mapped into Tailwind's
theme. (4) deliberately kept the accent color (rust/orange — buttons, links, action) in a
different hue family from the confidence colors (green/amber/red — success/warning/danger),
so a decorative action color can never be mistaken for a trust signal. (5) replaced each
page's own repeated back-link/nav text with one shared `AppHeader` component. (6) recolored
the provenance click-to-highlight overlay from amber to accent, since D25 built it against
generic amber, but a *selection* highlight isn't a trust signal — it's an interaction state
— so it belongs in the accent family, and this also visually ties the highlighted table row
to its highlighted region on the document image.

**The alternatives:**
- **CSS Modules / plain CSS / styled-components** (for #1) — Tailwind arrived for free with
  the scaffold, but staying with it was also a real call: CSS Modules mean a separate `.module.css`
  file per component, hand-written class names, and constant back-and-forth between markup
  and stylesheet to change one style; plain CSS is worse at that scale and starts colliding
  on class names without a convention; styled-components adds a runtime and build-step cost
  for something Tailwind gets for free. None of them argued strongly enough for switching
  away from the scaffold default.
- **`tailwind.config.js`** (for #2) — not actually an alternative, just what I'd have
  defaulted to from memory if I hadn't checked; Tailwind v4's CSS-first config is the only
  supported path here, not a competing option I turned down.
- **Cold corporate gray/blue, or the generic "AI aesthetic" default (purple/indigo,
  gradients, rounded-2xl everywhere)** (for #3) — rejected per the `agent-skills`
  frontend-ui-engineering guidance loaded for this pass: those patterns read as generic/
  AI-generated, and a finance-trust product benefits from feeling deliberately made, not
  templated.
- **Reuse the confidence-color palette for accent too** (for #4) — rejected: a single hue
  family carrying both "this button does something" and "this field failed validation"
  would blur the exact distinction D2/D13 depends on.
- **Keep each page's own local nav links** (for #5) — rejected: redundant once a global nav
  exists, and inconsistent (some pages had "+ Upload", others "← All invoices", not a shared
  pattern).
- **Leave the overlay amber** (for #6) — rejected once the accent/confidence hue split (see
  #4) was decided; amber is now reserved for warning-severity trust signals, so a selection
  highlight sharing that hue would misuse the same signal.

**The reasoning:** D15/D26 deferred visual design to one dedicated pass after the functional
core was done; this is that pass, executed as a coherent set of token-level decisions rather
than ad hoc page-by-page styling, so every screen reads as one system instead of six
independently-styled ones. The bigger, more honest point is #1/#2: not every technical
choice in this project was a deliberated tradeoff — some (Tailwind, its v4 config model) were
inherited defaults from the scaffold, and this log is more useful being explicit about which
decisions were actually weighed versus which were just accepted as-is.

**Tradeoffs accepted:** Tailwind and its v4 config model were never pressure-tested against
alternatives in a formal side-by-side — the case for keeping it rests on general
speed/flexibility reasoning, not a documented comparison specific to this project's needs.
If that turns out to be the wrong call later, there's no prior analysis to revisit beyond
what's written here. The accent/confidence hue split adds a rule
future styling work has to remember and respect (don't reach for amber/green/red for anything
that isn't a trust signal).

**What's still open, not yet decided:** whether the "sample"/"edited" tags (currently
accent-tinted) should move to a neutral/gray treatment instead, since they're informational,
not clickable, and currently share a hue with real action links — flagged during review, no
call made yet. Also open: the flags-column wall-of-text layout, low-contrast disabled-button
states, and a missing focus-visible ring on header nav links — all raised as findings, none
turned into a decision or a fix yet.

**What I deliberately cut:** re-evaluating Tailwind or its config model against alternatives
at this stage (accepted as inherited); a manual light/dark toggle (system-preference-only,
per earlier scope call); reusing confidence colors for decorative/action UI.

---

## D28 — UI polish, round two: self-critique against real screenshots before committing round one

**The decision:** before committing any of D27's work, ran a second pass — reviewed the
actual rendered pages (screenshots of upload, invoices list, invoice detail) as a UI/UX
designer would, on top of the earlier Playwright check that only confirmed computed colors/
fonts matched the design tokens. That review surfaced concrete, fixable problems D27's token
layer didn't touch: a validation-flag message wrapping into a wall of text inside a table
cell; a disabled "Mark trusted" button too low-contrast to read; the browser's default blue
focus outline showing on header nav links (no custom focus style had been added there, only
on primary buttons); the filter form wrapping awkwardly; near-identical table rows with
nothing to anchor scanning; and the "sample"/"edited" tags sharing the accent color with real
action links. Fixing these is round two of the same UI pass, done before anything from round
one gets committed.

**The alternatives:**
- **Commit round one as a checkpoint, fix issues in a follow-up commit** — rejected: nothing
  has been committed yet for this pass, so there's no reason to create a commit that's
  immediately known to have rough edges when the fixes are already identified.
- **Treat the Playwright token check as sufficient sign-off** — rejected: confirming
  `background-color` and `font-family` match the design tokens proves the CSS variables wired
  correctly, but says nothing about whether the resulting page is actually usable — contrast,
  layout wrapping, and a stray focus outline are all invisible to a computed-style diff and
  only showed up once the pages were actually looked at.

**The reasoning:** this follows the standing rule for this project — verify before
documenting, document before committing, nothing pushed without explicit go-ahead. "Verify"
turned out to need two different checks doing two different jobs: Playwright's computed-style
check answers "did the token system wire up correctly," a human/design review answers "is
this actually good UX" — and only the second one catches things like a wall-of-text table
cell or a default browser focus ring clashing with the palette. Treating the first check as
if it were the second would have shipped a rough round one that then needed an obvious
follow-up fix.

**Tradeoffs accepted:** a second review pass before the first commit costs time up front;
accepted because it's cheaper than committing something with known, already-identified rough
edges and fixing it after the fact.

**What I deliberately cut:** committing round one as-is and treating round two as a separate,
later cleanup pass.

---

## D29 — Downloadable sample invoices: a privacy-preserving sandbox, not just a trust demo

**The decision:** added a "Download sample invoices" section to the landing page with 8
curated documents a visitor can download and push back through the normal upload flow —
`clean invoice`, `invalid GSTIN`, `arithmetic mismatch` (the existing 3, D24 — DB-backed,
also link through to their pre-scored detail page), plus 5 new ones covering realistic
document conditions: `scanned copy`, `phone photo`, `stamped/annotated scan`, `multi-page
invoice`, `missing/illegible fields` (new, static files in `public/samples/`, download-only,
no provenance).

**How this got decided — the actual arc, because it moved:** started from a narrower
question ("should users be able to self-test the upload flow?"), framed around a "reviewer"
persona — which was the wrong frame: there are no roles in this app (D18), just one
undifferentiated visitor, so "reviewer" was describing an intent, not a technical distinction.
The real reframe came next: D21 already tells every visitor not to upload their own invoice
because this deployment doesn't retain real financial documents. That instruction is empty
without an answer to "then what *do* I test with?" — so the sample set isn't a bonus demo
feature, it's the other half of D21's privacy stance: don't upload yours, here's a realistic
one instead. Before picking documents, I was asked to first enumerate how real invoices
actually reach a system like this — landed on four independent axes (file format: native PDF
vs scanned-raster vs phone photo vs screenshot; capture quality: skew, glare, low-res,
compression; content messiness: handwriting, stamps, non-standard layout; structural: multi-
page, corrupted/password-protected, wrong doc type) rather than guessing at "messy" in the
abstract. The final 8 were chosen to cover those axes by *combining* them realistically (a
phone photo is rotated *and* glared *and* non-standard, not one variable at a time), not by
producing one narrow fixture per axis.

**The alternatives:**
- **Treat this as a trust-engine demo feature** (my initial framing) — rejected in favor of
  the privacy-sandbox framing: the trust-engine showcase is a real side-effect, not the
  reason this exists.
- **One sample per axis in isolation** — rejected: unrepresentative of how mess actually
  shows up (compounded, not isolated), and would need many more than 8 to cover every axis
  value separately.
- **Include a corrupted/password-protected file** to test graceful failure — left out of
  this batch: that tests error handling, a different property than "does the trust engine
  hold up on real-but-messy input." Kept as a possible separate addition, not mixed in here.
- **Script/guarantee specific validation outcomes for the 5 new samples** (e.g. force sample
  #4 to trip a specific flag, matching how the original 3 were hand-authored, D24) —
  rejected: these exist to represent plausible real documents, not regression fixtures: they
  run through the same live Gemini extraction any real upload would, so whatever confidence/
  flags come back are genuinely earned, not pre-decided. Only the original 3 (D24) still use
  hand-authored ground truth, for a different, already-settled reason.
- **A literal handwriting simulation** (an external handwriting font, e.g. Google Fonts
  Caveat) — considered, then explicitly rejected in favor of keeping the repo fully
  self-contained: no downloaded assets, no new runtime/build dependency beyond what's already
  needed. Replaced with a programmatic low-quality scan carrying a stamp ("PAID") and a
  pen-style annotation (an SVG squiggle path + italic caption) — built entirely from the two
  new devDependencies below, no font files, same "realistic synthetic approximation" standard
  already accepted for the rest of this project's fixtures.

**The reasoning:** this is D21's logic completed, not a new direction — privacy-first (don't
upload real invoices) only holds together if there's a safe, realistic alternative to upload
instead, so the sample set is the sandbox that makes the disclaimer actually actionable. The
two-tier architecture keeps that cheap: the existing 3 already paid for DB storage + hand-
annotated bboxes (D21/D24), so they keep their provenance link; the 5 new ones need none of
that — a plain file in `public/samples/` and the completely ordinary upload path is enough,
since D21 already guarantees a normal upload is never persisted or specially treated either
way.

**Implementation, kept undocumented in caveat-by-caveat detail on purpose (this is a demo,
not a research paper):** added `pdfkit` and `sharp` as devDependencies — build-time-only
asset generation (`scripts/generate-samples.ts`, run once, output checked into
`public/samples/`), not part of the running app. Line-item math, tax, and a real GSTIN
checksum (reusing `gstinCheckDigit` from the validation engine itself) are all internally
consistent in every sample — nothing is planted to fail. `app/page.tsx` became an async
server component (queries the 3 seeded sample IDs) rendering a new `DownloadSamples` section
and an extracted `UploadForm` client component (previously all one client component).

**Tradeoffs accepted:** the 3 raster-distorted samples (scanned, phone-photo, stamped-scan)
are noticeably larger files (1.6–1.9MB) than a real scan/photo would need to be, since they're
generated at print resolution without final-pass compression tuning — acceptable for a demo
download, not something to optimize further right now. Gemini's read on the 5 new samples is
genuinely unscripted, so a future run could see different flags than whatever a reviewer saw
today — intentional (see reasoning), but worth remembering if this ever needs a stable demo
script.

**What I deliberately cut:** a corrupted/password-protected "does it fail gracefully" sample;
scripting guaranteed outcomes for any of the 5 new samples; any externally-downloaded font or
image asset.

---

## D30 — D29's deploy failed on `next build`'s typecheck; `tsx` had silently let it through

**What went wrong:** pushed D29 without running a production build first — `tsx` (used to
run `scripts/generate-samples.ts` locally, same as `prisma/seed.ts`) transpiles TypeScript
but doesn't typecheck it, so two real type errors in that script never surfaced locally. The
Vercel build ran `next build`, which does full `tsc` typechecking across the project, and
failed: `sharp.Sharp` used as a type (sharp exports `Sharp` as a named type, not a namespace
member) and `sharp({ create: {...} })` missing the `background` field the `Create` type
requires even when generating pure noise.

**The fix:** import `Sharp` as a named type instead of dotting off the default import;
add an explicit (unused, since noise overwrites every pixel) `background` value to satisfy
the type. Both are genuine type corrections, not suppressions — verified by running `next
build` locally end-to-end afterward (compiles, typechecks, generates all routes) before
pushing again.

**Why this is the same lesson as D12, not a new one:** D12 already established "a tool
accepting something at runtime doesn't mean it's type-valid" for `prisma db push` vs `next
build`. This is the identical gap in a different pair of tools (`tsx` vs `next build`) — I
should have run a full production build before pushing D29 and didn't, because the standing
workflow at the time had paused an earlier `next build` for an unrelated reason (checking a
different change was correct first) and I didn't circle back to it before shipping this
batch. Logging as its own entry per this project's practice of recording the real path,
not a tidied-up one.

**What I deliberately cut:** excluding `scripts/` from the typecheck scope as a workaround —
rejected; the actual code had actual type errors, the fix is fixing them, not hiding the
script from the checker.

---

## D31 — Perceived navigation lag: two separate causes, two separate fixes

**The decision:** investigated a report that every click (Upload, Invoices, an invoice
detail) felt slow and non-optimistic. Measured it rather than guessed — timed repeated
requests to `/`, `/invoices`, and `/invoices/[id]` in different orders. The pattern was
identical regardless of which route went first: whichever request was first after any gap
took 800–1200ms; every request right after took 100–290ms. That ruled out a per-route code
problem (it wasn't the home page's query, or the detail page's, being slow — it was
*whichever one happened to go first*) and pointed at connection/compute state instead. Root
cause: Neon's free-tier compute auto-suspends after a few idle minutes, and the first query
after suspension pays a wake-up tax. Separately — and independent of that — found there was
no `loading.tsx` anywhere in the app, so React had nothing to show during a navigation's
server round-trip; the screen just sat frozen until the whole thing resolved, which reads as
sluggish even when the underlying request is fast.

**The alternatives:**
- **Upgrade Neon off the free tier** to disable auto-suspend — the direct fix for the cold
  start, ruled out immediately: no spend, explicit constraint.
- **Vercel Cron** to ping a keep-alive endpoint — the obvious "free, built-in" option,
  rejected once checked: Vercel's Hobby plan caps cron jobs at once per day, far too
  infrequent to matter against a ~5 minute auto-suspend window.
- **Do nothing about the cold start, only add `loading.tsx`** — would fix the "feels frozen"
  complaint but leave the actual 800–1200ms wait on the first click after any gap, which is
  most of what was being described.

**The reasoning:** these are genuinely two different problems wearing the same symptom, so
one fix each. For the cold start: GitHub Actions' free scheduled workflows are the only
free-tier option that can actually ping often enough (every 4 minutes, safely inside Neon's
suspend window) — added `.github/workflows/keep-warm.yml` hitting a new trivial `GET
/api/health` route (`SELECT 1`, nothing else) on that schedule. For the frozen-screen half:
added a `loading.tsx` per dynamic route (`/`, `/invoices`, `/invoices/[id]`), which Next.js
shows instantly via Suspense the moment a navigation starts, filled in once the real page
resolves — no architecture change, just the boundary Next already supports and this app
hadn't been using anywhere.

**Tradeoffs accepted:** GitHub's free scheduled workflows aren't perfectly punctual (can lag
behind schedule under load), so an occasional cold hit is still possible — this cuts the
*frequency* of the cold-start tax sharply, it doesn't provably eliminate every instance of it.
Accepted as the best available zero-cost option; a paid Neon tier remains the only way to
close that gap completely, and that trade is explicitly off the table per the no-spend
constraint.

**What I deliberately cut:** any paid Neon plan change; Vercel Cron as the ping mechanism
(too infrequent on Hobby to help); leaving the cold-start problem unaddressed and only
patching the loading-state half.
