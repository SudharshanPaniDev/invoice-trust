/**
 * Generates the 5 downloadable "realistic document condition" samples (D21 sandbox — see
 * the landing page's "Download sample invoices" section). Build-time only: run once, check
 * the output into public/samples/, never invoked at runtime. Not test fixtures — these are
 * meant to be downloaded and pushed through the normal live-extraction path, so their
 * underlying numbers are all internally consistent (real GSTIN checksum, sums that add up);
 * whatever confidence/flags they produce comes from the extraction actually reading a
 * distorted image, not from a planted error (see decisions.md D29).
 */
import { writeFileSync, mkdirSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { gstinCheckDigit } from "../lib/validation/gstin";

const OUT_DIR = join(__dirname, "..", "public", "samples");
mkdirSync(OUT_DIR, { recursive: true });

const validGstin = (first14: string) => first14 + gstinCheckDigit(first14);

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}
interface InvoiceData {
  vendorName: string;
  vendorAddress: string;
  gstin: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  taxRatePct: number;
  lineItems: LineItem[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function computeTotals(inv: InvoiceData) {
  const lines = inv.lineItems.map((li) => ({
    ...li,
    amount: Math.round(li.quantity * li.unitPrice * 100) / 100,
  }));
  const subtotal = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const taxAmount = Math.round(subtotal * (inv.taxRatePct / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  return { lines, subtotal, taxAmount, total };
}

// ---------------------------------------------------------------------------
// SVG invoice template, rasterized by sharp for the samples that need photo/scan distortion.
// ---------------------------------------------------------------------------
function invoiceSVG(
  inv: InvoiceData,
  opts: { width?: number; height?: number; stamp?: boolean; scribble?: boolean } = {},
) {
  const W = opts.width ?? 1000;
  const H = opts.height ?? 1300;
  const { lines, subtotal, taxAmount, total } = computeTotals(inv);
  const money = (n: number) => `${inv.currency} ${n.toFixed(2)}`;
  const rows: string[] = [];

  rows.push(
    `<text x="60" y="70" font-family="sans-serif" font-size="22" font-weight="bold">${esc(inv.vendorName)}</text>`,
    `<text x="60" y="94" font-family="sans-serif" font-size="14">GSTIN: ${esc(inv.gstin)}</text>`,
    `<text x="60" y="114" font-family="sans-serif" font-size="14">${esc(inv.vendorAddress)}</text>`,
    `<text x="${W - 60}" y="70" font-family="sans-serif" font-size="26" font-weight="bold" text-anchor="end">TAX INVOICE</text>`,
    `<text x="${W - 60}" y="110" font-family="sans-serif" font-size="14" text-anchor="end">Invoice No: ${esc(inv.invoiceNo)}</text>`,
    `<text x="${W - 60}" y="130" font-family="sans-serif" font-size="14" text-anchor="end">Invoice Date: ${esc(inv.invoiceDate)}</text>`,
    `<text x="${W - 60}" y="150" font-family="sans-serif" font-size="14" text-anchor="end">Due Date: ${esc(inv.dueDate)}</text>`,
  );

  let ty = 210;
  rows.push(`<line x1="60" y1="${ty}" x2="${W - 60}" y2="${ty}" stroke="black" stroke-width="1"/>`);
  ty += 24;
  rows.push(
    `<text x="60" y="${ty}" font-family="sans-serif" font-size="13" font-weight="bold">Description</text>`,
    `<text x="${W - 340}" y="${ty}" font-family="sans-serif" font-size="13" font-weight="bold">Qty</text>`,
    `<text x="${W - 260}" y="${ty}" font-family="sans-serif" font-size="13" font-weight="bold">Unit Price</text>`,
    `<text x="${W - 60}" y="${ty}" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="end">Amount</text>`,
  );
  ty += 10;
  rows.push(`<line x1="60" y1="${ty}" x2="${W - 60}" y2="${ty}" stroke="black" stroke-width="0.5"/>`);
  ty += 24;
  for (const l of lines) {
    rows.push(
      `<text x="60" y="${ty}" font-family="sans-serif" font-size="13">${esc(l.description)}</text>`,
      `<text x="${W - 340}" y="${ty}" font-family="sans-serif" font-size="13">${l.quantity}</text>`,
      `<text x="${W - 260}" y="${ty}" font-family="sans-serif" font-size="13">${l.unitPrice.toFixed(2)}</text>`,
      `<text x="${W - 60}" y="${ty}" font-family="sans-serif" font-size="13" text-anchor="end">${l.amount.toFixed(2)}</text>`,
    );
    ty += 22;
  }
  ty += 10;
  rows.push(`<line x1="60" y1="${ty}" x2="${W - 60}" y2="${ty}" stroke="black" stroke-width="1"/>`);
  ty += 30;
  rows.push(
    `<text x="${W - 60}" y="${ty}" font-family="sans-serif" font-size="14" text-anchor="end">Subtotal: ${money(subtotal)}</text>`,
  );
  ty += 22;
  rows.push(
    `<text x="${W - 60}" y="${ty}" font-family="sans-serif" font-size="14" text-anchor="end">GST @ ${inv.taxRatePct}%: ${money(taxAmount)}</text>`,
  );
  ty += 22;
  rows.push(
    `<text x="${W - 60}" y="${ty}" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="end">Total: ${money(total)}</text>`,
  );

  if (opts.stamp) {
    const cx = W - 200;
    const cy = ty + 110;
    rows.push(`<g transform="rotate(-18 ${cx} ${cy})">
      <ellipse cx="${cx}" cy="${cy}" rx="95" ry="48" fill="none" stroke="#a5301e" stroke-width="4"/>
      <text x="${cx}" y="${cy + 9}" font-family="sans-serif" font-size="28" font-weight="bold" fill="#a5301e" text-anchor="middle">PAID</text>
    </g>`);
  }
  if (opts.scribble) {
    const sy = ty + 170;
    rows.push(
      `<path d="M 90 ${sy} Q 130 ${sy - 35} 170 ${sy} T 250 ${sy} T 330 ${sy - 10}" stroke="#1a3fa0" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      `<text x="90" y="${sy + 26}" font-family="sans-serif" font-size="12" font-style="italic" fill="#1a3fa0">recd. w/ thanks</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    ${rows.join("\n")}
  </svg>`;
}

async function addGrain(base: sharp.Sharp, w: number, h: number, sigma = 22, alpha = 0.1) {
  const noise = await sharp({
    create: { width: w, height: h, channels: 3, noise: { type: "gaussian", mean: 128, sigma } },
  })
    .ensureAlpha(alpha)
    .png()
    .toBuffer();
  return base.composite([{ input: noise, blend: "over" }]);
}

async function addVignette(base: sharp.Sharp, w: number, h: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <radialGradient id="v" cx="50%" cy="50%" r="75%">
        <stop offset="55%" stop-color="black" stop-opacity="0"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.4"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#v)"/>
  </svg>`;
  const vignette = await sharp(Buffer.from(svg)).png().toBuffer();
  return base.composite([{ input: vignette, blend: "multiply" }]);
}

async function wrapImageAsPDF(imgBuffer: Buffer, outPath: string) {
  const pageSize: [number, number] = [595, 842];
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: pageSize, margin: 0 });
    const stream = createWriteStream(outPath);
    doc.pipe(stream);
    doc.image(imgBuffer, 0, 0, { fit: pageSize, align: "center", valign: "center" });
    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Sample 4 — scanned PDF: office-scanner look (skew, washed contrast, grain), image-in-PDF.
// ---------------------------------------------------------------------------
async function buildScannedSample() {
  const inv: InvoiceData = {
    vendorName: "Coastal Traders",
    vendorAddress: "12 Marine Drive, Kochi, Kerala 682001",
    gstin: validGstin("32AABCT1234M1"),
    invoiceNo: "CT-2026-0447",
    invoiceDate: "2026-06-18",
    dueDate: "2026-07-18",
    currency: "INR",
    taxRatePct: 18,
    lineItems: [
      { description: "Marine rope, 20mm (100m)", quantity: 4, unitPrice: 1850 },
      { description: "Anchor chain, galvanized", quantity: 2, unitPrice: 3200 },
      { description: "Deck fittings, set", quantity: 6, unitPrice: 650 },
    ],
  };
  const W = 1000;
  const H = 1300;
  const svg = invoiceSVG(inv, { width: W, height: H });
  let img = sharp(Buffer.from(svg))
    .rotate(1.6, { background: "#ffffff" })
    .modulate({ brightness: 1.04, saturation: 0.2 })
    .linear(0.9, 12);
  img = await addGrain(img, W, H, 20, 0.09);
  const buf = await img.flatten({ background: "#ffffff" }).png().toBuffer();
  await wrapImageAsPDF(buf, join(OUT_DIR, "scanned-invoice.pdf"));
  console.log("wrote scanned-invoice.pdf");
}

// ---------------------------------------------------------------------------
// Sample 5 — phone photo: rotation, mild shear, vignette, grain, JPEG recompression.
// ---------------------------------------------------------------------------
async function buildPhonePhotoSample() {
  const inv: InvoiceData = {
    vendorName: "Greenleaf Nursery & Garden Co.",
    vendorAddress: "48 Palace Road, Bengaluru, Karnataka 560020",
    gstin: validGstin("29AABCG5678N1"),
    invoiceNo: "GLN-8821",
    invoiceDate: "2026-06-30",
    dueDate: "2026-07-14",
    currency: "INR",
    taxRatePct: 18,
    lineItems: [
      { description: "Potted areca palm, 4ft", quantity: 5, unitPrice: 1200 },
      { description: "Organic potting mix, 40L", quantity: 8, unitPrice: 420 },
      { description: "Terracotta planters, 12in", quantity: 10, unitPrice: 380 },
    ],
  };
  const W = 1000;
  const H = 1300;
  const svg = invoiceSVG(inv, { width: W, height: H });
  let img = sharp(Buffer.from(svg))
    .rotate(5.2, { background: "#ffffff" })
    .affine([1, 0.04, 0.02, 1], { background: "#ffffff" })
    .modulate({ brightness: 1.08, saturation: 0.85 });
  img = await addGrain(img, W, H, 16, 0.07);
  img = await addVignette(img, W, H);
  const buf = await img.flatten({ background: "#ffffff" }).jpeg({ quality: 58 }).toBuffer();
  writeFileSync(join(OUT_DIR, "phone-photo-invoice.jpg"), buf);
  console.log("wrote phone-photo-invoice.jpg");
}

// ---------------------------------------------------------------------------
// Sample 6 — low-quality scan with a programmatic "PAID" stamp + pen-style annotation
// (replaces a literal handwriting simulation — no external fonts, D-decision on scope).
// ---------------------------------------------------------------------------
async function buildStampedScanSample() {
  const inv: InvoiceData = {
    vendorName: "Sunrise Hardware Stores",
    vendorAddress: "7 Station Road, Pune, Maharashtra 411001",
    gstin: validGstin("27AABCS4321P1"),
    invoiceNo: "SHS-3390",
    invoiceDate: "2026-05-22",
    dueDate: "2026-06-05",
    currency: "INR",
    taxRatePct: 18,
    lineItems: [
      { description: "Cement, 50kg bag", quantity: 12, unitPrice: 420 },
      { description: "Steel rods, 12mm (per unit)", quantity: 20, unitPrice: 610 },
      { description: "PVC pipe, 4in (per ft)", quantity: 40, unitPrice: 85 },
    ],
  };
  const W = 1000;
  const H = 1350;
  const svg = invoiceSVG(inv, { width: W, height: H, stamp: true, scribble: true });
  let img = sharp(Buffer.from(svg))
    .rotate(-1.2, { background: "#ffffff" })
    .modulate({ brightness: 1.02, saturation: 0.15 })
    .linear(0.88, 14);
  img = await addGrain(img, W, H, 24, 0.1);
  const buf = await img.flatten({ background: "#ffffff" }).png().toBuffer();
  await wrapImageAsPDF(buf, join(OUT_DIR, "stamped-scan-invoice.pdf"));
  console.log("wrote stamped-scan-invoice.pdf");
}

// ---------------------------------------------------------------------------
// Shared vector drawing for the two pure-pdfkit samples (no raster distortion needed).
// ---------------------------------------------------------------------------
function drawHeader(doc: PDFKit.PDFDocument, inv: InvoiceData, opts: { omitGstin?: boolean; omitDueDate?: boolean } = {}) {
  doc.fontSize(20).font("Helvetica-Bold").text(inv.vendorName, 50, 50);
  doc.fontSize(11).font("Helvetica");
  if (!opts.omitGstin) doc.text(`GSTIN: ${inv.gstin}`, 50, 76);
  doc.text(inv.vendorAddress, 50, opts.omitGstin ? 76 : 92);

  doc.fontSize(20).font("Helvetica-Bold").text("TAX INVOICE", 300, 50, { width: 245, align: "right" });
  doc.fontSize(11).font("Helvetica");
  doc.text(`Invoice No: ${inv.invoiceNo}`, 300, 84, { width: 245, align: "right" });
  doc.text(`Invoice Date: ${inv.invoiceDate}`, 300, 100, { width: 245, align: "right" });
  if (!opts.omitDueDate) doc.text(`Due Date: ${inv.dueDate}`, 300, 116, { width: 245, align: "right" });
}

function drawLineItemsHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.moveTo(50, y).lineTo(545, y).stroke();
  doc.fontSize(11).font("Helvetica-Bold");
  doc.text("Description", 50, y + 8);
  doc.text("Qty", 300, y + 8);
  doc.text("Unit Price", 360, y + 8);
  doc.text("Amount", 460, y + 8, { width: 85, align: "right" });
  doc.moveTo(50, y + 26).lineTo(545, y + 26).stroke();
  doc.font("Helvetica");
}

function drawTotals(doc: PDFKit.PDFDocument, inv: InvoiceData, y: number, opts: { faintTotal?: boolean } = {}) {
  const { subtotal, taxAmount, total } = computeTotals(inv);
  const money = (n: number) => `${inv.currency} ${n.toFixed(2)}`;
  doc.moveTo(50, y).lineTo(545, y).stroke();
  doc.fontSize(11).font("Helvetica");
  doc.text(`Subtotal: ${money(subtotal)}`, 300, y + 12, { width: 245, align: "right" });
  doc.text(`GST @ ${inv.taxRatePct}%: ${money(taxAmount)}`, 300, y + 28, { width: 245, align: "right" });
  if (opts.faintTotal) {
    doc.fontSize(7).fillColor("#d5d5d5");
    doc.text(`Total: ${money(total)}`, 300, y + 44, { width: 245, align: "right" });
    doc.fillColor("black");
  } else {
    doc.fontSize(14).font("Helvetica-Bold");
    doc.text(`Total: ${money(total)}`, 300, y + 44, { width: 245, align: "right" });
  }
}

// ---------------------------------------------------------------------------
// Sample 7 — multi-page invoice: header + partial line items page 1, remainder + totals
// page 2. Tests that extraction (and a future provenance viewer) handles page > 1.
// ---------------------------------------------------------------------------
function buildMultipageSample() {
  const inv: InvoiceData = {
    vendorName: "Metro Office Supplies Pvt Ltd",
    vendorAddress: "221 Anna Salai, Chennai, Tamil Nadu 600002",
    gstin: validGstin("33AABCM8899Q1"),
    invoiceNo: "MOS-2026-1187",
    invoiceDate: "2026-06-10",
    dueDate: "2026-07-10",
    currency: "INR",
    taxRatePct: 18,
    lineItems: [
      { description: "A4 copier paper, ream", quantity: 40, unitPrice: 260 },
      { description: "Ballpoint pens, box of 50", quantity: 15, unitPrice: 340 },
      { description: "Lever-arch files", quantity: 30, unitPrice: 95 },
      { description: "Desktop stapler", quantity: 12, unitPrice: 180 },
      { description: "Whiteboard markers, box", quantity: 20, unitPrice: 210 },
      { description: "Sticky notes, pack of 12", quantity: 25, unitPrice: 150 },
      { description: "Printer toner cartridge", quantity: 6, unitPrice: 3200 },
      { description: "Desk organizer trays", quantity: 10, unitPrice: 420 },
      { description: "Correction tape, pack of 5", quantity: 18, unitPrice: 165 },
      { description: "Binder clips, box of 100", quantity: 22, unitPrice: 95 },
    ],
  };

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = createWriteStream(join(OUT_DIR, "multipage-invoice.pdf"));
  doc.pipe(stream);

  drawHeader(doc, inv);
  drawLineItemsHeader(doc, 150);

  const { lines } = computeTotals(inv);
  let y = 190;
  const firstPageCount = 6;
  doc.fontSize(10);
  lines.slice(0, firstPageCount).forEach((l) => {
    doc.text(l.description, 50, y, { width: 240 });
    doc.text(String(l.quantity), 300, y);
    doc.text(l.unitPrice.toFixed(2), 360, y);
    doc.text(l.amount.toFixed(2), 460, y, { width: 85, align: "right" });
    y += 22;
  });
  doc.fontSize(9).fillColor("#888888").text("(continued on next page)", 50, y + 10);
  doc.fillColor("black");

  doc.addPage();
  doc.fontSize(11).font("Helvetica-Bold").text(`${inv.vendorName} — Invoice ${inv.invoiceNo} (page 2)`, 50, 50);
  drawLineItemsHeader(doc, 90);
  y = 130;
  doc.fontSize(10).font("Helvetica");
  lines.slice(firstPageCount).forEach((l) => {
    doc.text(l.description, 50, y, { width: 240 });
    doc.text(String(l.quantity), 300, y);
    doc.text(l.unitPrice.toFixed(2), 360, y);
    doc.text(l.amount.toFixed(2), 460, y, { width: 85, align: "right" });
    y += 22;
  });
  drawTotals(doc, inv, y + 16);

  doc.end();
  console.log("wrote multipage-invoice.pdf");
}

// ---------------------------------------------------------------------------
// Sample 8 — missing/illegible fields: no GSTIN line at all, no due date, and the total
// rendered too faint/small to confidently read — all realistic ways a real invoice under-
// specifies or degrades, no arithmetic error planted.
// ---------------------------------------------------------------------------
function buildMissingFieldsSample() {
  const inv: InvoiceData = {
    vendorName: "Northgate Electricals",
    vendorAddress: "9 Ring Road, Lucknow, Uttar Pradesh 226010",
    gstin: "",
    invoiceNo: "NGE-0056",
    invoiceDate: "2026-06-25",
    dueDate: "",
    currency: "INR",
    taxRatePct: 18,
    lineItems: [
      { description: "LED tube light, 20W", quantity: 30, unitPrice: 210 },
      { description: "MCB switch, 32A", quantity: 15, unitPrice: 165 },
      { description: "Wiring cable, 90m roll", quantity: 4, unitPrice: 2450 },
    ],
  };

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = createWriteStream(join(OUT_DIR, "missing-fields-invoice.pdf"));
  doc.pipe(stream);

  drawHeader(doc, inv, { omitGstin: true, omitDueDate: true });
  drawLineItemsHeader(doc, 150);

  const { lines } = computeTotals(inv);
  let y = 190;
  doc.fontSize(10);
  lines.forEach((l) => {
    doc.text(l.description, 50, y, { width: 240 });
    doc.text(String(l.quantity), 300, y);
    doc.text(l.unitPrice.toFixed(2), 360, y);
    doc.text(l.amount.toFixed(2), 460, y, { width: 85, align: "right" });
    y += 22;
  });
  drawTotals(doc, inv, y + 16, { faintTotal: true });

  doc.end();
  console.log("wrote missing-fields-invoice.pdf");
}

async function main() {
  await buildScannedSample();
  await buildPhonePhotoSample();
  await buildStampedScanSample();
  buildMultipageSample();
  buildMissingFieldsSample();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
