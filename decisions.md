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

**Correction, checked against the real run history:** the assumption above — "cuts the
frequency sharply" — turned out to be optimistic, not measured. Pulling the actual workflow
run timestamps (`gh run list --workflow=keep-warm.yml`) showed real gaps of **1–3 hours**
between successful runs, not the configured 4 minutes. GitHub's free-tier scheduler
deprioritizes low-traffic repos' scheduled workflows far more aggressively than the original
"can lag under load" framing implied — this isn't an occasional miss, it's the normal case.
The mechanism still runs and still succeeds every time it fires; it just fires far less often
than intended, so it mitigates less of the cold-start problem than this entry originally
claimed. Correcting the record rather than leaving the overstated claim standing — no code
changed as a result of this correction; a genuinely reliable free fix (e.g. an external
uptime-monitor ping) remains a real option if this needs revisiting later, not implemented
here.

**What I deliberately cut:** any paid Neon plan change; Vercel Cron as the ping mechanism
(too infrequent on Hobby to help); leaving the cold-start problem unaddressed and only
patching the loading-state half; leaving the "cuts the frequency sharply" claim uncorrected
once the actual run history showed otherwise.

---

## D32 — Drop the home page's inline result; redirect to the detail page instead

**The decision:** after a successful upload, `UploadForm` now redirects straight to
`/invoices/[id]` instead of rendering the scored fields inline on the home page. The home
page goes back to being just the disclaimer, the download-samples section, and the upload
form — nothing else.

**What was wrong, caught by actually looking at a screenshot post-upload:** the inline result
sat below the download-samples section (8 rows, added in D29), so it landed below the fold
with no scroll-into-view — a successful extraction gave no visible feedback unless the user
scrolled down and happened to look. Separately, the inline result used the same `ScoredFields`
component as the detail page but never passed `editInvoiceId`, so hovering a value did
nothing — editing only ever worked on `/invoices/[id]`. Both bugs traced to the same root
cause: the home page was maintaining a second, weaker copy of a view `/invoices/[id]` already
did properly (editing, the provenance viewer, the trust gate), and the two had drifted out of
sync.

**The alternatives:**
- **Patch the inline result to parity** — pass `editInvoiceId` through, scroll to it or move
  it above the download-samples section. Rejected: fixes today's two bugs but keeps two
  result views to maintain in lockstep forever, and the inline one would still lack the
  provenance/document viewer `DetailInteractive` provides, so it'd remain a permanently lesser
  copy no matter how much parity work went in.
- **Keep both, but make the inline one clearly explicitly "preview only, edit on the detail
  page"** — rejected: adds an explanation for a limitation that's cheaper to just remove than
  to justify.

**The reasoning:** the app already had a canonical place to view a scored invoice —
`/invoices/[id]` — and the home page's inline result was never more than a preview of it
("open detail →" already existed as an escape hatch). Once the download-samples section (D29)
pushed that preview below the fold, its cost stopped being "a bit redundant" and became "the
thing users actually complained about." Removing it instead of patching it means there's now
exactly one place a scored invoice is ever displayed — same principle this project already
applies to data (D9: one source of truth, not two representations to keep in sync), just
applied to the UI. The `loading.tsx` skeleton added in D31 is what makes the redirect feel
immediate rather than a hard page-load interruption.

**Tradeoffs accepted:** lost the ability to upload another sample without leaving the result
page — minor, the header's "Upload" link is one click away. `UploadResponse` no longer needs
the `scored` payload from the API response, so the client does slightly less work parsing it
(a side benefit, not the reason for the change).

**What I deliberately cut:** patching the inline result for editing/scroll parity instead of
removing it; keeping a "preview" framing to justify the inline view's limitations.

---

## D33 — Added SCOPE.md: the scope was locked early, it just never got its own document

**The decision:** added `SCOPE.md` — a product-level summary of what this system does and
doesn't do (capabilities, functional and non-functional requirements, user journeys,
assumptions), written in the style of a formal FRD. It sits alongside `decisions.md`, not in
place of it.

**Why this needed saying plainly:** the scope itself was never actually undecided — D1 picked
the problem and the depth-over-breadth angle, D3 fixed one document type, D4 fixed query as
core-not-stretch, D9 fixed the data model, D18/D21 fixed the privacy/auth posture. Every
boundary this system has was decided early and deliberately, each with its own reasoning
already on record. What was missing wasn't the scope decision — it was a single place that
states the *outcome* of all those decisions without needing to read 32 entries of narrative
to reconstruct it. `decisions.md` is the journey; nothing in it was ever in doubt by the time
each entry landed, but it's structured as a log, not a summary, so "what exactly is this
system scoped to do" had no single answer to point at.

**The alternatives:**
- **Leave scope living only in decisions.md** — rejected: a reviewer (or me, six months from
  now) shouldn't have to read the whole decision history to answer "what does this product
  actually do." That's a real gap `decisions.md`'s format can't close on its own, regardless
  of how completely it already covers the reasoning.
- **Rewrite decisions.md into a scope doc** — rejected: they answer different questions (the
  *why*, in order, vs. the *what*, once) and collapsing them would weaken both.

**The reasoning:** the two documents are complementary by design, stated explicitly at the
top of `SCOPE.md` — `decisions.md` for why something was built this way, `SCOPE.md` for what
was ultimately built. `SCOPE.md` states plainly that it's retrospective: it did not exist
before or during development, and describes an outcome that was already locked in through
the decisions above, not a plan drafted in advance.

**Tradeoffs accepted:** none — this is pure documentation, no code or behavior changed.

**What I deliberately cut:** presenting `SCOPE.md` as if it were an upfront planning artifact
that preceded the build — it wasn't, and says so.

---

## D34 — Split `TrustBanner` out of `ScoredFields.tsx`; component folder convention stated

**The decision:** moved `TrustBanner` into its own file, `app/_components/TrustBanner.tsx`.
It had been living inside `ScoredFields.tsx` (212 lines, two unrelated components in one
file) since the D27 UI pass — a real single-responsibility violation caught during a direct
self-audit, not by any tooling. Also writing down, for the first time, the component
placement convention this project has actually been following since D27/D29:

- **Shared, cross-route components** (used by more than one page) live in
  `app/_components/` — `AppHeader`, `DownloadSamples`, `ScoredFields`, `TrustBanner`,
  `UploadForm`.
- **Route-specific components** (used by exactly one page/segment) live directly inside
  that route's folder — `DocumentViewer`, `EditableField`, `MarkTrusted`, and
  `DetailInteractive` all live under `app/invoices/[id]/` because nothing outside that
  route uses them.

**The alternatives:**
- **Leave `TrustBanner` where it was** — rejected: it renders a trust-status banner, not a
  field table; bundling it with `ScoredFields` only ever happened because they were built in
  the same pass, not because they're related.
- **One flat `components/` folder for everything, shared or not** — rejected as the
  convention going forward: Next.js's App Router colocation (route-specific components live
  next to the route that uses them) is a legitimate, recommended pattern, not a shortcut, and
  it already matches what four of this project's components were doing without anyone having
  stated it as a rule.

**The reasoning:** this project already had a consistent, defensible component-placement
pattern — it just existed by accident of how each pass was built, not by a stated rule. That
gap is the same shape as D33 (SCOPE.md): the decision was effectively already made, it just
never got written down where someone auditing the codebase could find it. Splitting
`TrustBanner` fixes the one real violation of that pattern that had crept in; stating the
convention here means the next new component has a rule to follow instead of an implicit one
to reverse-engineer from existing files.

**Tradeoffs accepted:** none — pure refactor, one import path updated
(`app/invoices/[id]/page.tsx`), verified with a full production build before committing.

**What I deliberately cut:** a single flat components folder as the "more standard-looking"
alternative — rejected because it would have meant moving four already-correctly-placed
route-specific components for the sake of a convention that isn't actually better here.

---

## D35 — Explain the confidence ceiling instead of leaving 90%/95% looking unresolved

