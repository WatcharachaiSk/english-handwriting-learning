/** Loads a page and prints body text + console/page errors (quick triage). */

import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.argv[2] ?? "http://localhost:3100/";
const WIDTH = Number(process.argv[3] ?? 1360);
const HEIGHT = Number(process.argv[4] ?? 900);

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT });
  const logs: string[] = [];
  page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${String(e)}`));
  page.on("requestfailed", (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 4000));

  const text = await page.evaluate(() => document.body.innerText.slice(0, 600));
  const hasCanvas = await page.$('[data-testid="handwriting-canvas"]') !== null;
  const canvasBox = await (await page.$('[data-testid="handwriting-canvas"]'))?.boundingBox();
  const checkBtn = await (await page.$('[data-testid="check-writing"]'))?.boundingBox();
  const toolbar = await (await page.$('[data-testid="tool-undo"]'))?.boundingBox();
  console.log("canvas:", hasCanvas, canvasBox ? `${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)}` : "");
  console.log(
    "check button:",
    checkBtn ? `x=${Math.round(checkBtn.x)}..${Math.round(checkBtn.x + checkBtn.width)}` : "missing",
    "undo:",
    toolbar ? `x=${Math.round(toolbar.x)}` : "missing",
    "viewport:",
    WIDTH,
  );
  console.log("body:", JSON.stringify(text));
  console.log("logs:\n" + logs.slice(0, 25).join("\n"));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
