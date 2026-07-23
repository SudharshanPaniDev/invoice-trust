# Invoice Trust Layer

Messy invoices → structured, **trustworthy**, queryable data. Every extracted field is
confidence-scored (confidence *earned by validation*, not claimed by the model), traceable
to its source in the document, and correctable by a human.

Zamp Engineering Project · Problem #3. See [`docs/plan.md`](docs/plan.md) for the full plan
and [`decisions.md`](decisions.md) for the reasoning behind every call.

## Stack

Next.js 15 (App Router, TS) · Postgres (Neon) + Prisma · Google Gemini (vision extraction,
free tier) · Zod · Vitest · Tailwind. Deploy: Vercel + Neon.

## One-shot setup

```bash
# 1. Install deps
pnpm install

# 2. Configure environment
cp .env.example .env
#    then fill in:
#    - GEMINI_API_KEY  — free, no card:  https://aistudio.google.com
#    - DATABASE_URL    — free Postgres:   https://neon.tech
#    (no file storage token needed — uploaded documents are never persisted, see below)

# 3. Create the database schema
pnpm db:push        # push the Prisma schema to your database
pnpm db:generate    # generate the typed Prisma client

# 4. Run
pnpm dev            # http://localhost:3000
```

## Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Start the dev server                          |
| `pnpm build`        | Production build                              |
| `pnpm test`         | Run the test suite (Vitest)                   |
| `pnpm db:push`      | Apply the Prisma schema to the database       |
| `pnpm db:migrate`   | Create + apply a migration (dev)              |
| `pnpm db:generate`  | Regenerate the typed Prisma client            |

## Design decisions

### Extraction and data use

The Gemini **free tier may use submitted data to improve Google's models** — use
sample/synthetic invoices only, never real confidential financials (see decisions D8).

### Document storage and retention

**What this project does:** an uploaded invoice is processed entirely in memory. The file
is sent to the extraction model, the resulting structured data is validated and persisted,
and the original file bytes are discarded once the request completes. No copy of the source
document is retained anywhere.

**What a production system would normally do:** a real financial system typically retains
the source document — usually in encrypted object storage (e.g. S3, Azure Blob) — to
support audits, regulatory retention requirements, dispute resolution, and re-processing if
extraction logic changes later. Discarding the source file is *not* the production-grade
default; it's a deliberate simplification made for this context, not a missing feature.

**Why that tradeoff here:** this is a portfolio project on a public, unauthenticated
deployment, with no team, no access controls, no audit logging, and no organizational
separation between "the person who wrote the code" and "the person who could access stored
data" — they're the same person. Encryption at rest protects against external threats (a
leaked credential, a storage breach) but doesn't address that specific gap, since whoever
implements the encryption also holds the key. Given that, minimizing retention — not storing
the document at all — is the safer default for handling other people's documents here,
rather than storing them (even encrypted) under a promise to handle them responsibly.

**What would change in a production version:** encrypted object storage for the source
document, an application-level encryption layer independent of the storage provider's
defaults, role-based access control with audit logging on any access to stored documents,
and a configurable retention/deletion policy. Full reasoning in
[`decisions.md`](decisions.md), D21.
