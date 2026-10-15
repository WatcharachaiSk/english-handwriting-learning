/**
 * End-to-end smoke test for Write & Speak, driving real Chrome.
 *
 *   npm run build && PORT=3100 npm start   (server)
 *   npx tsx scripts/e2e.ts                 (test)
 *
 * Draws real handwriting with the mouse, then asserts on predictions,
 * feedback, undo/redo/eraser/clear, modes, persistence, TTS and mobile layout.
 */

import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { dragErase, inkCount, makeChecker, textOf, waitText, writeWord } from "./lib";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";

async function main() {
  const { results, check } = makeChecker();
  const browser: Browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--lang=en-US"],
  });
  const page: Page = await browser.newPage();
  await page.setViewport({ width: 1360, height: 900 });

  const badResponses: string[] = [];
  const consoleErrors: string[] = [];
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 400) badResponses.push(`${status} ${res.url()}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${String(err)}`));

  // ---------- load ----------
  await page.goto(BASE_URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });

  check("app logo renders", (await textOf(page, '[data-testid="app-logo"]')).includes("Write & Speak"));
  const targetWord = await waitText(page, '[data-testid="target-word"]', 8000);
  check("first target word visible (Copy & Write)", targetWord === "APPLE", `got "${targetWord}"`);
  const meaning = await textOf(page, '[data-testid="target-meaning"]');
  check("Thai meaning shown", meaning.includes("แอปเปิล"), meaning);
  check("empty prediction state", (await textOf(page, '[data-testid="prediction-empty"]')).length > 10);

  // ---------- write + live prediction ----------
  await writeWord(page, "APPLE");
  const ink1 = await inkCount(page);
  check("ink drawn on canvas", ink1 > 500, `ink px ≈ ${ink1}`);

  await page.waitForFunction(
    () => (document.querySelector('[data-testid="prediction-word-0"]')?.textContent ?? "").length > 0,
    { timeout: 6000 },
  );
  await new Promise((r) => setTimeout(r, 600)); // let the final gesture settle
  const pred0 = await textOf(page, '[data-testid="prediction-word-0"]');
  const conf0 = await textOf(page, '[data-testid="prediction-conf-0"]');
  const pred1 = await textOf(page, '[data-testid="prediction-word-1"]');
  const pred2 = await textOf(page, '[data-testid="prediction-word-2"]');
  check("live prediction appears", pred0.length > 0, `${pred0} ${conf0} | ${pred1} | ${pred2}`);
  check("top prediction is APPLE", pred0 === "APPLE", `${pred0} (${conf0})`);
  check("three suggestions shown", pred2.length > 0, `${pred0}, ${pred1}, ${pred2}`);
  check("confidence below 100% (honest)", !conf0.includes("100%"), conf0);

  // ---------- check ----------
  await page.click('[data-testid="check-writing"]');
  const fbTitle = await waitText(page, '[data-testid="feedback-title"]', 8000);
  const accuracy = await textOf(page, '[data-testid="feedback-accuracy"]');
  const predicted = await textOf(page, '[data-testid="feedback-predicted"]');
  check("feedback shown", fbTitle.length > 0, fbTitle);
  check(
    "correct handwriting marked correct",
    fbTitle.toLowerCase().includes("correct"),
    `${fbTitle} | read=${predicted} | accuracy=${accuracy}`,
  );

  // ---------- pronunciation ----------
  const speechInfo = await page.evaluate(() => ({
    supported: "speechSynthesis" in window,
    voices: "speechSynthesis" in window ? window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en")).length : 0,
  }));
  check("Web Speech API available", speechInfo.supported, JSON.stringify(speechInfo));
  check("English voices present", speechInfo.voices > 0, `${speechInfo.voices} voices`);
  await page.click('[data-testid="feedback-listen"]');
  await new Promise((r) => setTimeout(r, 800));
  const speaking = await page.evaluate(() => window.speechSynthesis.speaking);
  check("TTS starts speaking", speaking, `speaking=${speaking}`);

  // ---------- continue ----------
  await page.click('[data-testid="feedback-continue"]');
  const secondWord = await waitText(page, '[data-testid="target-word"]');
  check("Next word advances", secondWord !== "APPLE", secondWord);
  const progressLabel = await textOf(page, '[data-testid="progress-label"]');
  check("progress tracker updates", progressLabel.includes("2 of"), progressLabel);
  const scoreLabel = await textOf(page, '[data-testid="score-label"]');
  const scoreValue = Number(scoreLabel.replace(/[^0-9]/g, ""));
  check("score awarded for correct answer", scoreValue > 0, scoreLabel);

  // ---------- undo / redo / eraser / clear ----------
  await writeWord(page, "T");
  const inkT = await inkCount(page);
  await page.click('[data-testid="tool-undo"]');
  const inkAfterUndo = await inkCount(page);
  check("undo removes last gesture", inkAfterUndo < inkT * 0.6, `${inkT} → ${inkAfterUndo}`);
  await page.click('[data-testid="tool-redo"]');
  const inkAfterRedo = await inkCount(page);
  check("redo restores it", inkAfterRedo > inkT * 0.6, `${inkAfterUndo} → ${inkAfterRedo}`);

  await page.click('[data-testid="tool-eraser"]');
  await dragErase(page);
  const inkAfterErase = await inkCount(page);
  check("eraser removes ink", inkAfterErase < 60, `${inkAfterRedo} → ${inkAfterErase}`);

  await page.click('[data-testid="tool-pen"]');
  await writeWord(page, "T");
  await page.click('[data-testid="tool-clear"]');
  const inkAfterClear = await inkCount(page);
  check("clear empties the page", inkAfterClear < 60, `${inkAfterClear}`);

  // ---------- wrong answer ----------
  await writeWord(page, "ZZZ");
  await new Promise((r) => setTimeout(r, 700));
  await page.click('[data-testid="check-writing"]');
  const wrongTitle = await waitText(page, '[data-testid="feedback-title"]', 8000);
  const wrongAccuracy = await textOf(page, '[data-testid="feedback-accuracy"]');
  const wrongPredicted = await textOf(page, '[data-testid="feedback-predicted"]');
  check(
    "wrong word is not marked correct",
    !wrongTitle.toLowerCase().includes("correct"),
    `${wrongTitle} | read=${wrongPredicted} | accuracy=${wrongAccuracy}`,
  );

  // ---------- modes ----------
  const currentWord = await textOf(page, '[data-testid="target-word"]');
  await page.click('[data-testid="mode-listen"]');
  await page.waitForSelector('[data-testid="word-pattern"]');
  const wordWhileHidden = await page.$('[data-testid="target-word"]');
  check("Listen & Write hides the word", wordWhileHidden === null, "pattern shown instead of word");
  const pattern = await textOf(page, '[data-testid="word-pattern"]');
  check(
    "hidden pattern matches word length",
    pattern.split(" ").length === currentWord.length,
    `"${pattern}" vs ${currentWord}`,
  );

  await page.click('[data-testid="mode-guess"]');
  await page.waitForSelector('[data-testid="word-pattern"]');
  const hasClue = await page.evaluate(() => document.body.innerText.includes("คำใบ้:"));
  check("Guess & Write shows Thai clue", hasClue);

  // hint + show answer
  await page.click('[data-testid="mode-copy"]');
  await page.waitForSelector('[data-testid="target-word"]');
  await page.click('[data-testid="challenge-hint"]');
  await new Promise((r) => setTimeout(r, 150));
  const hintText = await page.evaluate(() => document.querySelector('[aria-label="Hint letters"]')?.textContent ?? "");
  check("hint reveals a letter", hintText.trim().length > 1, hintText.trim());
  await page.click('[data-testid="challenge-show-answer"]');
  const revealedWord = await textOf(page, '[data-testid="target-word"]');
  check("show answer reveals word", revealedWord === currentWord, revealedWord);

  // ---------- persistence ----------
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector('[data-testid="target-word"]');
  const scoreAfterReload = await textOf(page, '[data-testid="score-label"]');
  const scoreAfterValue = Number(scoreAfterReload.replace(/[^0-9]/g, ""));
  check("progress persists in localStorage", scoreAfterValue > 0, scoreAfterReload);
  const stored = await page.evaluate(() => localStorage.getItem("write-and-speak:progress:v1"));
  check("localStorage record exists", !!stored && stored.includes('"version":1'), stored ? `${stored.slice(0, 90)}…` : "none");

  // ---------- keyboard shortcuts ----------
  await writeWord(page, "L");
  const inkBeforeKb = await inkCount(page);
  await page.keyboard.down("Control");
  await page.keyboard.press("z");
  await page.keyboard.up("Control");
  await new Promise((r) => setTimeout(r, 200));
  const inkAfterKb = await inkCount(page);
  check("Ctrl+Z undoes", inkAfterKb < inkBeforeKb * 0.6, `${inkBeforeKb} → ${inkAfterKb}`);

  // ---------- backend switch falls back gracefully ----------
  await page.click('[data-testid="settings-toggle"]');
  await page.waitForSelector('[data-testid="settings-panel"]');
  await page.click('[data-testid="backend-remote"]');
  await page.click('[data-testid="settings-toggle"]');
  await writeWord(page, "R");
  await new Promise((r) => setTimeout(r, 1200));
  const note = await page.evaluate(() => document.querySelector('[data-testid="prediction-list"]')?.textContent ?? "");
  check("remote backend falls back to on-device", note.includes("on-device") || /%/.test(note), note.slice(-140));
  await page.click('[data-testid="settings-toggle"]');
  await page.click('[data-testid="backend-local"]');

  // ---------- mobile ----------
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector('[data-testid="handwriting-canvas"]');
  const mobileCanvas = await (await page.$('[data-testid="handwriting-canvas"]'))!.boundingBox();
  check(
    "canvas fits mobile viewport",
    !!mobileCanvas && mobileCanvas.width <= 390 && mobileCanvas.width > 300,
    mobileCanvas ? `${Math.round(mobileCanvas.width)}x${Math.round(mobileCanvas.height)}` : "missing",
  );
  const checkBtn = await page.$('[data-testid="check-writing"]');
  const checkBox = checkBtn ? await checkBtn.boundingBox() : null;
  check(
    "primary action visible on mobile",
    !!checkBox && checkBox.x >= 0 && checkBox.x + checkBox.width <= 390,
    checkBox ? `x=${Math.round(checkBox.x)} w=${Math.round(checkBox.width)}` : "missing",
  );

  // ---------- touch input (finger drawing) ----------
  const handle = await page.$('[data-testid="handwriting-canvas"]');
  if (handle) {
    await handle.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await new Promise((r) => setTimeout(r, 250));
    const mbox = await handle.boundingBox();
    if (mbox) {
      const cdp = await page.createCDPSession();
      const tx = mbox.x + mbox.width * 0.3;
      const ty = mbox.y + mbox.height * 0.5;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: tx, y: ty }] });
      for (let i = 1; i <= 24; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: tx + i * 7, y: ty + Math.sin(i / 3) * 24 }],
        });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await new Promise((r) => setTimeout(r, 300));
      const touchInk = await inkCount(page);
      check("finger/touch drawing works", touchInk > 50, `ink px ≈ ${touchInk}`);
    }
  }

  // ---------- errors ----------
  const unexpectedResponses = badResponses.filter((r) => !r.includes("/api/") && !r.includes("favicon"));
  check("no unexpected HTTP errors", unexpectedResponses.length === 0, unexpectedResponses.slice(0, 3).join(" | "));
  // 501s are the expected "model not configured → fall back" probes of /api/*.
  const realErrors = consoleErrors.filter(
    (e) =>
      !e.includes("favicon") &&
      !e.includes("Download the React DevTools") &&
      !e.includes("501 (Not Implemented)"),
  );
  check("no console errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("Failed:\n" + failed.map((f) => ` - ${f.name}: ${f.detail}`).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
