import { isBrowser } from "./hooks";

export type SpeechAccent = "british" | "american";

export function isTtsSupported(): boolean {
  return isBrowser() && "speechSynthesis" in window;
}

let currentRate = 0.85;
let currentAccent: SpeechAccent = "british";

const BRITISH_LANG = "en-GB";
const AMERICAN_LANG = "en-US";

export function setSpeechRate(rate: number): void {
  currentRate = rate;
}

export function getSpeechRate(): number {
  return currentRate;
}

export function setSpeechAccent(accent: SpeechAccent): void {
  currentAccent = accent;
}

export function getSpeechAccent(): SpeechAccent {
  return currentAccent;
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (!isTtsSupported()) return [];
  return window.speechSynthesis.getVoices();
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (!isTtsSupported()) return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return undefined;
  return (
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(lang.split("-")[0])) ||
    voices[0]
  );
}

export function speak(
  text: string,
  options?: { rate?: number; lang?: string; onEnd?: () => void }
): void {
  if (!isTtsSupported()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  const lang = options?.lang ?? (currentAccent === "british" ? BRITISH_LANG : AMERICAN_LANG);
  utterance.lang = lang;
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.rate = options?.rate ?? currentRate;
  utterance.pitch = 1;
  if (options?.onEnd) {
    utterance.onend = options.onEnd;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeech(): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
}
