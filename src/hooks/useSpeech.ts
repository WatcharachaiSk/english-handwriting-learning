"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSpeechService, type Accent, type Rate, type SpeechService } from "@/lib/speech";

/** React wrapper around the pluggable TTS service. */
export function useSpeech() {
  const service: SpeechService = useMemo(() => getSpeechService("web"), []);
  const [supported, setSupported] = useState(false);
  const [hasVoices, setHasVoices] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(service.supported);
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const ok = service.hasVoices();
      if (ok || tries >= 24) {
        setHasVoices(ok);
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [service]);

  const speak = useCallback(
    async (text: string, opts: { rate: Rate; accent: Accent }) => {
      if (!text.trim()) return;
      setSpeaking(true);
      try {
        await service.speak(text, opts);
      } finally {
        setSpeaking(false);
      }
    },
    [service],
  );

  const cancel = useCallback(() => service.cancel(), [service]);

  return { supported, hasVoices, speaking, speak, cancel, backend: service.name };
}
