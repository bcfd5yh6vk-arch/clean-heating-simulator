/**
 * Export indexxx.html (10 slides) to a single landscape PDF.
 * Run from repo root: node paper/defense-slides/export-pdf.mjs
 */
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.join(__dirname, "indexxx.html");
const OUT_DIR = path.join(__dirname, "pdf");
const OUT_PDF = path.join(OUT_DIR, "indexxx.pdf");
const TOTAL = 10;
const W = 1920;
const H = 1080;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: W, height: H });

  const merged = await PDFDocument.create();

  for (let i = 1; i <= TOTAL; i++) {
    const url = `file://${HTML}?slide=${i}`;
    process.stdout.write(`Rendering slide ${i}/${TOTAL}…\n`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForFunction(() => document.querySelectorAll(".slide").length >= 10, null, {
      timeout: 30_000,
    });
    await page.waitForTimeout(600);

    const pdfBytes = await page.pdf({
      width: `${W}px`,
      height: `${H}px`,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    const doc = await PDFDocument.load(pdfBytes);
    const [pg] = await merged.copyPages(doc, [0]);
    merged.addPage(pg);
  }

  await browser.close();
  await writeFile(OUT_PDF, await merged.save());
  process.stdout.write(`Wrote ${OUT_PDF}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
