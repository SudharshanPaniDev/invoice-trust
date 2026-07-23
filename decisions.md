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