**The decision:** added a one-line legend above the field table ("Confidence caps at 90%
... or 95% ... — hover a badge for why") plus a per-badge `title` tooltip explaining the
specific reason that field landed where it did (rule-verified, human-corrected-unverifiable,
or damped model estimate).

**What prompted it:** after correcting a flagged GSTIN and a vendor name, the user asked why
the invoice still showed 95%/90% instead of something that read as fully resolved. Nothing
was actually wrong — D13 deliberately never lets any field reach 100% (a rule passing today
isn't "certain forever," and a human correction on an unverifiable field is strong evidence,
not proof) — but the UI gave no indication that 90%/95% *is* this system's ceiling, so a
correctly-functioning score looked like an unfinished one.

**The alternatives:**
- **Change the scoring so verified/corrected fields show 100%** — rejected: this would
  reverse D13's actual thesis (nothing is ever asserted as certain) to fix a display problem,
  not a scoring problem. The number was never wrong; the page just didn't explain it.
- **Tooltip only, no legend** — rejected: a tooltip requires knowing there's something to
  hover in the first place. The legend is what a first-time viewer needs; the tooltip is for
  whoever wants the specific reason for one field.

**The reasoning:** this is the same shape of gap as D25 (a real thing was happening
correctly, but nothing made it legible) and D31/D32 (correct-but-silent behavior reads as
broken). The fix here is purely explanatory — no scoring logic changed, only what the UI says
about scores that were already correct.

**Tradeoffs accepted:** none — verified with a full production build; no behavior changed,
only added explanatory text and a `title` attribute.

**What I deliberately cut:** touching the confidence-scoring thresholds themselves (D13
stays exactly as designed) — the fix is communication, not recalibration.

---

## D36 — Added component tests: React Testing Library, on the 4 components worth testing

**The decision:** wrote the first React component tests this project has ever had — 29
tests across `EditableField`, `MarkTrusted`, `UploadForm`, and `ScoredFields` (its
`Confidence`/`confidenceTitle` branching logic and `FlagDisclosure`). Used **React Testing
Library** (`@testing-library/react` + `@testing-library/user-event`), added
`@testing-library/jest-dom`'s matchers via a new `vitest.setup.ts`, and added
`@testing-library/user-event` as a new devDependency (the other two were already installed,
unused, since the project's start).

**Why this needed doing now, and why it hadn't been:** a direct audit found 9 test files
(465 lines) covering the extraction/validation/query logic thoroughly, and zero tests
touching any React component — `@testing-library/react` and `jsdom` were correctly wired
into `vitest.config.ts` from the beginning but never actually used. The tooling readiness
without the tests is itself worth naming honestly: it was set up, then never followed
through on.

**Why React Testing Library specifically, not an alternative:**
- **Enzyme** — effectively unmaintained for current React versions; RTL is the ecosystem
  default now and is what the project's own `vitest.config.ts` (`jsdom` + `@vitejs/plugin-react`)
  was already set up to support.
- **Cypress Component Testing / Playwright component testing** — real alternatives, but
  they run in an actual browser per test, which is slower and heavier for testing component
  *logic and behavior* (does clicking "edit" show an input, does a failed save show an error)
  as opposed to *visual/layout* correctness. Playwright already has an established, different
  job in this project (D25: verifying real browser-rendered CSS positioning) — component
  logic tests and visual-rendering tests are different concerns, and RTL fits the former
  without paying a real-browser cost for every assertion.
- **Testing components via Vitest's default DOM-less mode (no RTL at all)** — would mean
  hand-rolling render/query/cleanup logic Vitest doesn't provide out of the box; RTL is
  exactly the thin layer that turns `jsdom` into something you can query the way a user
  would (by role, by text), which is also why its queries double as a basic accessibility
  check (if `getByRole("button", { name: "edit" })` can't find it, a screen reader probably
  can't either).

**Why these 4 components, not all of them:** `EditableField` (real interaction: edit, save,
cancel, Enter/Escape, error), `MarkTrusted` (disabled-state logic, singular/plural copy,
success/failure), `UploadForm` (just refactored in D32 — redirect-on-success is exactly the
kind of behavior a later change could silently break), and `ScoredFields`'s confidence/flag
logic (the branchy part: verified vs. corrected vs. flagged vs. damped-model-estimate, each
producing different tooltip text per D35). `DocumentViewer` was deliberately left out — it
does real canvas/pdf.js rendering, which `jsdom` cannot execute; that component is already
covered by the Playwright geometric check from D25, the right tool for testing what it
actually does. `TrustBanner`, `Tooltip`, `AppHeader`, `DownloadSamples` were left out as
mostly-static markup with no branching logic worth locking in.

**Tradeoffs accepted:** one new devDependency (`@testing-library/user-event`, ~small). All
87 tests (58 existing + 29 new) and a full production build were run and passed before this
entry was written.

**What I deliberately cut:** testing every component uniformly regardless of whether it has
logic worth protecting; using Playwright/Cypress component testing instead of RTL for
behavior-level assertions; leaving the RTL/jsdom setup installed-but-unused any longer.

---

## D37 — Built and ran a real eval harness; it immediately found a real bug (closes D26)

**The decision:** introduce a repeatable evaluation pipeline for the model-powered extraction
workflow — a way to exercise the real Gemini call (not a mock) against a fixed set of
documents and get back a trustworthy signal on whether the pipeline still behaves correctly,
runnable on demand rather than reconstructed by hand each time the question comes up. This is
the eval-strengthening thread D26 said would continue and then didn't; this closes it with a
real, repeatable mechanism, not another promise.

**The implementation:** `scripts/run-evals.ts` (`pnpm eval`) — a standalone harness, separate
from the deterministic `pnpm test` suite, that runs **live Gemini extraction** against all 8
sample invoices, scores each through the real validation pipeline, and either asserts a known
outcome (the 3 D24 samples, which have a scripted ground truth) or just records what happened
(the 5 D29 samples, which were deliberately built without one — "let the trust engine
evaluate naturally").

**Why a separate eval pipeline?**

`pnpm test` and `pnpm eval` validate different layers of the same system, and conflating them
would weaken both. `pnpm test` (the existing 9 files, 465 lines) validates deterministic
application logic — parsing, rule evaluation, scoring, query building — against mocked model
responses (`GenAILike` in `lib/extract.ts` is built specifically to accept a fake client for
this reason). Given the same input, it produces the same output every time, which is exactly
what a fast, free, CI-safe suite requires.

`pnpm eval` validates something `pnpm test` structurally cannot: whether the complete
AI-assisted workflow — real extraction through real scoring — still behaves correctly against
real documents. That distinction isn't incidental; a mocked client proves the code around the
model call is correct, but says nothing about whether the model itself, on an actual document,
still produces output this system can trust.

Live model calls are nondeterministic (the same document can extract slightly differently
between runs), consume metered API quota (a real constraint, as this entry's D8 correction
shows), and take real wall-clock time (network round-trips, not in-process function calls).
None of those properties belong in a suite that's supposed to run on every commit, fast and
free. Keeping them separate means `pnpm test` stays exactly what CI needs, and `pnpm eval`
stays available as a deliberate, on-demand check of the thing `pnpm test` can't see.

**What it found, on the first real run:** all 4 samples sharing the shared `invoiceSVG()`
generator (scanned, phone photo, stamped scan, multi-page) came back flagged
`vendorGSTIN: GSTIN must be 15 characters (got 14)`. Investigated rather than assumed — this
was a real bug in `scripts/generate-samples.ts` (D29), not an extraction or validation
failure: the fake GSTIN strings were missing the mandatory literal `Z` character the format
requires before the checksum digit (e.g. `"32AABCT1234M1"` is 13 characters where the format
needs 14 before appending the checksum — the `Z` was simply never added). Confirmed by
counting the string, not by guessing. Fixed by appending `Z` to all four base GSTIN strings,
regenerated the affected samples, reran.

**Confirmed, fully — re-run the next day once the daily quota reset:**
- **All 8 samples** now come back clean: `canTrust: true`, zero flags, across clean-invoice,
  invalid-GSTIN, arithmetic-mismatch, scanned copy, phone photo, stamped/annotated scan,
  multi-page, and missing-fields.
- **Multi-page specifically** is worth calling out: 50 fields scored correctly across both
  pages (10 invoice-level fields + line items spanning the page break), confirming multi-page
  extraction actually works end-to-end, not just in theory.
- All **3 scripted regression checks** (clean-pass, invalid-GSTIN, arithmetic-mismatch) passed
  both before and after the fix, on both runs — the product's core trust guarantees hold.
- The initial write-up of this entry honestly flagged 3 of 8 as "not yet reconfirmed" because
  quota ran out mid-run; re-running the next day (quota resets daily) closed that gap for
  real rather than leaving it asserted-but-unverified.

**Correction to D8: the free-tier quota is much stricter than previously stated.** D8 said
"~1,500 requests/day, ~15/min, no expiry." Running the eval twice today (16 real calls) hit a
`429 RESOURCE_EXHAUSTED` — the actual error reports **`limit: 20` requests/day** for the
resolved model (`gemini-3.6-flash`, what `gemini-flash-latest` currently points to), not
~1,500. Whether the model/quota landscape changed since D8 was written, or D8's number was
never accurate for this specific model, the current real number is 20/day — a meaningful
operational constraint for anyone (including a future me) planning to run this eval harness,
or for the live public demo's realistic daily capacity. Recording the actual observed number
here rather than leaving the stale one uncorrected.

**The alternatives:**
- **Only ever test via mocked clients (status quo)** — would never have caught this; the bug
  was in the fixture-generation script, invisible to any test that never calls the real model
  on the real files.
- **Assert a hard pass/fail on the 5 unscripted samples too** — rejected, again: doing so
  would misrepresent documents explicitly designed to have no predetermined answer.

**Tradeoffs accepted:** the eval harness costs real Gemini quota every run (now known to be a
scarcer resource than assumed) and takes real wall-clock time (network calls, not instant);
by design it's excluded from `pnpm test`/CI for exactly that reason.

**What I deliberately cut:** claiming all 8 samples were confirmed fixed before they actually
were — the entry originally shipped with 3 of 8 honestly marked unverified, and was only
updated to "all 8 confirmed" after an actual second re-run proved it, not on the assumption
that the fix would obviously work.

---

## D38 — Route-handler tests for the two claims the product actually rests on

**The decision:** added `tests/trust-route.test.ts` and `tests/correction-route.test.ts` —
the first tests in this project that exercise `POST /api/invoices/:id/trust` and
`PATCH /api/invoices/:id` as HTTP route handlers, not as pure functions. Every existing test
(including the new ones in D36) tests logic one layer below the route — `scoreInvoice`,
`runRules`, component behavior — never the actual request/response contract at the boundary
a real client hits.

**Why this specific gap mattered more than other untested code:** D14's entire claim is that
the trust gate is "server-enforced... not just hidden in the UI" — a claim that's only
actually proven by testing the route itself returns 409 when flags are open, independent of
whatever the client sends or omits. Same for D17: "a correction re-validates the whole
invoice" is a route-level behavior (parse the request, call the correction, shape the
response), and nothing had ever verified that contract — only the pure re-validation logic
underneath it (already covered elsewhere).

**How they're isolated, and why that's the right boundary:** neither route has a built-in
dependency-injection seam the way `lib/extract.ts` does for the Gemini client (`GenAILike`).
Rather than add one purely to enable testing, each test mocks at the natural existing module
boundary — `@/lib/db`'s `prisma` for the trust route (letting `toView`'s real gate logic run
against a constructed row), and `@/lib/correct`'s `applyCorrection` for the PATCH route
(isolating the route's own contract — JSON parsing, validation, status-code mapping — from
the re-validation logic it calls, which already has its own coverage path through
`scoreInvoice`/`runRules`). This mirrors the project's existing convention (D36: mock at the
real boundary, don't build a new one just to make something testable).

**What's covered:** invoice-not-found → 404 (both routes); zero open flags → marks trusted
and persists (trust route); any open flag, including on a `failed`-status row → 409, `update`
never called (trust route); invalid JSON, missing/wrong-typed fields → 400 without ever
calling the correction logic; a thrown correction error → 400 with the real message; success
→ 200 with the fresh scored result (correction route). 9 new tests, all passing; 96 total
across the suite.

**Tradeoffs accepted:** none — pure test addition, no production code changed. Confirmed with
the full suite (96/96) and a production build before this entry was written.

**What I deliberately cut:** adding a client-injection parameter to `lib/correct.ts`/the trust
route purely to make them "properly" testable — the existing module-mock boundary already
tests the real contract without changing production code shape for testing's sake.

---

## D39 — Ran an actual accessibility check; found and fixed two real WCAG AA failures

**The decision:** added `scripts/check-accessibility.ts` (`pnpm a11y`) — runs axe-core
(`@axe-core/playwright`) against the three real page types (upload/landing, invoices list,
invoice detail with the provenance viewer) and reports every WCAG 2A/2AA/2.1A/2.1AA
violation. D27's UI pass said it was "guided by agent-skills' accessibility conventions" —
that was true but never verified. This turns the claim into a checked fact.

**What it found, on the first real run:** not zero. Two genuine issues, not stylistic
nitpicks:
- **Color contrast (serious), every page:** `--muted` (`#8a7b6c`) against white/cream
  backgrounds measured 3.79–4.09:1; WCAG AA requires 4.5:1 for normal text. `--warning`
  (`#b7791f`) against `--warning-bg` measured 3.25:1, same requirement. Both are text colors
  used constantly throughout the D27 pass (secondary text, helper copy, the disclaimer
  banner) — a real, widespread contrast failure, not an edge case.
- **Missing form label (critical), landing page:** the file-upload `<input type="file">` had
  no accessible label — a screen reader had no way to announce what it was.

**The fix:** darkened `--muted` to `#6f6153` (5.55–5.98:1 against the same backgrounds) and
`--warning` to `#8a5a12` (5.27:1) — same hue family, just dark enough to clear 4.5:1 with a
safe margin, verified with the same contrast-ratio formula axe uses before touching the file.
Added `aria-label="Invoice file to upload"` to the file input. Checked every other token
(dark mode, accent, success, danger, both modes) against the same formula — all already clear
4.66:1 or higher; only these two were actually broken.

**The alternatives:**
- **Trust the agent-skills guidance without verifying** — this is exactly what D27 did, and
  it was wrong on two real points. Guidance describes intent; only checking the rendered
  output confirms the intent was met.
- **Lower the darkening just enough to pass, no margin** — rejected; picked values with real
  headroom (5.2–6.0:1) rather than shaving right up against the 4.5:1 line, since font
  rendering and anti-aliasing can shift measured contrast slightly across environments.

**Tradeoffs accepted:** `--muted` and `--warning` are visibly a touch darker than before —
a deliberate, necessary tradeoff; the alternative was text a meaningful fraction of users
genuinely cannot read reliably. One new devDependency (`@axe-core/playwright`). Full test
suite (96/96) and a production build verified clean after the fix.

**What I deliberately cut:** treating "we followed the guidance" as equivalent to "we
verified it" — this entry exists specifically because those turned out to be different
claims.

---

## D41 — Fixed the two most defensible findings from a self-audit against clean-code principles

**The decision:** ran a critical review of the codebase against SOC/Documentation/DRY/KISS/
Testing/YAGNI, then fixed the two highest-ROI findings rather than everything found:

1. **DRY — extracted `useAsyncAction`.** `EditableField`, `MarkTrusted`, and `UploadForm`
   each independently hand-rolled the identical `loading`/`error` state pair and the
   identical `setLoading(true) → fetch → if(!res.ok) setError → setLoading(false)` shape —
   three implementations of one pattern. Added `app/_components/useAsyncAction.ts`: the hook
   owns loading/error and a `run(action)` wrapper; each caller's `action` does its own fetch
   and throws an `Error` with the user-facing message on failure, success handling (exit
   edit mode, refresh, redirect) stays local since that part is genuinely different per call
   site. All three components rewritten to use it; all 96 existing tests passed unchanged,
   which is itself evidence the refactor didn't change external behavior, only removed
   duplication.

2. **Testing — made the D25 regression permanent.** The highest-severity bug this project
   found (the provenance overlay landing on the wrong region of the document) was verified
   once, live, with a throwaway script that was deleted afterward — meaning zero regression
   protection existed for it going into this review. Added `scripts/check-provenance.ts`
   (`pnpm check:provenance`): for a set of known bbox-bearing fields on a seeded sample, it
   reads the field's actual stored `bbox` straight from Postgres (not anything the component
   itself computed), independently derives the expected overlay pixel rect from the canvas's
   real `getBoundingClientRect()`, and asserts the rendered overlay matches within 3px — the
   same verification method D25 used, just kept instead of thrown away.

**A real bug the new check caught in itself, worth recording honestly:** the first run
reported 4/5 fields matching and "Total" failing by a real, non-random margin (~16px). Not a
regression in the app — a bug in the *test*: Playwright's `hasText` does a case-insensitive
substring match by default, so matching a row by `hasText: "Total"` also matched the
**Subtotal** row (it contains "total"), and `.first()` picked Subtotal since it appears
earlier in the table. Fixed by matching the exact label cell (`^label$` anchored) and
walking up to its `<tr>`, rather than matching against the row's aggregated text. All 5
fields pass now. Documenting this because it's the same discipline the rest of this project
has tried to hold itself to — a test that "looks green" isn't the same as a test that's
actually checking the right thing, and this one wasn't, briefly.

**Also hit, and worth noting once more:** the DB connection failed twice with `P1001 Can't
reach database server` before this script ran successfully — confirmed as a real, current
Neon flakiness event (not a bug in the new script) by rerunning an already-working script
(`pnpm a11y`) at the same moment and getting the identical failure. Consistent with D31's
documented finding; no new mitigation attempted here beyond retrying.

**What I deliberately left alone, and why (from the same review):** the `invoices/page.tsx`
SOC inconsistency (inlines its filter form and table rather than extracting components like
its sibling pages) and the size of `scripts/generate-samples.ts` (441 lines for demo-asset
generation) — both real, both named in the review, both judged not worth the risk of
touching this close to submission for the value they'd return.

**Tradeoffs accepted:** none of substance — both changes were verified (96/96 tests, a clean
production build after fixing one type error the build caught that `tsx` didn't, and 5/5 on
the new provenance check) before being written up here.

**What I deliberately cut:** fixing every finding from the review instead of the two with
the clearest value-to-risk ratio; hiding the test-authoring bug the new check caught in
itself instead of recording it.

---

## D42 — Export (CSV/JSON) built first; duplicate detection deferred, not rejected

**The decision:** add Export as the next new capability — a single
`GET /api/invoices/export` route (both CSV and JSON), scoped to the current list-page filter
state, defaulting to trusted invoices only with an explicit, visible override, always
carrying `status`/`confidence`/`flags` alongside values. Sequenced ahead of the other real
candidate on the table, cross-invoice duplicate detection — which stays a planned feature for
later, not something decided against.

**Why this needed real scrutiny before building anything:** the project's stated thesis is
"AI extraction is commodity; trust is the product." Every feature up to this point can lean
on the UI to carry that trust — a colored badge, a tooltip, a disabled button (D14). Export is
the first feature where trust has no pixels to hide behind: once data leaves as a CSV or JSON
file, the only thing telling a downstream accountant or system whether a number is safe to
act on is the *data itself*. Built as a plain flattened dump of extracted values, Export
wouldn't just be generic CRUD — it would be a silent bypass of D14's entire trust gate, since
nothing would stop an unverified GSTIN from landing straight in a real GST filing. That risk,
not scope-creep aesthetics, is the actual reason this got the same level of scrutiny as a
core feature rather than being waved through as an obvious "add a download button."

**The alternatives:**
- **Duplicate invoice detection** — a separate, already-planned feature (matching vendor +
  invoice number + total across the dataset), not evaluated here as a rejected competitor.
  Export is simply first in the build order; duplicate detection is still coming.
- **A raw "export everything" dump** — rejected per the reasoning above: strips the trust
  signal at exactly the boundary where it matters most.
- **Hard-disable the export button until at least one invoice is trusted** — considered,
  rejected: gates on the wrong thing (whether trust exists *anywhere*), not the right thing
  (whether trust exists in *this* export), and would block a real, legitimate use — exporting
  a needs-review batch to work through corrections offline in Excel rather than this app's UI.
- **A confirmation modal on click, stating the trusted-only default** — considered,
  rejected: nothing in this app uses a modal anywhere (MarkTrusted, EditableField, and
  UploadForm all communicate inline) — introducing one here would be the single inconsistent
  interaction pattern in an otherwise modal-free product, for information that conveys just as
  well inline (a live count + an override checkbox next to the download buttons) with no new
  accessibility surface to get right under time pressure.

**The reasoning behind what's exportable:**
- **Filtered results, not the whole table** — reuses the exact `parseFilter`/
  `buildInvoiceWhere` from D16 verbatim; a CA exporting "vendor X, this quarter" is the real
  use case, not a dump of every invoice ever uploaded to a public demo.
- **Trusted-only by default, with a visible, explicit override** — the safe default without
  blocking the legitimate needs-review export case; `status`/`confidence`/`flags` are always
  present columns regardless of scope, so nothing exported is ever ambiguous about its trust
  state, even if the override is used.
- **Provenance/bbox cut for v1** — a normalized bbox coordinate means nothing in a
  spreadsheet, and it only exists for 3 seeded demo invoices anyway (D21); would mostly be
  empty cells for real data. Named as a natural next step, not built now.
- **CSV and JSON both, for two different, real personas:** CSV for a **human** (opened in
  Excel, handed to Tally/QuickBooks/GST filing) — necessarily flatter, invoice-level fields
  plus confidence/flags, no deep nesting. JSON for a **system** (another program, a second
  agent, an integration) — full per-field confidence and nested line items, which falls out
  almost directly from the `ScoredInvoice`/`InvoiceView` shape (D13/D14) already used
  internally, rather than new modeling.
- **One route serves both the UI action and any external caller** — `GET
  /api/invoices/export?format=csv|json&...filters` — the "Download CSV"/"Download JSON" links
  on `/invoices` just point at it with the current filter state in the query string. No
  separate export service, no duplicated filter logic.

**Tradeoffs accepted:** CSV output is necessarily less granular than JSON (invoice-level, not
line-item-level per-field confidence) — a deliberate width/usability tradeoff for a human
opening it in a spreadsheet, not an oversight. A hand-rolled CSV escaper is used instead of a
new dependency, consistent with this project's general instinct to avoid pulling in a package
for something a few lines of code already solves.

**What I deliberately cut:** scheduled/automatic export; a custom column-selection UI;
provenance/bbox in the output; line-item-level granularity in CSV specifically (JSON only);
a confirmation modal; hard-gating the button on global trust state instead of defaulting the
export's own scope safely.

**Built and verified, matching this design with no deviation:** `GET
/api/invoices/export?format=csv|json&includeAll=&...filters`, plus a plain
`<form method="get">` on `/invoices` (no client JS, no modal). Confirmed live — trusted-only
CSV correctly returns only `status: trusted` rows with proper value quoting;
`includeAll=true` JSON returns the full set with nested per-field confidence/flags/bbox,
which is just `toView()`'s own shape serialized directly. 96/96 tests, a clean production
build, and zero new `pnpm a11y` violations after adding the form.

---

## D43 — Collapsed per-field CSV flag columns into one, after actually opening the file

**The decision:** the CSV originally had one "X Flags" column per extracted field (10 of
them) alongside "X Confidence." Downloaded the real export and opened it — every single one
of those 10 columns was empty, on every row. Replaced them with one combined `Flags` column
(e.g. `GSTIN: GSTIN format is invalid`), dropping the sheet from 35 columns to 26.

**Why this wasn't visible from the design alone (D42):** it's structural, not incidental.
`trusted` status requires `openFlags === 0` (D14), and trusted-only is the export's own
default scope (D42). So for the common case, 10 of the columns were *guaranteed* empty by
definition before a single row was ever generated — no amount of reasoning about the design
in the abstract surfaced that; only opening a real downloaded file did. The same pattern as
D25 and D39: something can be correctly designed and still be wrong in practice, and the only
way to know is to look at the real artifact, not the plan for it.

**What stayed, deliberately:** per-field *confidence* columns. These are not redundant the
same way — a trusted invoice still shows real variation (a field with no verifiable rule
caps at a damped model score even when nothing is wrong, D13), so per-field confidence
carries genuine signal even when every flag column would be blank. Only the flags were
structurally empty; the confidence wasn't.

**The alternatives:**
- **Make the CSV shape conditional** — include per-field flag columns only when
  `includeAll=true` is used, omit them for the trusted-only default. Rejected: a CSV's schema
  changing depending on a query parameter is worse for any downstream script parsing it than
  one column that's simply blank when there's nothing to report.
- **Drop flags from CSV entirely, keep only the `openFlags` count** — rejected: the count
  says *that* something's wrong, not *what* — real information a `includeAll=true` export
  legitimately needs, per D42's whole reasoning for including flags at all.

**Tradeoffs accepted:** none of substance — verified with a full production build, the full
test suite (96/96), and a live re-fetch of both an `includeAll=true` and a trusted-only
export confirming the new column is populated in the first case and empty in the second.

**What I deliberately cut:** per-field flag columns as originally shipped; a conditional CSV
schema as the fix instead of a genuine consolidation.

---

## D44 — Duplicate detection: two tiers, deliberately unequal severity

**The decision:** build cross-invoice duplicate detection — the feature named but deferred in
D42 — as two tiers with genuinely different weight, not one uniform check:

- **Tier 1 (hard flag):** same `vendorGSTIN` + same `invoiceNo` + same `total` (within the
  existing `MONEY_TOL` tolerance from `rules.ts`). Pushed into `invoiceNo`'s existing `flags`
  array — same mechanism as a GSTIN checksum failure — floors confidence, blocks `canTrust`
  (D14).
- **Tier 2 (soft warning):** same `vendorGSTIN` + same `total` + `invoiceDate` within 7 days,
  but a *different* `invoiceNo`. Pushed into a new `warnings` array on the field — visible
  (amber, not red, reusing the `warning`/`danger` color split already in the design system
  since D26/D27), but does **not** floor confidence or count toward `openFlags`/`canTrust`.

A row can only be one or the other — Tier 2 candidates are Tier-1 matches excluded, never
both — and the check skips entirely when `vendorGSTIN` is missing or already invalid, rather
than falling back to fuzzy vendor-name matching.

**Why two tiers, not one — the real-world grounding, not just an engineering preference:**
Tier 1 has an actual regulatory basis, not a heuristic one — under India's GST rules, a
GSTIN-registered vendor is required to issue unique, sequential invoice numbers within a
financial year, so `(GSTIN, invoiceNo)` colliding is either the same document processed
twice, a data-entry/OCR error, or a genuine compliance violation. Tier 2 exists because
Tier 1 alone misses the more dangerous real pattern: a known AP-fraud evasion technique is
resubmitting the same invoice with a deliberately altered reference number specifically to
dodge invoice-number-based duplicate checks — same vendor, same amount, close date, different
number. Catching only Tier 1 would leave the harder, more consequential case uncaught.

**Why Tier 2 must not carry Tier 1's severity — the thing that almost made this a bad
feature:** every existing flag in this app (GSTIN checksum, arithmetic mismatch) is resolved
by *correcting a value* (D17) — the flag clears because the data becomes verifiably right. A
Tier 2 match isn't like that: the vendor, amount, and date can all be completely accurate,
because a recurring vendor relationship (a monthly retainer, a fixed subscription) legitimately
produces the same vendor+amount every period with a different, correct invoice number. Treating
that the same as a regulatory violation would hard-block every legitimate recurring invoice
with no way to clear it short of building a new dismiss/acknowledge workflow — real new scope,
and a real false-positive machine, which is exactly the failure mode D20 already found once
(a flag that cries wolf on valid data erodes the credibility of every other flag it raises).
Splitting severity by reusing the warning/danger distinction already built into this app's
design system avoids inventing new UI *and* avoids the false-positive trap.

**Architecture — kept separate from the pure scoring core on purpose:** `scoreInvoice`/
`runRules` are pure functions today, no DB access — exactly why they're the fastest, fully
deterministic tests in the suite (D36-adjacent). Duplicate detection needs a DB round-trip
(does a matching invoice already exist), so it lives in a new, separate `lib/duplicate.ts`
function called as a post-processing step — after `scoreInvoice()` returns, before
persisting — from two call sites: the upload route (`app/api/invoices/route.ts`) and the
correction path (`lib/correct.ts`'s `applyCorrection`, with `excludeId` so a saved invoice
never matches itself). `scoreInvoice`/`runRules` themselves are not touched.

**Do uploads get blocked?** No. Nothing in this app currently rejects an upload for being
*wrong* — a failed GSTIN checksum doesn't block storage, an arithmetic mismatch doesn't block
storage, even `isInvoice: false` still gets stored (marked `failed`). The established pattern
is store everything, flag problems, let a human decide (D14 gates *certification*, never
*storage*) — duplicate detection follows the same rule for consistency. There's also a
concrete reason blocking would actively break something already built: the downloadable
sample sandbox (D29) exists specifically so the same sample invoices can be uploaded
repeatedly to test the flow — hard-rejecting a second upload of `sample-clean.pdf` would
undermine a feature built on purpose.

**Does this change Export?** Tier 1 resolves for free — an invoice with an open Tier 1 flag
cannot reach `trusted` status while it's open (D14), so it already can't appear in the
default trusted-only export; it only shows under `includeAll=true`, where D43's `Flags`
column already makes it unambiguous. Tier 2 is the one real gap: since it's deliberately
non-blocking, a human can judge a Tier 2 signal legitimate and mark the invoice trusted — so
it *can* land in the default export, and right now nothing would show that a warning was
ever raised and accepted. Adding a `Warnings` column to the export (same consolidated,
per-field-prefixed pattern D43 established for `Flags`) closes that gap — a trusted, exported
invoice still shows "Tier 2 pattern detected and accepted" if that happened, keeping D42/43's
promise that exported data is never ambiguous about trust state, including soft signals.

**What I deliberately cut:** fuzzy vendor-name matching or any fallback when GSTIN is
unusable; currency normalization for the total comparison; a list-page duplicate badge
(surfaces only through the existing flag/warning mechanism on the detail page, avoiding a new
cost on the list query); a dismiss/acknowledge workflow for Tier 2 (a human judging it fine
and moving on doesn't need a new feature, just non-blocking visibility); a backfill scan of
already-existing data (runs going forward only); locking for near-simultaneous duplicate
uploads (accepted at this scale, named rather than silently ignored); blocking the upload
outright for either tier.

**Built and verified, matching this design with no deviation:** `lib/duplicate.ts`
(`findDuplicates`/`applyDuplicateResult`), wired into both the upload route and
`applyCorrection`; `warnings?: string[]` added to `ScoredField`; `FlagDisclosure` extended
with a `tone` prop reusing the existing warning/danger tokens; `Warnings` added to the CSV
export next to `Flags`. `scoreInvoice`/`runRules` untouched — confirmed by the fact that all
96 pre-existing tests passed unchanged. Live-tested by uploading the same real sample invoice
twice: the second upload correctly floored `invoiceNo` to 0.3 confidence and attached
`"Possible duplicate of invoice <id>..."`, referencing the first upload's real ID — and both
uploads succeeded (never blocked). Confirmed the flag surfaces through the export's new
`Warnings`/`Flags` columns too. 11 new tests for the matching/patch logic (mocked `@/lib/db`,
same pattern as the route-handler tests), 107/107 total, a clean production build, and zero
new `pnpm a11y` violations from the added amber warning styling.

**Revised after real evidence — added the list-page badge D44 originally deferred.** The
original reasoning for cutting it ("a new cost on the list query") turned out to be
overstated on inspection: showing a badge only needs one more already-stored JSON column
(`invoiceNoField`) in the same query the list page already runs, not a new round trip.
Seeing a real screenshot with several duplicate pairs sitting adjacent in the list — with no
way to notice from that view without opening each one — made the value concrete enough to
revisit. Added `classifyDuplicateField()` (reads the exact same flags/warnings
`applyDuplicateResult` writes, sharing the message-prefix constants so detection can't drift
from the actual text) and a small red/amber badge next to the status pill. Verified live via
screenshot: the duplicate upload from this entry's own test correctly shows a "duplicate"
badge the original (non-duplicate) upload doesn't. Build and full suite (107/107) stayed
clean.

---

## D45 — Synced SCOPE.md and README.md to reflect Export and Duplicate Detection

**The decision:** updated `SCOPE.md` and `README.md` to actually mention Export (D42/D43)
and Duplicate Detection (D44) — checked first, rather than assumed: both docs had zero
mentions of either feature. They were last substantially written before D42 and were
genuinely stale relative to what had shipped, not just lightly out of date.

**What changed:**
- `SCOPE.md` — added both to Purpose, In/Out of Scope (including their own specific cuts:
  no fuzzy vendor-name matching, no upload-blocking, no scheduled export), Product
  Capabilities (4.8/4.9), an Export user journey, Functional Requirements (7.8/7.9),
  Business Rules, and the Delivered Capabilities table.
- `README.md` — added both to "What it does," added three real npm scripts that existed
  but were never documented (`pnpm eval`, `pnpm a11y`, `pnpm check:provenance`, all added
  across D37/D39/D41 and never backfilled into the README at the time), and added
  duplicate detection's exact-match-only limitation to Known Limitations.
- Ran a mechanical accuracy check across `decisions.md`, `SCOPE.md`, and `README.md`:
  extracted every `D<number>` reference in all three files and confirmed each one resolves
  to an entry that actually exists — catching, for instance, whether the removed D40 (the
  LCP investigation, pulled per an explicit "we'll come back to this" request) left any
  dangling references behind. It didn't.

**Why this is its own entry and not folded into D42/D44:** those entries are about the
features themselves; this one is about keeping the *product-level* documentation honest
once shipped work outpaces it — a distinct, recurring failure mode in this project
(`SCOPE.md`'s own founding reason, D33, was this exact problem one level up: scope decided
early, never written down until asked). Here it's the same pattern at a smaller scale:
built, shipped, verified — and left the summary docs unaware of it until checked.

**Tradeoffs accepted:** none — pure documentation, no code touched. Full test suite
(107/107) reconfirmed after the edits as a sanity check, even though `.md` changes can't
affect it.

**What I deliberately cut:** refreshing the README's landing-page screenshot to show the new
export/duplicate UI — the written description is accurate and current; the image is a nice-
to-have, not a correctness issue, and not worth the scope this late.

---

## D46 — Cleaned up accumulated test data; kept a deliberate duplicate pair, not zero

**The decision:** deleted 14 of 19 invoice rows that had accumulated from this session's own
manual testing (repeated uploads of the same samples across GSTIN, fixture, missing-fields,
and phone-photo checks), keeping exactly 5: the 3 seeded provenance samples (D24, required —
`DownloadSamples` and the provenance viewer resolve them by ID) and one deliberately-kept
duplicate pair (the Metro Office Supplies rows from D44's own live duplicate-detection test).
Also added a short note to the invoices list — first written to disclose that real test
uploads, not just curated samples, might appear there, then revised once the cleanup made
that caveat moot: the final wording states plainly what the 5 rows *are* (the 3 seeded
samples plus a deliberate Metro Office Supplies duplicate pair), not an apology for messiness
that no longer exists.

**What prompted it:** a screenshot showed several visually-identical pairs (Greenleaf,
Northgate, Acme) sitting in the list with no duplicate badge, while only the Metro pair —
the newest — was flagged. Not a bug: exactly the D44-documented behavior (no retroactive
scan). But to a reviewer browsing cold, with no visibility into *when* each row was created
relative to when the feature shipped, it reads as the feature working inconsistently rather
than working exactly as designed on a timeline that isn't visible in the UI.

**Why keep the Metro pair instead of a fully duplicate-free 5:** it's the only remaining
proof, visible directly in the list without any action, that duplicate detection actually
does something. A fully clean set with zero repeats would look tidier but would mean nobody
browsing the demo could see the feature fire unless they re-uploaded a sample themselves.

**The alternatives:**
- **Delete nothing, rely on the disclosure note alone** — considered, and still shipped
  alongside the cleanup, but the note explains messiness rather than removing it; a reviewer
  still has to read prose to make sense of what they're looking at instead of the list just
  reading cleanly on its own.
- **Keep 5 fully unique rows, no duplicate pair** — the user's first instinct; reconsidered
  in favor of keeping one deliberate pair specifically because it's the only in-list evidence
  of D44 actually working, not just described in `decisions.md`.

**How this was executed, given it's destructive on shared/live data:** the invoices table
also backs the public deployment (same Neon database, no per-environment separation, D18).
Listed every row with its id/vendor/total/status/createdAt, proposed an explicit keep/delete
split, and only ran the delete after the user confirmed the exact list — not a blanket
"clean up the test data" instruction acted on unilaterally. `LineItem` cascades on delete
(`onDelete: Cascade` in the schema), so no orphaned rows. Verified after: exactly 5 rows
remain, matching the confirmed keep-list precisely (checked for zero overlap between the
delete and keep id lists before running), and `/`, `/invoices`, and both remaining non-seeded
detail pages all still return 200.

**Tradeoffs accepted:** the deleted rows are gone — no soft-delete, no undo. Acceptable here
because they were exclusively this session's own manual test artifacts, never real user data,
and their existence was already fully served by having been used for the checks they were
created for.

**What I deliberately cut:** deleting the Metro pair for a "zero duplicates" clean state;
soft-deleting/archiving instead of a real delete, for data that was never anything but
throwaway test input in the first place.

---

## D47 — Invoice list filters run server-side, not client-side

**The decision:** filtering on `/invoices` was never a client-side JS feature — it's a plain
`<form method="get">` that reloads the page with `?vendor=...&status=...&minTotal=...` etc. in
the URL. The server component reads `searchParams`, `parseFilter`/`buildInvoiceWhere`
(`lib/query.ts`) turn that into a Prisma `where` clause, and only matching rows are ever
fetched from Postgres. No array of all invoices gets sent to the browser and filtered there.
This wasn't a new build — it's how the structured query feature (D4) was already
implemented; this entry documents the reasoning after being asked directly whether it was
client- or server-side.

**Why server-side:**
- **Same principle as D14's trust gate** — trust-relevant state (e.g. filtering to
  `status=trusted`) stays authoritative on the server, not something a client could spoof by
  filtering a larger fetched set in JS.
- **Uses indexed columns (D9)** — filter fields map to real Prisma/Postgres columns, so the
  `where` clause benefits from actual indexes. A client-side filter over pre-fetched rows
  gets none of that, and means fetching every row regardless of how many actually match.
- **No client JS, consistent with Export (D42/43)** — same "plain form, no modal, works
  without JS" philosophy already used for the export buttons on this same page.
- **Shareable, bookmarkable URLs** — filters live in query params, not component state that
  resets on refresh. Fits the "structured, queryable data" thesis (D4) better than client
  state would.
- **Reused directly by Export** — `hiddenFilterInputs` forwards the exact same query params
  into `/api/invoices/export`, so `buildInvoiceWhere` is the one place filter logic lives for
  both the list view and the export route. If filtering were client-side, Export would still
  need its own independent server-side filter logic — you can't trust a client-filtered
  subset for a data export — so client-side filtering would mean building the same logic
  twice, not once.

**The alternative:** fetch all invoices once, filter client-side in JS. Not seriously
considered — it fails all five reasons above at once, and the export route would have
needed the server-side version anyway.

**Tradeoffs accepted:** a full page reload on every filter change, no optimistic/partial UI
update. Acceptable — consistent with the rest of the app's no-client-JS-where-avoidable
approach, and filtering isn't a high-frequency interaction here.

**What I deliberately cut:** nothing new was built for this entry — it exists to record an
architecture decision that was already live but never written down.

---

## D48 — A real "confirm" tier (85%), and resubmitting the same value stops being a fake one

**The decision:** two related fixes to inline correction (D17), landed together because the
second only makes sense once the first closes off the backdoor it was standing in for.

1. **Resubmitting a field's unchanged value is no longer treated as a correction.**
   `applyCorrection` (`lib/correct.ts`) now compares the submitted value against the field's
   current value before adding it to `correctedKeys`. Identical → no-op: no `corrected`
   flag, no confidence bump, no "edited" tag.
2. **A new, separate `confirm` action** lets a human explicitly affirm an
   otherwise-unverifiable field's value is correct, *without* editing it. It's its own
   endpoint (`POST /api/invoices/:id/confirm`, `lib/correct.ts`'s `applyConfirmation`), its
   own marker on `ScoredField` (`confirmed?: boolean`, parallel to `corrected`), and its own
   confidence ceiling: **85%** — real evidence, so it beats an unchecked damped model
   estimate, but below both 90% (rule-verified) and 95% (corrected), since a human glancing
   at a value and clicking "confirm" is weaker evidence than either a deterministic rule
   passing or an actual fix.

**The distinction, made concrete:**

| Action | Value touched? | Score behavior |
|---|---|---|
| Edit, same value resubmitted | No | Unchanged — stays at whatever it was (e.g. 69%) |
| Edit, value actually changed | Yes | Jumps to 95% (corrected) |
| Confirm | No | Jumps to 85% (confirmed) |

**What prompted it:** the user found the bug behind fix #1 directly — opened `vendorName`'s
edit control (showing 69%, an unverifiable damped model estimate), clicked save with no
change, and got back "edited" at 95%. Nothing had actually been edited. I built fix #1
alone first. The user then pointed out the natural consequence: with the backdoor closed,
there's now no way to ever raise an unverifiable-but-genuinely-correct field's confidence
without literally typing a throwaway edit and reverting it — a real gap the fix exposed, not
one it invented. That's what fix #2 answers.

**Why 85%, not 90% (the user's first suggestion):** 90% is currently the exclusive signal
for "a deterministic rule passed" (arithmetic, checksum, date-order, currency). A one-click
human confirm is weaker evidence than that — no forced engagement with the source document
the way retyping a value at least requires, and real rubber-stamp risk under review
fatigue. Giving both the identical number would mean "90% ✓" stops meaning one specific
thing, which is exactly the property this whole app is built to protect (D2/D13). 85% sits
strictly between the damped ceiling (≤70%) and both verified tiers (90/95), so every number
on the badge stays traceable to exactly one kind of evidence, and hovering isn't required to
know two 90%s aren't the same claim (it already isn't required for 90 vs 95, either).

**Why a separate action instead of reusing the edit flow:** confirm and correct are
different claims — "I changed this" vs. "I looked, it's already right" — and D48's fix #1
exists specifically because conflating them (a no-op edit silently acting as a confirm) was
the bug. A dedicated `applyConfirmation` that never writes a value, and a dedicated
`confirmed` marker independent of `corrected`, keeps that distinction real in the data model,
not just cosmetic in the UI copy.

**Ordering and precedence, made explicit in `scoreField`:** a failed rule still floors
everything, regardless of any confirm/correct history (D17's principle: arithmetic can't be
overridden by human affirmation). A passed rule (0.9) or an actual correction (0.95) always
outranks a mere confirmation on the same field — checked in that order, and the `confirmed`
output flag is only ever set when the confirm branch is the one that actually produced the
confidence value, not just because a stray `confirmedKeys` entry exists. Re-editing a
previously-confirmed field also clears its `confirmed` marker (`applyCorrection` calls
`confirmedKeys.delete(fieldKey)` on a real edit) — a genuine correction supersedes an earlier
confirmation, it doesn't coexist with it.

**Where confirm is offered in the UI:** only where there's something real to affirm —
`editInvoiceId` present (detail page, not read-only), the field has a value, has no open
flag, and isn't already `verified` (rule-passed, corrected, or already confirmed). A field
blocked by a failed rule never gets a confirm button; there's nothing to affirm past a
concrete check failing.

**The alternative rejected:** letting a bare click reach 90%, reusing the rule-verified tier
directly — the user's original proposal. Rejected for the reason above; would have been
faster to ship but would have quietly broken the one property (a badge number implies a
specific kind of evidence) that the rest of the confidence model exists to guarantee.

**Tradeoffs accepted:** one more endpoint, one more `ScoredField` marker, one more UI
affordance for a fairly narrow case (unverifiable fields only — rule-checkable fields never
show a confirm button, since a rule either already passed them or is actively blocking
them). Accepted because the alternative was either the mislabeling bug staying live, or a
"fix" that just moved the same mislabeling from 95% to 90%.

**What I deliberately cut:** reusing 90% for confirm; folding confirm into the existing edit
flow instead of a separate action/marker; any UI for confirming a field that already has an
open flag (a real correction is what that requires, not an affirmation).

**Addendum — layout fix, same day:** first shipped with the "confirm" button and "confirmed"
tag placed in the Value column, right after `EditableField`. On the actual two-column detail
layout (document preview + fields table), that column is narrow enough that a wrapped
multi-line value (e.g. a long vendor name) left no room on its last line for the tag/button,
so it fell onto its own line below — and for line items specifically, there's no Confidence
column at all, so "confirm" appeared under a value with no visible score for it to be
changing anything to. Moved both into the Confidence cell instead, next to the badge they
actually affect, and dropped the confirm affordance from line items entirely (nothing there
displays a per-field confidence for it to attach to). `Confidence` now optionally takes
`editInvoiceId`/`fieldKey` to render this; `Value` goes back to exactly its pre-D48 shape
(just the editable value and the `corrected` "edited" tag). No test changes required — the
existing row-scoped assertions (`within(vendorRow())...`) don't care which cell the button
lives in.

---

## D49 — A scoped delete: only while an invoice has an open hard-duplicate flag

**The decision:** a new `DELETE /api/invoices/:id` route, but not a general "delete any
invoice" capability — it's server-enforced to only work while the invoice currently has an
open Tier-1 hard-duplicate flag (checked via the same `classifyDuplicateField` the list page
already uses for its badge). A "Delete this upload" button appears in the UI only next to
that specific flag, with a two-step inline confirm (not a native `confirm()` dialog, since
this is destructive and irreversible).

**What prompted it:** walking through the actual user journey for D44's Tier-1 duplicate
detection for the first time — not just "does it detect correctly" but "then what does the
user do about it." Found a genuine stalemate: a Tier-1 flag floors confidence and blocks
trust (by design, D44), Confirm (D48) explicitly refuses to touch a flagged field (by
design, D17 — a failed verifiable check can't be human-overridden, only fixed), and editing
doesn't help either when the data is already correct on both sides — there was nothing
wrong to *fix*. Two invoices that are genuinely the same document had zero legitimate way to
leave that state. That's a real product hole, not an edge case — accidental duplicate
uploads (double-click, a file forwarded twice) are an ordinary occurrence, not a rare one.

**Why delete is the right fix, not an override:** a Tier-1 match means the same GSTIN,
invoice number, and total collide — under GST rules (D44's own reasoning), invoice numbers
must be unique per GSTIN per financial year, so a real collision is either the same document
twice or an actual compliance problem. Either way, there's no legitimate world where both
records should stay and both get marked trusted — the correct action is removing the
redundant one, the same way you'd never keep two "trusted" copies of one invoice in a real
ledger. This isn't a workaround for the flag; it's the actual resolution the flag is asking
for, expressed as a button instead of an out-of-band DB command.

**Why scoped, not a general delete button:** this is a public, unauthenticated deploy (D18).
A general "delete any invoice" capability is a materially bigger, scarier surface — anyone
with the link could delete anyone's data, no confirmation of intent beyond a click. Gating
delete server-side on "does this invoice currently have an open hard-duplicate flag" (the
route re-checks this itself, not just the UI) keeps the blast radius to exactly the stalemate
it exists to resolve — the same pattern as the trust gate (D14): the condition is enforced
where it can't be bypassed by hitting the API directly, not just hidden behind a UI
affordance.

**The alternatives rejected:**
- **A general delete-any-invoice button** — simpler to build, but a much bigger risk on a
  public deploy for a capability that's only actually needed in one specific stalemate.
- **A "not a duplicate, trust it anyway" override** — considered and rejected explicitly:
  this is architecturally identical to letting a human confirm past a failed GSTIN checksum,
  which is exactly the invariant (D17) the rest of the confidence model exists to protect.
  Overriding a rule failure by assertion, rather than by fixing the underlying data (or, when
  there's genuinely nothing to fix, removing the redundant record), was never on the table.
- **Native `window.confirm()`** — rejected for the same reason it's avoided in browser
  automation generally: it's a jarring, inconsistent-looking modal; a small inline two-step
  confirm (button → "Yes, delete" / "Cancel" card) fits the app's existing plain-HTML,
  low-JS aesthetic (same pattern as `EditableField`'s edit/save/cancel).

**Tradeoffs accepted:** genuinely irreversible — no soft-delete, no undo, `LineItem` rows
cascade-delete with it. Acceptable because it only ever applies to a redundant duplicate
record in the first place, and the two-step confirm plus the explicit "cannot be undone"
copy is the mitigation, not a safety net that changes the outcome.

**What I deliberately cut:** a general delete-any-invoice feature; any "override, mark
trusted anyway" path for a Tier-1 duplicate; a native browser confirm dialog.

**Addendum — stale flags on the surviving invoice, same day:** after deleting one of a
duplicate pair, the *other* invoice still showed "possible duplicate of invoice `<deleted
id>`" — a real bug, not cosmetic staleness: once the actual duplicate is gone, that invoice
genuinely isn't a duplicate of anything anymore, so the flag was now actively false. Root
cause: duplicate detection only ever runs at write-time for whichever invoice is being
written (upload, correct, confirm) — deleting a *different* row never touches it. Fixed by
re-checking, right after a successful delete, every remaining invoice that currently shows
any duplicate signal (`classifyDuplicateField`, the same check the list badge already uses)
— a small, already-flagged set, not a full-table rescan — and re-persisting each through a
new `revalidateDuplicate(id)` (`lib/correct.ts`): re-score, re-run `findDuplicates` excluding
nothing changed but the DB state, re-persist. If its match was the deleted row, the flag
clears; if it was also colliding with a third invoice, it correctly stays. Extracted the
repeated "score → find duplicates → apply → persist" tail (previously duplicated between
`applyCorrection` and `applyConfirmation`) into a shared `rescoreAndPersist` helper now that
a third caller needed the exact same sequence — the DRY threshold this project has used
consistently (D41 `useAsyncAction`, D44's `MONEY_TOL` export).

---

## D50 — Duplicate status is derived state, not persisted state

**The decision:** the invoice detail page and the trust route (`POST /api/invoices/:id/trust`)
no longer trust the stored duplicate flag at all — both now compute duplicate status LIVE,
against the current invoices table, every time they're hit. A new `getLiveScoredInvoice(id,
prefetchedRow?)` in `lib/correct.ts` is the single function both call: reconstruct → re-score
→ `findDuplicates` (excluding self) → `applyDuplicateResult` — the exact same core logic
every write path already used, just invoked read-only, with nothing persisted.

**Why the reactive delete-time patch (D49's addendum) wasn't the real fix:** it treated the
symptom (a stale flag exists after a delete) rather than the disease (duplicate status was
being treated as persisted state at all, when it's actually derived — a fact about this
invoice's relationship to whatever else currently exists in the table, not a fact about this
invoice alone). A reactive patch only ever covers the specific trigger it was written for
(delete); *editing* another invoice's GSTIN/invoiceNo/total, or any future write path (bulk
import, say), would each need their own equivalent patch, an open-ended list. Not treating
it as persisted removes the whole category, since there's nothing cached left to invalidate.

**Why this matches D14's own precedent:** the trust gate (`canTrust`/`openFlags`) was already
deliberately never persisted, always derived on read, for exactly this reason — a stored
verdict can drift from the data it's supposed to summarize the moment that data changes
elsewhere. Duplicate status is the same shape of problem; this just closes the one place D44
didn't originally apply that principle.

**What stays write-time-persisted, deliberately:** the list page's badge and the CSV/JSON
export still read the stored flag (`classifyDuplicateField`), unchanged. Those are lower-
stakes — a badge/export column, not something that gates an actual trust decision or is the
single canonical thing shown on the record's own page — so the existing accepted asymmetry
(D46: no retroactive scan) stays there. Making them live too is a reasonable future step
(would need a single batch query + in-memory pairwise check for the list, since duplicate
comparison is inherently cross-row) but wasn't asked for and adds no correctness risk by
being deferred, unlike the two consumers that were fixed here.

**Implementation:** `lib/correct.ts` was reorganized into a clear layering — `loadReconstructed`
(fetch-or-reuse a row, rebuild it into raw fields + corrected/confirmed key sets, shared
prologue for everything below), `rescore` (re-score + live duplicate check, no persist),
`rescoreAndPersist` (`rescore` + `updateInvoiceScored`, used by every function that
represents an actual write event), and `getLiveScoredInvoice` (`loadReconstructed` +
`rescore`, no persist — the new read path). `applyCorrection`/`applyConfirmation`/
`revalidateDuplicate` were rewritten on top of the same shared prologue rather than each
repeating "fetch row → toView → reconstruct." The detail page and trust route no longer
import `toView`/`StoredInvoice` for trust-gate purposes at all — they call
`getLiveScoredInvoice` and read `.fields`/`.overall.canTrust`/`.overall.openFlags` directly.

**Verified against the actual stale case:** re-ran `getLiveScoredInvoice` directly against
the real Metro Office Supplies invoice that had been showing the stale "possible duplicate"
flag throughout this session (its match was deleted before this fix existed) — live result:
`flags: []`, `canTrust: true`, `openFlags: 0`. Confirms the fix without needing to touch the
stored row at all (a pure read, no DB write).

**Tradeoffs accepted:** the detail page now does the same duplicate-check DB round trip on
every render that write paths already did on every write — trivial at this dataset size, no
different in kind from what `revalidateDuplicate` already cost per delete.

**What I deliberately cut, then un-cut the same day:** making the list-page badge live too —
initially left as an accepted asymmetry, then reconsidered once the user pointed out the list
page still showed a stale "duplicate" badge and pushed back: the app should be consistent
about this, not fixed in two places and stale in a third for no principled reason. Extended
`lib/duplicate.ts` with `classifyAllDuplicates()`: one query for every non-failed invoice's
identity fields, then an in-memory pairwise classification (shares the exact tiering rule
with `findDuplicates` via a new `matchTier` pure helper, so the two never drift). The list
page now calls this once per render instead of reading a stored flag per row. Also extended
the DELETE route's own authorization check (D49) the same way — it had the identical
staleness risk (a stale flag could wrongly allow or block a delete) and was a one-line reuse
of the same new function, so there was no reason to leave it as the odd one out.

**What's still deliberately left on the old, persisted path:** CSV/JSON export. Unlike the
list page (a live view, re-rendered on every visit) and the delete gate (a live authorization
decision), an exported file is inherently a point-in-time snapshot — "stale" isn't quite the
right frame for a document someone deliberately downloaded at a moment in time. Left as-is;
revisit if that reasoning turns out to be wrong.

**Net effect on the D49 delete-time revalidation patch:** now genuinely optional rather than
load-bearing anywhere — detail page, trust route, list page, and the delete gate all compute
live. It's kept solely to keep the *stored* flags/warnings text reasonably fresh for
CSV/JSON export, the one remaining consumer of persisted duplicate state.

---

## D51 — Rebuilt the matching rule itself: fiscal-year bound, currency veto, no-GSTIN fallback

**The decision:** D44's original matching rule (GSTIN + invoiceNo + total for hard; GSTIN +
total + date-within-7-days for soft) was correctly *architected* by D50, but the rule itself
had two real gaps, both caught live in this session, not hypothetically:

1. **A genuine duplicate went undetected.** Two identical Northgate Electricals invoices
   (same invoice number `NGE-0056`, same total, same date) were uploaded twice and never
   flagged, because Gemini didn't extract a GSTIN from that particular document — and the
   hard/soft rule required a GSTIN on both sides to run *at all*, with no fallback.
2. **A false positive was structurally possible but unverified until reviewed.** D44's own
   justification for treating GSTIN+invoiceNo+total as *hard, blocking* evidence explicitly
   invokes GST law: invoice numbers must be unique *per GSTIN per financial year*. The
   implementation never checked the year — an exact GSTIN+invoiceNo+total match a year
   apart (a vendor legitimately reusing a number after the fiscal year rolled over, which
   that same law explicitly permits) would have been wrongly, permanently blocked, with the
   only "fix" being to delete one of two genuinely-valid invoices.

Both were flagged in a from-scratch staff-engineer-style review of the whole project
(requested explicitly, adversarial, not asked to be encouraging) before either had actually
manifested as a live bug — #1 then manifested minutes later in the running app, which is
what prompted fixing both together instead of filing them as future work.

**The rebuilt rule, in `lib/duplicate.ts`:**
- **Tier 1 (hard):** GSTIN + invoice number + total match, **and** either the invoice dates
  are in the same GST financial year (April–March) or a date is missing on either side (if
  we can't disprove same-year, stay conservative rather than silently let a real duplicate
  through).
- **Tier 1, cross-year (soft, new):** the identical match, but the dates are known and in
  different financial years — can't block trust (GST law's own guarantee doesn't cover this
  case), but still worth a human glance.
- **Tier 2 (soft, unchanged):** GSTIN + total match, different invoice number, dates within 7
  days — the altered-reference-resubmission pattern.
- **Tier 3 / no-GSTIN fallback (soft, new):** GSTIN missing on at least one side — match on
  an **exact** (not fuzzy) vendor name + invoice number + total instead. Weaker legal
  grounding than GSTIN, so it's soft, never blocking — but without it, the exact scenario
  that just happened (a real duplicate, GSTIN extraction failure) goes completely invisible.
- **Currency veto (new), any tier:** if both sides have a known currency and it differs, no
  match, regardless of what else lines up — a numerically-equal total in a different
  currency is never the same transaction. Reuses the existing `normalizeCurrency` (D20)
  rather than a second symbol-to-code table.
- **Comparison normalization (new):** GSTIN, invoice number, and vendor name are all compared
  case- and whitespace-insensitively — extraction can legitimately vary in case/spacing
  across two reads of the same document, and the whole point of the no-GSTIN fallback is to
  catch exactly that kind of near-identical-but-not-byte-identical repeat upload.

**Why the no-GSTIN fallback is soft, not hard:** GSTIN uniqueness has actual legal backing
(D44's cited GST rule); an exact vendor-name string match does not — two distinct legal
entities could in principle share a display name. Giving it hard/blocking authority would
overclaim certainty the evidence doesn't support, which is exactly the discipline the rest of
the confidence model (D13) is built to enforce. It gets flagged, not force-blocked.

**Shape change:** `DuplicateCheck`/`DuplicateMatch` now carry a `reason: MatchReason` per
match (four reasons, one message each), not just an id — the flag/warning text a human reads
needs to say *which* evidence fired, not just that something did. `findDuplicates` takes a
single `identity` object (`gstin`, `invoiceNo`, `total`, `invoiceDate`, `vendorName`,
`currency`) instead of four-then-five positional parameters — was already getting unwieldy,
and the object is the same shape `classifyAllDuplicates`'s internal `InvoiceIdentity` needs,
so there's one canonical "what identifies an invoice for matching purposes" type instead of
two near-duplicates. `matchTier`, shared by both `findDuplicates` (one invoice vs. the DB)
and `classifyAllDuplicates` (every invoice vs. every other, in memory, D50), is still the
single place the actual rule lives — this rebuild extended that one function, not two
parallel copies of it.

**Verified against the real data that surfaced the gap:** re-ran `classifyAllDuplicates()`
directly against the live DB — the two real Northgate Electricals rows (identical invoice
number, total, date, no GSTIN extracted on either) now correctly classify as `soft`.

**Tradeoffs accepted:** the no-GSTIN fallback still can't help if vendor name extraction
*also* varies in some way normalization doesn't cover (a typo, an abbreviation) — genuinely
weaker coverage than the GSTIN-anchored tiers, which is exactly why it's capped at soft.

**What I deliberately cut:** fuzzy/similarity-based vendor name matching for the fallback
tier (Levenshtein distance, etc.) — exact-after-normalization only, to keep the fallback's
evidence basis simple and explainable, consistent with D44's original "no fuzzy vendor-name
fallback" instinct — just no longer used as a reason to skip the check entirely.

---

## D52 — Duplicate status is never persisted; always derived (finishing D50)

**The decision:** duplicate detection stops writing anything to the database, with no
remaining exceptions. D50 made the trust-gating consumers (detail page, trust route, list
badge, delete gate) compute duplicate status live instead of trusting a stored flag, but
export — and the D49 delete-time `revalidateDuplicate` patch that kept export's copy
reasonably fresh — were left on the old, write-time-persisted model as a deliberate, smaller
exception. This closes that exception: every consumer, including export, now computes
duplicate status live, and the database's `invoiceNoField` JSON never contains
duplicate-related text at all, on any invoice, ever again.

**The rule, stated plainly:** duplicate status is a fact about an invoice's relationship to
every *other* currently-existing invoice — it can never be a property of that invoice alone,
so persisting it as if it were is a category error, not a caching choice that happened to go
stale. The fix isn't "cache it more carefully." It's "stop treating a derived, cross-row fact
as though it belongs to one row's stored data" — full stop, not a partial one.

**Why export was the last holdout, and why that reasoning didn't survive scrutiny:** export
was left on the stored model because "an export is a snapshot in time." That's true of the
*downloaded file* — once someone has the CSV, it doesn't update itself. It was never actually
a requirement that the **source data** be pre-computed and stored; computing duplicate status
live at the moment export runs still produces a snapshot (accurate as of that moment) — a
truer one, in fact, than reading whatever happened to be stored from whenever the invoice was
last corrected or confirmed, which could be arbitrarily old. The "snapshot" argument justified
the file being static, not the query behind it being stale.

**Checked before committing to this, not assumed:** the `scored` JSON returned by the
correction and confirmation API routes isn't read by any client code — `EditableField` and
`ConfirmField` only check success/failure and call `router.refresh()`, which re-renders from a
live check regardless. So removing duplicate info from what gets persisted has no user-visible
effect on either flow; nothing downstream was depending on it being there.

**What this removes, not just stops calling:**
- The `findDuplicates` + `applyDuplicateResult` calls inside the upload route and inside
  `rescore`/`rescoreAndPersist` (correction, confirmation) — scoring an invoice on write
  becomes pure and single-invoice again; no DB round trip for duplicates happens on write.
- `revalidateDuplicate` (D49) in full — nothing stored can go stale, so nothing needs
  refreshing after a delete.
- `classifyDuplicateField` (string-prefix parsing of stored flags/warnings text) — nothing
  persisted left to parse.
- The DELETE route's post-delete "staleIds" scan that called the above two — same reason.

**What stays:** `applyDuplicateResult` — the pure, in-memory function that attaches a
duplicate result onto one `ScoredField` — is kept. It's still the one place a duplicate
result gets applied to a field's confidence/flags for display. It just moves to being called
exclusively from the *read* path (`getLiveScoredInvoice`, `classifyAllDuplicates`, and now
export's per-row live overlay), never from a write path, and its output never reaches
`updateInvoiceScored`/`storeInvoice` again.

**The alternative rejected:** keep write-time persistence solely for export, as a documented,
deliberate, narrower exception — the position going into this decision, and the one I'd
argued for a few turns earlier in this exact session. Reconsidered once the actual
justification for it (the snapshot argument, above) didn't hold up under a direct question
about whether it was really needed.

**Net effect:** this is a simplification, not a bigger system — line count goes down. One
honest rule going forward: duplicate status is never stored, anywhere, under any
circumstance. The answer to "is this derived or persisted" stops being "depends which part of
the app you're asking about."

**Scope note, explicitly deferred, not bundled in:** this settles the persist-vs-derive
question only. It does not yet address the separate, larger redesign already discussed —
giving duplicate status its own structured field (`ScoredField.duplicate`) instead of
encoding it as text inside `flags`/`warnings`, and unifying the two independent `canTrust`
formulas (`toView` vs. `scoreInvoice`) into one. That's real, already-scoped follow-up work,
deliberately sequenced *after* this decision, not folded into it.

**Built and verified.** `lib/duplicate.ts` gained `applyDuplicateInfo` (the one place a
resolved match actually mutates a field — shared by the single-invoice and batch paths, so
message text can't drift between them) and `overlayLiveDuplicateStatus` (the one live-check
entry point, used by `getLiveScoredInvoice`, and by the correction/confirmation/upload
routes to overlay the *returned* object only, after persisting). `rescore` in `lib/correct.ts`
is now genuinely pure — no DB call, no duplicate check — and `rescoreAndPersist` persists it
before the overlay ever touches the object, so what's saved is provably clean; a test asserts
this ordering directly rather than trusting it. `revalidateDuplicate` and the DELETE route's
post-delete "staleIds" scan are deleted, not deprecated. Export now calls
`classifyAllDuplicates` (extended to carry match id + reason, not just tier, since export
needs the actual message) and recomputes its trust gate via a new shared `computeTrust`
helper in `lib/invoice-view.ts`, extracted so `toView` and export use identical math instead
of two copies of the same formula. Verified directly against the live DB: `invoiceNoField`
on a freshly-scored row now contains no duplicate text at all, while `getLiveScoredInvoice`
and `classifyAllDuplicates` still correctly surface the real Northgate soft match on top —
confirming the derived and persisted layers are now fully, provably separate. 177/177 tests
passing, clean build.

---

## D53 — Collapsed hard/soft duplicates into one concept: a Duplicate Candidate

**The decision:** duplicate detection no longer has two tiers. There is exactly one
business-meaningful state — a Duplicate Candidate: a pairing that needs a human to decide
"same document" or "genuinely different." How the candidate was found (GSTIN match vs. the
no-GSTIN vendor-name fallback, same fiscal year or not) is now supporting evidence shown to
that human, never a distinct type with different app behavior. Every candidate blocks trust,
uniformly, until a human resolves it — no exception carved out for weaker-evidence matches.

**Why the split existed, and why it didn't survive a first-principles challenge:** "hard"
and "soft" modeled the matching algorithm's own confidence — a label for *how the match was
found*, not anything the business asks about. Pressure-tested directly against the one thing
this feature exists to prevent (double payment): that risk doesn't care how a candidate was
found, only whether it's been resolved. A "soft" match sitting as a passive, non-blocking
badge is a real gap, not a feature — it's precisely the failure mode (a flagged candidate
quietly getting trusted and paid anyway) duplicate detection exists to catch. The
"don't punish legitimate recurring invoices" concern that motivated the soft tier doesn't
actually require a silent badge either — it only requires that dismissing a false alarm be
cheap, which a unified model gives directly (one click, remembered).

**What's new — the one genuinely persisted fact:** a `DismissedDuplicate` table
(`invoiceIdLow`, `invoiceIdHigh`, normalized so the pair reads the same either direction).
This is a deliberate, justified exception to "duplicate status is never persisted" (D50): a
human's judgment that two specific invoices are *not* the same document isn't re-derivable
from the invoice data the way the match itself is — it has to be remembered somewhere, or
the same resolved candidate would nag again on every page load.

**Why this table exists, in plain terms — and why it doesn't undo D50–D52:** D50–D52
settled that duplicate *matching* must never be persisted, because it's a fact you can
always recompute from the invoices themselves (same GSTIN, same invoice number, same
total). This table stores something different in kind: not "are these a match," but "did a
human already look at this specific pair and say no." That's not something any comparison
of invoice fields could ever recover — it only exists because a person did something. Two
invoices flagged as similar don't stop being similar just because a human dismissed them;
nothing about their *data* changes. Without somewhere to remember the dismissal, the exact
same warning would reappear the moment either invoice's page reloaded, and the human's
decision would be silently thrown away every time. So the rule that's actually being applied
consistently is: **derive anything computable from current data — never store it. Persist
anything that records a human's decision — because there's no way to compute it back.**
`corrected` and `confirmed` on a field (D17/D48) already work this exact way, for the exact
same reason; `DismissedDuplicate` is that same pattern, just for "a human cleared this pair"
instead of "a human edited this field."

**Resolution, made concrete:** every duplicate candidate gets exactly two actions, always
together, never one without the other — "Yes, same document" (the existing delete flow,
D49, now authorized by *any* unresolved candidate, not just a hard one) and "Not a duplicate"
(a new `POST /api/invoices/:id/dismiss-duplicate`, recording the dismissal and clearing the
candidate — for this specific pair only; a different future pairing still surfaces normally).

**What got simpler, not just different:**
- `matchTier` returns a reason or nothing — no tier, no fiscal-year "downgrade to soft"
  branch (a cross-year match is still just a match, explained honestly in its reason text).
- `applyDuplicateInfo` collapses to one unconditional treatment — floor confidence, add a
  flag, set the structured `duplicate` field — instead of branching on tier.
- `ScoredField.warnings` is deleted outright — it existed for exactly one purpose (the soft
  tier) and had no other caller; `FlagDisclosure`'s `tone` prop goes with it.
- `DeleteDuplicateButton` becomes `DuplicateResolution` — one component offering both
  outcomes, replacing a prefix-string check (`flag.startsWith(...)`, duplicated between
  `ScoredFields.tsx` and `lib/duplicate.ts` purely by comment discipline) with a direct,
  typed `f.duplicate` field access. That client/server string-duplication risk is gone.
- The list badge collapses to one label ("duplicate"), one color, no tier branching.
- The DELETE route's authorization is `!duplicates.has(id)` instead of a tier check.

**What I deliberately cut:** a persisted, tiered "confidence score" for how sure a match is
— the reason text still explains the evidence, but nothing about the app's behavior depends
on it anymore. Fuzzy resolution states like "acknowledged but not yet decided" — a candidate
is either resolved (deleted or dismissed) or it isn't; no third, in-between state.

**Honest self-assessment:** this reverses part of D44's original design and, implicitly,
D51's framing of the fiscal-year and no-GSTIN cases as separate tiers. That's not a
contradiction to paper over — D51 correctly fixed real gaps in the *matching rule itself*
(the fiscal-year bound, the no-GSTIN fallback), and those fixes are untouched here; only the
decision to expose match confidence as distinct, differently-behaving user-facing types
turned out to be modeling the algorithm instead of the business, and needed reversing
separately once actually challenged on it.

## D54 — Added `docs/ARCHITECTURE.md` as a standing reviewer-facing document

**The decision:** wrote a single comprehensive architecture document — tech stack, repo
structure, system diagram, database design, API reference, one flow diagram per feature
(upload, correction, confirmation, possible-duplicate resolution, trust evaluation,
export, structured query), request lifecycle, component architecture, domain model,
validation and duplicate pipelines, security, performance, testing strategy, a full ADR
index (D0–D53), design principles, and a summary table. Built from the actual repo, not
from `decisions.md`'s narrative — every fact cross-checked against real files/routes/
schema rather than restated from memory.

**Why now, and why a new document instead of extending `SCOPE.md`:** `decisions.md`
answers *why*; `SCOPE.md` answers *what product resulted*. Neither answers *how a
reviewer should read the codebase in twenty minutes* — repo layout, request flow, where
each concern lives. That's a different question, for a different reader (someone
evaluating the engineering, not the product), so it earns its own file rather than being
folded into either existing doc.

**Diagram style — the one real iteration:** the first draft used Mermaid
`sequenceDiagram`s for each feature flow (actor columns, arrows, self-loops). Feedback
from a live read was that the notation itself, not the content, was the obstacle — hard
to follow even after a plain-language walkthrough. Converted all five feature-flow
diagrams to plain top-to-bottom `flowchart TD`s with everyday-language node text (e.g.
"Server checks live: does this match any other invoice already saved?" instead of a
function name), verified one at a time before converting the rest. `Trust Evaluation` and
`Structured Query` were already flowcharts and were left with their existing
variable-style labels — simplifying them was offered, not requested.

**Terminology:** "Duplicate Candidate" renamed to "Possible Duplicate" throughout this
document only, after a plain question about what a "candidate" is when the domain is
invoices — "candidate" reads like ML-pipeline jargon, not a term a finance reviewer would
recognize. `decisions.md` (including D53's own title) and source-code comments still say
"duplicate candidate" — the rename wasn't extended there, since `decisions.md` is a
historical log of calls as they were actually made (D12), not something to retouch after
the fact, and the source-level rename wasn't asked for.

**What I deliberately cut:** no new diagram tooling, no generated-from-code diagram
pipeline — Mermaid, hand-written, kept in sync manually like every other doc in this
repo. No attempt to keep it perfectly current automatically; it is a snapshot, sourced
against the same commit as this decision, and will drift the way any hand-maintained doc
does if the code moves and the doc isn't revisited.

**Honest self-assessment:** the known, still-open architectural gaps this project already
carries (the `canTrust` divergence between `toView` and `scoreInvoice`, zero test coverage
on page-level Server Components) are named explicitly inside the document itself (§14,
§17) rather than smoothed over — consistent with this project's stated preference for an
honest account over a tidy one.

