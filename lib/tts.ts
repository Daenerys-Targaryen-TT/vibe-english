import { isBrowser } from "./hooks";

export function isTtsSupported(): boolean {
  return isBrowser() && "speechSynthesis" in window;
}

let currentRate = 0.9;

export function setSpeechRate(rate: number): void {
  currentRate = rate;
}

export function speak(
  text: string,
  options?: { rate?: number; lang?: string; onEnd?: () => void }
): void {
  if (!isTtsSupported()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = options?.lang ?? "en-US";
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

export function getVoices(): SpeechSynthesisVoice[] {
  if (!isTtsSupported()) return [];
  return window.speechSynthesis.getVoices();
}
