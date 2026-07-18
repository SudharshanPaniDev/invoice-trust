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

**Chose:** Problem #3 (messy documents → structured, queryable data), scoped to invoices.
I read it as a document extraction **and trust** system — validation, confidence,
provenance, human correction — not the commodity "upload PDF → LLM → table" version, since
LLMs already extract well and that alone only proves I can wire an API. The trust layer is
the whole point (see D2). "Trust layer for an AI finance employee" is positioning (why it
matters), not scope; the deliverable is a document system, not an agent.

**Rejected #1 and #2:**
- **#1 (learn by watching)** — in a few days it's a macro recorder; real behavior
  generalization is a research problem a reviewer sees through.
- **#2 (conversation agent)** — closest to Zamp's product, but short builds become a thin
  chat wrapper with unverifiable success. Kept a strict slice as a stretch (see D4).

**Why invoices:** richest structured fields, hard cross-checks (line-item sums, tax math,
GSTIN checksum), and messy real-world samples are easy to source for tests.

**Cut:** auth/multi-tenant · non-invoice types · multi-doc reconciliation · job queue ·
free-form chat — each trades depth on the trust core for shallow breadth.

---

## D2 — Confidence is earned by validation, not reported by the model

**Chose:** per-field confidence from verifiable rules (line-item sums, tax math, GSTIN
checksum, date sanity) combined with the model's signal — never the model's self-reported
confidence alone. Every low-confidence flag states a human-readable reason.

**Rejected:** trust the model's own confidence score (simplest); show raw output, no
scoring (fastest).

**Why:** a model that hallucinates a total will confidently vouch for it — self-reported
confidence is theatre. In finance, confidence only means something anchored to arithmetic
that *must* hold. This is the hard sub-problem and where the meaningful tests live.

**Tradeoff:** more upfront work on a rules engine, and rules are invoice-specific. Worth
it — it's the whole thesis.

---

## D3 — One document type, behind an honest modular seam

**Chose:** invoices only, but deep — a modular pipeline (`Upload → Processor → Invoice
Extractor (v1) → Validation → Store → Search`) where extraction is a clean seam a second
extractor could slot into without touching anything downstream. No classifier that always
returns "invoice."

**Rejected:**
- **Multiple types (receipts, POs, contracts, resumes)** — shallow on many, and most have
  no objective correctness to check (no math, no ground truth), so they can't show trust.
- **Stub classifier returning "invoice"** — dishonest; fake extensibility reads worse than
  an owned, explicit scope.

**Why:** the brief says pick the hard problem and go deep. One type keeps the pipeline's
*shape* general while the trust core goes deep. The pattern (extract → validate → earn
confidence → provenance → correct → query) generalizes to any domain where "correct" is
definable; invoices are the first instance.

**Cut:** document classification · multi-type support · embeddings/semantic search over
document text.

---

## D4 — Query and search are baseline, not a stretch

**Chose:** structured search ships in the core build — filter by vendor, amount range,
date, status → exact rows.

**Rejected:** keep query as an optional stretch; or drop it, submit extraction + trust
only.

**Why:** the problem statement literally asks for "structured, *queryable* data … searched
and queried." Demoting it risks nailing the hard sub-problem while under-delivering the
stated one. On a 5-day budget, structured query fits comfortably.

**Tradeoff:** more surface to build and test — worth it to complete the "messy in →
trustworthy, queryable out" story end to end.

**Cut:** natural-language query stays a stretch, and even then resolves to a **structured
query shown with exact rows** — the model never narrates numbers (see D2). Free-form chat
stays cut.
