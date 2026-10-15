# Write & Speak — AI English Handwriting & Pronunciation Practice

A web app for learning English vocabulary by **writing it by hand** on a notebook-style canvas.
While you write, an on-device recognizer reads your strokes and predicts the word; after you press
**Check My Writing** you get spelling feedback and native pronunciation through the Web Speech API.

Inspired by the *feel* of Goodnotes (clean paper, pen toolbar, minimal chrome) — no logos or
screens are copied. No sign-up: progress is stored in `localStorage`.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Production build & run:

```bash
npm run build
npm start
```

## What you can do

- Write with **mouse, trackpad, stylus (pressure) or finger** — Pointer Events, `touch-action: none`.
- Notebook paper with ruled lines + handwriting guides (toggleable), 3 pen colours, adjustable width.
- **Undo / Redo / Eraser / Clear**, plus keyboard shortcuts:
  `P` pen · `E` eraser · `G` guides · `⌘/Ctrl+Z` undo · `⌘/Ctrl+Shift+Z` (or `⌘/Ctrl+Y`) redo · `⌘/Ctrl+K` clear.
- **Live AI predictions** in the side panel: top-3 words with calibrated confidence while you write.
- **Check My Writing** → expected word vs AI read, spelling accuracy, per-letter comparison,
  `Correct! / Almost there! / We could not read…` and Try Again · Listen · Continue actions.
- **Pronunciation**: American (en-US) or British (en-GB), speed 0.75x / 1x / 1.25x, word + example
  sentence playback, mute toggle in the header.
- **3 learning modes**: Copy & Write · Listen & Write (word hidden) · Guess & Write (Thai clue only),
  with Hint (reveals letters, −2 pts) and Show Answer.
- **Progress**: "Word n of N", score, per-word accuracy, end-of-lesson VocabularySummary — all in
  localStorage, restored on reload.
- Responsive (desktop / tablet / mobile), loading / empty / error states, ARIA labels + live regions.

## Project structure

```
src/
  app/
    page.tsx               # learning screen route
    dev/page.tsx           # recognizer diagnostics (drawing → segmentation/sims/decoding)
    api/recognize/route.ts # backend-model seam (MODEL_URL), falls back with 501
    api/tts/route.ts       # external-TTS seam (TTS_API_URL), falls back with 501
  components/              # LearningScreen + the10 reusable components from the spec
  hooks/                   # useStrokeHistory (undo/redo), useSpeech (TTS)
  lib/
    recognition/
      geometry.ts          # strokes → normalized16×16 ink grids (pure, no DOM)
      segmenter.ts         # strokes → individual glyphs (x-overlap clustering)
      templates.ts         # A–Z (upper+lower) templates rasterized from a handwriting-ish font
      scoring.ts           # tolerant ink-F1 similarity, DP word decoder, calibration
      service.ts           # RecognitionService: local on-device + remote (/api/recognize) adapter
      check.ts             # spelling check + feedback copy (separate from recognition)
    speech.ts              # SpeechService: Web Speech API + external-TTS adapter
    storage.ts             # localStorage progress/settings
    vocabulary.ts          # dataset loader (levels are data-driven)
  data/vocabulary.json     # A1/A2 words (id, word, meaningTh, phonetic, POS, example, CEFR, …)
  data/lexicon.json        # candidate words for prediction decoding
scripts/
  e2e.ts                   # full Chrome end-to-end suite (36 checks)
  recognition.test.ts      # pure-logic unit tests (38 checks)
  diagnose.ts              # dump what the recognizer sees for a drawn word
  pagecheck.ts             # quick page health check
```

## How the recognizer works (it really reads the strokes — there is no text input anywhere)

```
pointer events → strokes[]
     → segmenter      group strokes into glyphs (horizontal overlap → same letter)
     → geometry       rasterize each glyph to a normalized16×16 ink grid + aspect
     → templates      compare grid against A–Z (upper/lower) font-rasterized templates
                      score =0.78·ink-F1(neighbourhood tolerant) +0.22·aspect similarity
     → scoring (DP)   align glyph sequence to dictionary words, gaps allowed for
                      missing/extra letters; lesson words get a small explicit prior
     → top-3 words + calibrated confidence (capped at97% — never claims100%)
     → check.ts       align the same glyphs against the EXPECTED word:
                      per-letter match ≥0.55 → spelling accuracy; "correct" requires
                      every expected letter written and looking like that letter
```

