import { db } from "./db";
import type { WordEntry } from "./types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type PracticeMode = "smart" | "review" | "wrong";

export interface SessionWordSource {
  due: number;
  wrong: number;
  fresh: number;
}

export async function buildSessionWords(
  pool: WordEntry[],
  count: number,
  mode: PracticeMode = "smart"
): Promise<{ words: WordEntry[]; source: SessionWordSource }> {
  const byWord = new Map(pool.map((w) => [w.word.toLowerCase(), w]));

  const now = Date.now();
  const dueList = await db.vocabulary
    .where("nextReviewAt")
    .above(0)
    .and((w) => (w.nextReviewAt ?? 0) <= now)
    .toArray();
  const dueEntries: WordEntry[] = [];
  for (const v of dueList) {
    const e = byWord.get(v.word.toLowerCase());
    if (e) dueEntries.push(e);
  }

  const wrongRecords = await db.typingRecords.filter((r) => !r.correct).toArray();
  const wrongCount = new Map<string, number>();
  for (const r of wrongRecords) {
    const k = r.word.toLowerCase();
    wrongCount.set(k, (wrongCount.get(k) ?? 0) + 1);
  }
  const wrongEntries: WordEntry[] = [...wrongCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => byWord.get(w))
    .filter((e): e is WordEntry => Boolean(e));

  const dueKeys = new Set(dueEntries.map((e) => e.word.toLowerCase()));
  const wrongKeys = new Set(wrongEntries.map((e) => e.word.toLowerCase()));

  if (mode === "wrong") {
    const chosen = shuffle(wrongEntries).slice(0, count);
    return {
      words: chosen,
      source: {
        due: 0,
        wrong: chosen.length,
        fresh: 0,
      },
    };
  }

  if (mode === "review") {
    const seen = new Set<string>();
    const merged: WordEntry[] = [];
    for (const e of [...dueEntries, ...wrongEntries]) {
      const key = e.word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(e);
    }
    const chosen = shuffle(merged).slice(0, count);
    return {
      words: chosen,
      source: {
        due: chosen.filter((e) => dueKeys.has(e.word.toLowerCase())).length,
        wrong: chosen.filter(
          (e) => wrongKeys.has(e.word.toLowerCase()) && !dueKeys.has(e.word.toLowerCase())
        ).length,
        fresh: 0,
      },
    };
  }

  const seen = new Set<string>();
  const priority: WordEntry[] = [];
  for (const e of [...dueEntries, ...wrongEntries]) {
    const key = e.word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    priority.push(e);
  }

  const reviewCap = Math.max(0, Math.ceil(count * 0.7));
  const selected = shuffle(priority).slice(0, reviewCap);

  const fresh = shuffle(pool.filter((w) => !seen.has(w.word.toLowerCase())));
  for (const e of fresh) {
    if (selected.length >= count) break;
    selected.push(e);
  }

  const chosen = selected.slice(0, count);
  return {
    words: shuffle(chosen),
    source: {
      due: chosen.filter((e) => dueKeys.has(e.word.toLowerCase())).length,
      wrong: chosen.filter(
        (e) => wrongKeys.has(e.word.toLowerCase()) && !dueKeys.has(e.word.toLowerCase())
      ).length,
      fresh: chosen.filter(
        (e) => !dueKeys.has(e.word.toLowerCase()) && !wrongKeys.has(e.word.toLowerCase())
      ).length,
    },
  };
}
