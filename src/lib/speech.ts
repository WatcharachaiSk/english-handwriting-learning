/**
 * Text-to-Speech (Section 4).
 *
 * WebSpeechAdapter is the default prototype backend (browser speechSynthesis).
 * HttpSpeechAdapter is the seam for a hosted TTS API — point it at /api/tts
 * (or any provider) and the UI does not change.
 */

export type Accent = "en-US" | "en-GB";
export type Rate = 0.75 | 1 | 1.25;

export interface SpeakOptions {
  rate: Rate;
  accent: Accent;
}

export interface SpeechService {
  readonly name: string;
  readonly supported: boolean;
  /** Resolves when playback finishes (or a safety timeout elapses). */
  speak(text: string, options: SpeakOptions): Promise<void>;
  cancel(): void;
  /** True when the platform actually has voices to speak with. */
  hasVoices(): boolean;
}

const ACCENT_PREFERRED: Record<Accent, string[]> = {
  "en-US": ["Google US English", "Samantha", "Alex", "Microsoft Aria", "en-US"],
  "en-GB": ["Google UK English Female", "Google UK English Male", "Daniel", "Serena", "en-GB"],
};

function scoreVoice(voice: SpeechSynthesisVoice, accent: Accent): number {
  const name = voice.name || "";
  let score = 0;
  if (voice.lang === accent) score += 100;
  else if (voice.lang?.startsWith(accent.slice(0, 2))) score += 60;
  const prefs = ACCENT_PREFERRED[accent];
  for (let i = 0; i < prefs.length; i++) {
    if (name === prefs[i]) return score + 50 - i;
    if (name.includes(prefs[i])) return score + 40 - i;
  }
  if (voice.localService) score += 2;
  return score;
}

export class WebSpeechAdapter implements SpeechService {
  readonly name = "Web Speech API (speechSynthesis)";
  private voices: SpeechSynthesisVoice[] = [];
  private cancelRequested = false;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const load = () => {
        this.voices = window.speechSynthesis.getVoices();
      };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }

  get supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  hasVoices(): boolean {
    if (!this.supported) return false;
    if (this.voices.length === 0) this.voices = window.speechSynthesis.getVoices();
    return this.voices.filter((v) => v.lang?.startsWith("en")).length > 0;
  }

  cancel(): void {
    this.cancelRequested = true;
    if (this.supported) window.speechSynthesis.cancel();
  }

  speak(text: string, options: SpeakOptions): Promise<void> {
    if (!this.supported || !text.trim()) return Promise.resolve();
    this.cancelRequested = false;
    window.speechSynthesis.cancel();

    return new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = options.accent;
      utter.rate = options.rate;
      utter.pitch = 1;

      const voices = this.hasVoices() ? this.voices : [];
      const best = voices
        .slice()
        .sort((a, b) => scoreVoice(b, options.accent) - scoreVoice(a, options.accent))[0];
      if (best) utter.voice = best;

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        utter.onend = null;
        utter.onerror = null;
        resolve();
      };
      utter.onend = finish;
      utter.onerror = finish;

      // Safety net: some browsers never fire `end` when no audio device exists.
      const timer = window.setTimeout(finish, 1800 + text.length * 220 / options.rate);

      window.speechSynthesis.speak(utter);
    });
  }
}

/**
 * Placeholder for an external TTS provider. It probes /api/tts once; while the
 * endpoint is not configured it reports itself unsupported so callers fall back
 * to the Web Speech API.
 */
export class HttpSpeechAdapter implements SpeechService {
  readonly name = "External TTS API (/api/tts)";
  private available: boolean | null = null;

  constructor(private fallback: SpeechService) {}

  get supported(): boolean {
    return this.fallback.supported;
  }

  hasVoices(): boolean {
    return this.fallback.hasVoices();
  }

  cancel(): void {
    this.fallback.cancel();
  }

  async speak(text: string, options: SpeakOptions): Promise<void> {
    if (this.available !== false) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, lang: options.accent, rate: options.rate }),
        });
        if (res.ok) {
          const data = (await res.json()) as { audioUrl?: string };
          if (data.audioUrl) {
            this.available = true;
            await playUrl(data.audioUrl, options.rate);
            return;
          }
        }
        this.available = false;
      } catch {
        this.available = false;
      }
    }
    return this.fallback.speak(text, options);
  }
}

function playUrl(url: string, rate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.playbackRate = rate;
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("audio playback failed"));
    audio.play().catch(reject);
  });
}

let web: WebSpeechAdapter | null = null;
let http: HttpSpeechAdapter | null = null;

export function getSpeechService(backend: "web" | "http" = "web"): SpeechService {
  if (backend === "http") {
    if (!http) {
      if (!web) web = new WebSpeechAdapter();
      http = new HttpSpeechAdapter(web);
    }
    return http;
  }
  if (!web) web = new WebSpeechAdapter();
  return web;
}
