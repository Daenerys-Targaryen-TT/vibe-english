import Dexie, { type Table } from "dexie";

export interface TypingRecord {
  id?: number;
  word: string;
  mode: string;
  correct: boolean;
  accuracy: number;
  timestamp: number;
  duration: number;
}

export interface VocabularyWord {
  id?: number;
  word: string;
  translation: string;
  phonetic: string;
  addedAt: number;
  mastered: boolean;
  reviewCount: number;
  lastReviewAt: number | null;
  nextReviewAt: number | null;
  ease?: number;
  intervalDays?: number;
}

export interface ReadingProgress {
  id?: number;
  articleId: string;
  lastParagraphId: string;
  updatedAt: number;
}

export interface WritingDraft {
  id?: number;
  promptId: string;
  content: string;
  wordCount: number;
  savedAt: number;
  submittedAt: number | null;
  checkResult: LanguageToolResult | null;
}

export interface TranslationRecord {
  id?: number;
  materialId: string;
  sentenceId: string;
  userTranslation: string;
  reference: string;
  notes: string;
  timestamp: number;
}

export interface DailyStat {
  date: string;
  typingMinutes: number;
  readingMinutes: number;
  writingMinutes: number;
  translationMinutes: number;
  wordsLearned: number;
  typingCount: number;
  typingCorrect: number;
  readingCount: number;
  writingCount: number;
  translationCount: number;
}

export interface LanguageToolMatch {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { id: string; description: string; category: { id: string; name: string } };
  sentence: string;
}

export interface LanguageToolResult {
  matches: LanguageToolMatch[];
}

export interface ListeningRecord {
  id?: number;
  sentenceId: string;
  correct: boolean;
  accuracy: number;
  timestamp: number;
  duration: number;
}

class VibeEnglishDB extends Dexie {
  typingRecords!: Table<TypingRecord, number>;
  vocabulary!: Table<VocabularyWord, number>;
  readingProgress!: Table<ReadingProgress, number>;
  writingDrafts!: Table<WritingDraft, number>;
  translationRecords!: Table<TranslationRecord, number>;
  dailyStats!: Table<DailyStat, string>;
  listeningRecords!: Table<ListeningRecord, number>;

  constructor() {
    super("vibe-english");
    this.version(1).stores({
      typingRecords: "++id, word, mode, timestamp",
      vocabulary: "++id, &word, mastered, nextReviewAt",
      readingProgress: "++id, articleId",
      writingDrafts: "++id, promptId, savedAt",
      translationRecords: "++id, materialId, sentenceId, timestamp",
      dailyStats: "date",
    });
    this.version(2).stores({
      listeningRecords: "++id, sentenceId, timestamp",
    });
  }
}

export const db = new VibeEnglishDB();

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type CounterFields =
  | "typingCount"
  | "typingCorrect"
  | "readingCount"
  | "writingCount"
  | "translationCount"
  | "wordsLearned";

const emptyDaily = (date: string): DailyStat => ({
  date,
  typingMinutes: 0,
  readingMinutes: 0,
  writingMinutes: 0,
  translationMinutes: 0,
  wordsLearned: 0,
  typingCount: 0,
  typingCorrect: 0,
  readingCount: 0,
  writingCount: 0,
  translationCount: 0,
});

export async function addMinutes(
  module: "typing" | "reading" | "writing" | "translation",
  minutes: number,
  increments?: Partial<Pick<DailyStat, CounterFields>>
): Promise<void> {
  const key = todayKey();
  const existing = await db.dailyStats.get(key);
  const base = existing ?? emptyDaily(key);
  const field = `${module}Minutes` as const;
  const next: DailyStat = { ...base, [field]: base[field] + minutes };
  if (increments) {
    for (const [k, v] of Object.entries(increments) as [CounterFields, number][]) {
      next[k] = base[k] + v;
    }
  }
  await db.dailyStats.put(next);
}
