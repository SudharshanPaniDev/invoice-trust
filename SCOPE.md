# Scope Document — Invoice Trust Layer

## Document Relationship

This project is documented through two complementary artifacts:

- **decisions.md** records the engineering journey — each significant decision, the
  alternatives considered, the reasoning behind the choice, and the trade-offs accepted.
- **Scope Document** records the resulting product. It summarizes the capabilities,
  requirements, assumptions, and boundaries that emerged from those decisions.

Together, they answer two different questions:

- **Why was this built this way?** → `decisions.md`
- **What product was ultimately built?** → `Scope Document`

This document did not exist before or during development. It was written after the fact,
summarizing scope that was defined incrementally, decision by decision, exactly as
`decisions.md` records it.

## 1. Introduction

Invoice Trust Layer is a web application that turns messy invoice documents — PDFs,
scans, phone photos — into clean, structured, queryable data, and makes that data
*trustworthy*: every field's confidence is earned by verifiable checks (arithmetic, tax
math, GSTIN checksum), not asserted by the extraction model. A human can correct a
flagged field, see the whole invoice re-validate, and only then mark it trusted.

## 2. Purpose

- Turn unstructured/semi-structured invoice documents into structured, queryable data
  (the core ask — see Problem #3).
- Make "confidence" mean something: earned by validation, not claimed by the model (D2).
- Let a human close the loop — correct a flagged field, watch it re-validate (D17).
- Prove trustworthiness visually — provenance: click a field, see where it was read from
  on the source document.
- Give anyone trying the demo a safe way to do so without uploading their own real
  financial documents (D21/D29).

## 3. Scope

**In scope**
- Invoice documents specifically — one document type, gone deep (D3)
- Structured extraction into a typed, validated schema
- Earned-confidence scoring per field, not model self-report
- Human correction of extracted values, with full re-validation
- Server-enforced "trusted" gate
- Structured search/query over extracted invoices
- Provenance (source highlighting) for a curated set of sample documents
- A downloadable sample-invoice set covering realistic document conditions, so nobody
  needs to upload a real invoice to try the product
- Public, unauthenticated demo deployment

**Out of scope**
- Other document types (receipts, purchase orders, contracts) — one type, deep not broad (D3)
- Document classification — no "is this an invoice vs. something else" routing beyond a
  single `isInvoice` check (D3)
- Full-text or semantic search over document content — structured filters only, on
  purpose (D3/D6)
- Natural-language querying — even as a stretch, it would resolve to a structured query;
  a model never narrates financial figures (D4)
- Authentication, user accounts, roles, multi-tenancy (D1/D18)
- Persisting any real user-uploaded document, in any form (D21)
- Provenance on anything other than the curated sample set
- Batch or multi-document upload
- Any invoice lifecycle operation beyond single-field correction (no delete, no
  re-extraction, no bulk actions)

## 4. Product Capabilities

**4.1 Structured Extraction** — The system shall extract a fixed set of invoice fields
(vendor, GSTIN, invoice number, invoice date, due date, currency, subtotal, tax rate, tax
amount, total, line items) from an uploaded PDF or image into a typed, schema-validated
representation.

**4.2 Earned Confidence** — The system shall assign each extracted field a confidence
score derived from verifiable business rules, using the model's own confidence only as a
fallback for fields no rule can check — never as the primary signal.

**4.3 Human Correction** — The system shall let a user correct any extracted field's
value and re-validate the entire invoice against that correction.

**4.4 Trust Gate** — The system shall allow an invoice to be marked "trusted" only when
no verification flags remain open, enforced on the server, not just hidden in the UI.

**4.5 Structured Query** — The system shall let a user filter stored invoices by vendor,
status, amount range, and date range.

**4.6 Provenance** — The system shall, for the curated sample invoices only, let a user
click a field and see the region of the source document it was read from.

**4.7 Sample Sandbox** — The system shall provide a set of downloadable sample invoices
covering realistic document conditions, so a user has something safe to test the upload
flow with instead of a real document.

## 5. User Roles

There is exactly one: an unauthenticated visitor. No login, no accounts, no role-based
permissions — deliberately (D1/D18). Every visitor can upload, browse, query, correct,
and mark trusted; nothing is gated by identity. This is a scope decision, not an
oversight: the brief is about the extraction/trust problem, not access control, and a
public demo needs zero setup friction for a reviewer to try it.

## 6. User Journeys

**Upload journey**
1. Land on the upload page; read the "don't upload real invoices" disclaimer.
2. Download a sample invoice (or bring an already-downloaded one).
3. Upload it.
4. Land on the invoice's detail page (redirects here automatically on success).
5. Review per-field confidence and any open flags.
6. Correct a flagged field, if any; the invoice re-validates.
7. Mark the invoice trusted once no flags remain.

**Browse & query journey**
1. Navigate to Invoices.
2. Filter by vendor, status, amount range, or date range.
3. Open an invoice's detail page from the results.

**Provenance journey** (curated samples only)
1. Open a seeded sample invoice's detail page.
2. Click a field with a source location.
3. See the corresponding region highlighted on the original document image.

## 7. Functional Requirements

**7.1 Extraction**
- The system shall accept a single PDF or image file per upload.
- The system shall extract the fixed invoice field set into a schema-validated structure.
- The system shall record, per field, the raw source text and its location on the
  document when available.

**7.2 Validation & Confidence**
- The system shall run verifiable rules (line-item sums, tax math, GSTIN checksum,
  currency recognition, date sanity) against extracted values.
- A failing rule shall floor the confidence of every field it touches, regardless of the
  model's own confidence for that field.
- A field no rule can verify shall never reach "high" confidence on model signal alone.

**7.3 Correction**
- The system shall allow editing any single field's value.
- Saving a correction shall re-run validation across the whole invoice, not just the
  edited field.
- A human correction shall count as verification for a field no rule can otherwise check;
  it shall not override a rule that can.

**7.4 Trust Gate**
- The system shall reject a request to mark an invoice trusted if any field currently has
  an open flag.
- This check shall be enforced by the server, independent of what the UI shows or hides.

**7.5 Query**
- The system shall let a user filter invoices by vendor (contains), status, minimum/
  maximum total, and a date range, in any combination.

**7.6 Provenance**
- For an invoice with a stored source document, the system shall let a user click a
  scored field and see its bounding region highlighted on the rendered document.

**7.7 Sample Sandbox**
- The system shall offer downloadable sample invoices representing realistic document
  conditions (clean, invalid data, arithmetic mismatch, scanned, photographed, annotated,
  multi-page, missing/illegible fields).
- Uploading a sample shall go through the exact same path as any other upload — no
  special-casing.

## 8. Business Rules

- A field's confidence is earned by validation; the model's self-reported confidence is
  never the primary signal (D2/D13).
- A failed verifiable rule floors every field it touches, even after a human correction
  fixes the value incorrectly (D17).
- "Trusted" can only be set when zero flags are open, and only the server can grant it (D14).
- A real user's uploaded document is never persisted, in any form, anywhere (D21).
- Correcting one field re-validates the whole invoice, since rules are cross-field (D17).
- A structured query returns exact rows; no model ever narrates or summarizes the
  numbers it returns (D4).
- Every sample invoice — seeded or downloadable — is visibly marked as a sample, never
  presented as if it were a real submission (D24/D29).

## 9. Non-Functional Requirements

**Accessibility** — The application follows WCAG 2.1 AA-guided practice: keyboard
navigation, visible focus states, semantic structure, sufficient color contrast, and
never color-alone as a signal (D27).

**Trust & Transparency** — Every validation flag carries a human-readable reason,
never just a score. Where a source document exists, a user can see exactly where a
value was read from. This is the product's defining non-functional property, not an
afterthought.

**Privacy** — No real user document is ever retained. The public deployment carries a
visible disclaimer, and the sample sandbox exists specifically so a visitor never needs
to risk their own data to try the product (D18/D21/D29).

**Usability** — A consistent, warm visual design (not a generic "AI" look), with
automatic dark mode support, applied across every page (D27).

**Performance** — The application should feel responsive during normal use; navigation
shows an immediate loading state rather than a frozen screen while data resolves.
(Implementation-level performance facts — actual latency figures, infrastructure
tradeoffs — are tracked in `decisions.md`, not here; this document is about product
scope, not operations.)

**Security** — The application is intentionally public and unauthenticated, consistent
with its scope (Section 5) — this is a stated position, not a gap being overlooked.

## 10. Assumptions

- A visitor tests the product using the provided sample invoices, or their own synthetic/
  non-confidential documents — never real financial documents.
- Extraction quality depends on the underlying vision model's ability to read the
  document; the trust layer is designed to catch what extraction gets wrong, not to
  guarantee extraction is always correct.
- This is a demo deployment, evaluated as a working system — not a production service
  with SLAs, uptime guarantees, or multi-tenant data isolation.

## 11. Delivered Capabilities

| Capability | Included |
|---|---|
| Structured extraction | ✅ |
| Earned-confidence validation | ✅ |
| Human correction with re-validation | ✅ |
| Server-enforced trust gate | ✅ |
| Structured search/query | ✅ |
| Provenance (curated samples) | ✅ |
| Sample invoice sandbox | ✅ |
| Authentication / roles | ❌ (out of scope, D1/D18) |
| Multiple document types | ❌ (out of scope, D3) |
| Full-text/semantic search | ❌ (out of scope, D3/D6) |
| Natural-language query | ❌ (out of scope, D4) |
| Provenance on user uploads | ❌ (out of scope, D21) |
