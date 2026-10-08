import { db, todayKey } from "./db";
import { computeStreak } from "./stats";

export interface DailyReport {
  date: string;
  hasActivity: boolean;
  totalMinutes: number;
  typing: { count: number; accuracy: number; wrongWords: string[] };
  listening: { passages: number; accuracy: number; belowTarget: number };
  reading: { articles: number };
  writing: { essays: number; words: number };
  translation: { materials: number };
  vocab: { newWords: number; dueReview: number };
  streak: number;
  highlights: string[];
  improvements: string[];
  suggestions: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function generateDailyReport(): Promise<DailyReport> {
  const key = todayKey();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const startTs = dayStart.getTime();
  const endTs = startTs + DAY_MS;

  const [typingToday, listeningToday, statsToday, vocab, streak] = await Promise.all([
    db.typingRecords.where("timestamp").between(startTs, endTs, true, true).toArray(),
    db.listeningRecords.where("timestamp").between(startTs, endTs, true, true).toArray(),
    db.dailyStats.get(key),
    db.vocabulary.toArray(),
    computeStreak(),
  ]);

  const typingCount = typingToday.length;
  const typingAccuracy = typingCount
    ? Math.round(
        (typingToday.reduce((s, r) => s + r.accuracy, 0) / typingCount)
      )
    : 0;
  const wrongWords = [...new Set(typingToday.filter((r) => !r.correct).map((r) => r.word))];

  const listeningPassages = listeningToday.length;
  const listeningAccuracy = listeningPassages
    ? Math.round(
        (listeningToday.reduce((s, r) => s + r.accuracy, 0) / listeningPassages)
      )
    : 0;
  const belowTarget = listeningToday.filter((r) => r.accuracy < 95).length;

  const totalMinutes = statsToday
    ? Math.round(
        statsToday.typingMinutes +
          statsToday.readingMinutes +
          statsToday.writingMinutes +
          statsToday.translationMinutes
      )
    : 0;

  const vocabAddedToday = vocab.filter((v) => v.addedAt >= startTs && v.addedAt < endTs).length;
  const now = Date.now();
  const dueReview = vocab.filter(
    (v) => !v.mastered && (v.nextReviewAt ?? 0) > 0 && (v.nextReviewAt ?? 0) <= now
  ).length;

  const readingArticles = statsToday?.readingCount ?? 0;
  const writingEssays = statsToday?.writingCount ?? 0;
  const translationMaterials = statsToday?.translationCount ?? 0;

  const hasActivity =
    typingCount > 0 ||
    listeningPassages > 0 ||
    readingArticles > 0 ||
    writingEssays > 0 ||
    translationMaterials > 0;

  const highlights: string[] = [];
  const improvements: string[] = [];
  const suggestions: string[] = [];

  // 亮点
  if (streak.current >= 2) {
    highlights.push(`已连续学习 ${streak.current} 天，坚持是提分最好的方法。`);
  }
  if (typingCount > 0) {
    if (typingAccuracy >= 90) {
      highlights.push(`单词打字正确率 ${typingAccuracy}%，拼写掌握得很扎实。`);
    } else if (typingAccuracy >= 70) {
      highlights.push(`完成 ${typingCount} 个单词练习，坚持巩固中。`);
    }
  }
  if (listeningPassages > 0) {
    if (listeningAccuracy >= 95) {
      highlights.push(`听力正确率 ${listeningAccuracy}%，达到目标水平，太棒了！`);
    } else if (listeningAccuracy >= 80) {
      highlights.push(`听力正确率 ${listeningAccuracy}%，离 95% 目标越来越近。`);
    }
  }
  const activeModules = [
    typingCount > 0,
    listeningPassages > 0,
    readingArticles > 0,
    writingEssays > 0,
    translationMaterials > 0,
  ].filter(Boolean).length;
  if (activeModules >= 3) {
    highlights.push(`今日覆盖 ${activeModules} 个模块，听读写译全面发展。`);
  }

  // 待改进
  if (wrongWords.length > 0) {
    improvements.push(
      `有 ${wrongWords.length} 个词拼写出错：${wrongWords.slice(0, 5).join("、")}${
        wrongWords.length > 5 ? " 等" : ""
      }，建议加入默写复习。`
    );
  }
  if (listeningPassages > 0 && listeningAccuracy < 95) {
    improvements.push(
      `听力正确率 ${listeningAccuracy}%，有 ${belowTarget} 篇未达 95%，建议逐句精听这些篇目。`
    );
  }
  if (typingCount > 0 && typingAccuracy < 80) {
    improvements.push(`单词正确率 ${typingAccuracy}% 偏低，建议放慢速度，先拼对再拼快。`);
  }

  // 建议
  if (dueReview > 0) {
    suggestions.push(`今天有 ${dueReview} 个词到期待复习，先去「单词打字→仅复习」巩固一遍。`);
  }
  if (vocabAddedToday > 0) {
    suggestions.push(`今日新增 ${vocabAddedToday} 个生词，记得明天回看复习。`);
  }
  if (listeningPassages === 0) {
    suggestions.push("今日还没有听力练习，听力是薄弱项，建议每天至少练 3 篇短文。");
  } else if (belowTarget > 0) {
    suggestions.push("对未达标的听力篇目做「影子跟读」：边听边模仿英音朗读，训练发音和反应。");
  }
  if (writingEssays === 0) {
    suggestions.push("写作还未练习，建议每两天完成 1 篇限时作文，对照范文修改。");
  }
  if (suggestions.length === 0) {
    suggestions.push("今日各模块完成得很好，继续保持，注意劳逸结合。");
  }

  return {
    date: key,
    hasActivity,
    totalMinutes,
    typing: { count: typingCount, accuracy: typingAccuracy, wrongWords },
    listening: { passages: listeningPassages, accuracy: listeningAccuracy, belowTarget },
    reading: { articles: readingArticles },
    writing: { essays: writingEssays, words: 0 },
    translation: { materials: translationMaterials },
    vocab: { newWords: vocabAddedToday, dueReview },
    streak: streak.current,
    highlights,
    improvements,
    suggestions,
  };
}