Recognition (what the handwriting *looks like*) and spelling verification (whether the intended
word was spelled correctly) are deliberately separate steps, per the spec.

## Status: what is real, what is a prototype, what still needs a model

| Area | Status | Notes |
|---|---|---|
| Handwriting canvas (mouse/touch/stylus, pressure) | ✅ Real | Pointer Events, DPR-aware, live drawing |
| Undo / Redo / Eraser / Clear + shortcuts | ✅ Real | gesture-level history |
| On-device handwriting recognition | ✅ Real (heuristic) | template matching + DP decoder, runs in 2–5 ms/stroke |
| Prediction list with confidence | ✅ Real, **calibrated estimates** | not model probabilities; UI says so |
| Spelling check + feedback | ✅ Real | threshold constants in `lib/recognition/check.ts` |
| Text-to-Speech (US/UK, rates, sentences) | ✅ Real | Web Speech API; needs OS voices installed |
| Vocabulary dataset (A1/A2,55 words) | ✅ Real | `src/data/vocabulary.json`, schema ready for B1–C2 |
| Progress + settings persistence | ✅ Real | `localStorage`, no account |
| Responsive / a11y / loading / empty / error states | ✅ Real | tested at1360px and390px |
| `/api/recognize` backend model | ⛳ **Seam ready, no model yet** | set `MODEL_URL` to any endpoint with the documented contract; until then the client transparently uses the on-device matcher |
| `/api/tts` external TTS | ⛳ **Seam ready, no provider yet** | set `TTS_API_URL` returning `{audioUrl}`; otherwise Web Speech API is used |
| TensorFlow.js / learned handwriting model | ❌ **Not integrated** | `RecognitionService` interface is the drop-in point (`src/lib/recognition/service.ts`) — swap `LocalRecognitionService` without touching UI |
| Levels B1–C2 | ❌ **No data yet** | add entries to `vocabulary.json`; settings already expose the level chips |

Nothing in the UI pretends to be smarter than it is: confidence is labelled an estimate,
the backend chip states which recognizer produced a result, and unconfigured endpoints fall
back visibly instead of faking success.

## Testing

```bash
npm run typecheck         # tsc --noEmit
npm run test:recognition  #38 unit checks: segmentation, similarity, DP, feedback rules
npm run build

# end-to-end in real Chrome (server must be running):
PORT=3100 npm start &
npx tsx scripts/e2e.ts    #36 checks incl. drawing, predictions, feedback, TTS, touch, mobile

# inspect what the recognizer sees for a drawn word:
npx tsx scripts/diagnose.ts APPLE          # on the /dev diagnostics page
npx tsx scripts/diagnose.ts WATER --home   # on the real learning screen
```

Measured on this machine (mouse-drawn block capitals, headless Chrome):

| Word | Top-1 prediction | Confidence | Analysis time |
|---|---|---|---|
| APPLE | APPLE ✓ |93% | ~3 ms |
| CAT | CAT ✓ |95% |1.8 ms |
| DOG | DOG ✓ |96% |2.9 ms |
| BANANA | BANANA ✓ |96% |3.2 ms |
| GREEN | GREEN ✓ |94% |4.0 ms |
| WATER | WATER ✓ |94% |4.4 ms |

**Honest caveat:** these are clean, machine-drawn capitals. Real learners' handwriting (cursive,
small case, tilted, overlapping letters) will score lower — treat confidence as a hint, not a
measurement, and tune `LETTER_MATCH_THRESHOLD` / `CORRECT_THRESHOLD` with real samples.

## Extending

- **Add words/levels**: append to `src/data/vocabulary.json` (all fields in `src/lib/types.ts`).
- **Add prediction candidates**: `src/data/lexicon.json`.
- **Plug a real model**: implement `RecognitionService` (see the contract in
  `src/lib/recognition/service.ts`) and either mount it behind `POST /api/recognize` (`MODEL_URL`)
  or return it from `getRecognitionService()`.
- **Plug a hosted TTS**: set `TTS_API_URL`, or add an adapter next to `WebSpeechAdapter`.
- **Change the template font** (affects matching): `FONT_STACK` in
  `src/lib/recognition/templates.ts`.
