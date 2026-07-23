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
#    - GEMINI_API_KEY         — free, no card:  https://aistudio.google.com
#    - DATABASE_URL           — free Postgres:   https://neon.tech
#    - BLOB_READ_WRITE_TOKEN  — optional until the file-upload phase

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

## Data privacy note

The Gemini **free tier may use submitted data to improve Google's models** — use
sample/synthetic invoices only, never real confidential financials (see decisions D8).
