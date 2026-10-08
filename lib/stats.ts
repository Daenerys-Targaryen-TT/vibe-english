import { db, todayKey } from "./db";

export interface StreakInfo {
  current: number;
  longest: number;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function computeStreak(): Promise<StreakInfo> {
  const all = await db.dailyStats.toArray();
  if (all.length === 0) return { current: 0, longest: 0 };

  const days = new Set(all.map((s) => s.date));
  let longest = 0;
  let current = 0;

  const today = startOfDay(new Date());
  let cursor = new Date(today);

  if (!days.has(todayKey(cursor))) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  while (days.has(todayKey(cursor))) {
    current++;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  let run = 0;
  let prev: Date | null = null;
  const sorted = [...days].sort();
  for (const key of sorted) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (prev && date.getTime() - prev.getTime() === 24 * 60 * 60 * 1000) {
      run++;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = date;
  }

  return { current, longest };
}

export async function getDaysSinceFirstUse(): Promise<number> {
  const all = await db.dailyStats.toArray();
  if (all.length === 0) return 0;
  const dates = all.map((s) => new Date(s.date).getTime());
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  return Math.max(1, Math.round((max - min) / (24 * 60 * 60 * 1000)) + 1);
}
