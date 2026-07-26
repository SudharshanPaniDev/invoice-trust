/**
 * Automated accessibility check (D39) — the D27 UI pass followed agent-skills' WCAG 2.1 AA
 * guidance, but nothing ever actually verified it. This runs axe-core against the real
 * rendered pages and reports violations, turning "we followed guidance" into "we checked."
 *
 * Requires the dev server already running (`pnpm dev`, localhost:3000) — this script doesn't
 * spawn one itself, matching how every other ad-hoc Playwright check in this project has
 * worked. Run via `pnpm a11y`.
 */
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/db";

const ROOT = join(__dirname, "..");
const BASE_URL = "http://localhost:3000";

const SEEDED_FILE_URLS = ["sample-clean.pdf", "sample-invoice-01.pdf", "sample-mismatch.pdf"];

async function main() {
  const seeded = await prisma.invoice.findFirst({
    where: { fileUrl: { in: SEEDED_FILE_URLS } },
    select: { id: true },
  });
  await prisma.$disconnect();

  const pages: { name: string; path: string }[] = [
    { name: "Upload (landing)", path: "/" },
    { name: "Invoices (list)", path: "/invoices" },
  ];
  if (seeded) {
    pages.push({ name: "Invoice detail (seeded sample, has provenance viewer)", path: `/invoices/${seeded.id}` });
  } else {
    console.warn("No seeded sample found — run `pnpm db:seed` first for full coverage. Skipping detail page.");
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const lines: string[] = [`# Accessibility check (axe-core)\n`];
  let totalViolations = 0;

  for (const p of pages) {
    console.log(`\n=== ${p.name} (${p.path}) ===`);
    await page.goto(BASE_URL + p.path, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    lines.push(`## ${p.name} (\`${p.path}\`)\n`);
    if (results.violations.length === 0) {
      console.log("No violations.");
      lines.push("No violations.\n");
    } else {
      totalViolations += results.violations.length;
      for (const v of results.violations) {
        console.log(`[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`);
        lines.push(
          `- **[${v.impact}] ${v.id}** — ${v.description} (${v.nodes.length} node(s)) — ${v.helpUrl}`,
        );
      }
      lines.push("");
    }
  }

  await browser.close();

  lines.unshift(`Total violations across ${pages.length} pages: ${totalViolations}\n`);
  writeFileSync(join(ROOT, "docs", "a11y-results.md"), lines.join("\n"));

  console.log(`\n\nTotal violations: ${totalViolations}`);
  console.log("Report written to docs/a11y-results.md");

  if (totalViolations > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
