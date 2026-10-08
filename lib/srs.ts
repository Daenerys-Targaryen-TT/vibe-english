import { db } from "./db";
import type { WordEntry } from "./types";

export interface SrsState {
  intervalDays: number;
  nextReviewAt: number;
  ease: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function scheduleReview(
  quality: number,
  previous: { reviewCount: number; ease?: number; intervalDays?: number }
): SrsState {
  const ease = previous.ease ?? 2.5;
  const count = previous.reviewCount ?? 0;

  if (quality < 3) {
    return {
      intervalDays: 1,
      nextReviewAt: Date.now() + DAY_MS,
      ease: Math.max(1.3, ease - 0.2),
    };
  }

  let interval: number;
  if (count === 0) interval = 1;
  else if (count === 1) interval = 3;
  else interval = Math.round((previous.intervalDays ?? 3) * ease);

  const newEase =
    ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return {
    intervalDays: interval,
    nextReviewAt: Date.now() + interval * DAY_MS,
    ease: Math.max(1.3, newEase),
  };
}

export function qualityForResult(correct: boolean, accuracy: number): number {
  if (!correct) return accuracy >= 0.5 ? 2 : 1;
  if (accuracy >= 0.95) return 5;
  if (accuracy >= 0.8) return 4;
  return 3;
}

export async function updateWordSrs(
  entry: WordEntry,
  correct: boolean,
  accuracy: number
): Promise<void> {
  const word = entry.word;
  const existing = await db.vocabulary.get({ word });
  const quality = qualityForResult(correct, accuracy);
  const translation = entry.translations[0]?.translation ?? "";
  const phonetic = entry.phonetic?.us ?? entry.phonetic?.uk ?? "";

  if (existing) {
    const s = scheduleReview(quality, {
      reviewCount: existing.reviewCount,
      ease: existing.ease,
      intervalDays: existing.intervalDays,
    });
    const reviewCount = existing.reviewCount + 1;
    const mastered = quality >= 4 && reviewCount >= 2 && s.intervalDays >= 6;
    await db.vocabulary.update(existing.id!, {
      reviewCount,
      lastReviewAt: Date.now(),
      nextReviewAt: s.nextReviewAt,
      ease: s.ease,
      intervalDays: s.intervalDays,
      mastered,
      translation: translation || existing.translation,
      phonetic: phonetic || existing.phonetic,
    });
  } else if (!correct) {
    const s = scheduleReview(quality, { reviewCount: 0 });
    await db.vocabulary.add({
      word,
      translation,
      phonetic,
      addedAt: Date.now(),
      mastered: false,
      reviewCount: 1,
      lastReviewAt: Date.now(),
      nextReviewAt: s.nextReviewAt,
      ease: s.ease,
      intervalDays: s.intervalDays,
    });
  }
}
