export interface UpgradeSuggestion {
  from: string;
  to: string[];
  count: number;
}

export interface WritingAnalysis {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  paragraphCount: number;
  repeatedWords: { word: string; count: number }[];
  upgrades: UpgradeSuggestion[];
  linkingCount: number;
  advice: string[];
}

const UPGRADE_MAP: Record<string, string[]> = {
  good: ["beneficial", "advantageous", "superb"],
  bad: ["detrimental", "adverse", "unfavourable"],
  big: ["substantial", "considerable", "enormous"],
  large: ["substantial", "extensive", "vast"],
  small: ["minor", "negligible", "modest"],
  important: ["crucial", "vital", "significant"],
  very: ["extremely", "exceedingly", "remarkably"],
  many: ["numerous", "a multitude of"],
  much: ["considerable", "substantial"],
  thing: ["aspect", "factor", "matter"],
  get: ["obtain", "acquire", "attain"],
  show: ["demonstrate", "illustrate", "indicate"],
  think: ["believe", "maintain", "contend"],
  use: ["utilise", "employ"],
  help: ["facilitate", "assist", "aid"],
  make: ["generate", "produce", "foster"],
  need: ["require", "necessitate"],
  want: ["desire", "aspire to"],
  give: ["provide", "offer", "bestow"],
  problem: ["issue", "challenge", "dilemma"],
  solve: ["resolve", "address", "tackle"],
  people: ["individuals", "citizens"],
  buy: ["purchase"],
  hard: ["arduous", "demanding", "challenging"],
  easy: ["effortless", "straightforward"],
  happy: ["delighted", "contented", "joyful"],
  sad: ["melancholy", "despondent", "sorrowful"],
};

const LINKING_WORDS = [
  "however",
  "therefore",
  "moreover",
  "furthermore",
  "consequently",
  "nevertheless",
  "in addition",
  "for example",
  "for instance",
  "on the other hand",
  "in contrast",
  "as a result",
  "in conclusion",
  "on the contrary",
  "meanwhile",
];

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for",
  "with", "is", "are", "was", "were", "be", "been", "being", "it", "this",
  "that", "these", "those", "as", "by", "from", "they", "we", "you", "he",
  "she", "i", "his", "her", "their", "our", "my", "your", "its", "not", "no",
  "so", "if", "than", "then", "also", "will", "would", "can", "could", "should",
  "do", "does", "did", "have", "has", "had", "there", "what", "which", "who",
  "when", "where", "why", "how", "some", "any", "all", "more", "most", "into",
  "about", "over", "up", "out", "one", "two", "such", "other", "only", "them",
  "us", "him", "her", "me", "our", "their", "its", "may", "might", "must",
]);

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

export function analyzeEssay(text: string, wordLimit?: number): WritingAnalysis {
  const wordCount = countWords(text);
  const sentences = splitSentences(text);
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount
    ? Math.round((wordCount / sentenceCount) * 10) / 10
    : 0;

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const paragraphCount = paragraphs.length;

  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  for (const t of tokens) {
    if (t.length < 4) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  const repeatedWords = [...freq.entries()]
    .filter(([, c]) => c >= 4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));

  const upgrades: UpgradeSuggestion[] = [];
  const upgradeCount = new Map<string, number>();
  for (const t of tokens) {
    if (UPGRADE_MAP[t]) {
      upgradeCount.set(t, (upgradeCount.get(t) ?? 0) + 1);
    }
  }
  for (const [from, count] of [...upgradeCount.entries()].sort((a, b) => b[1] - a[1])) {
    upgrades.push({ from, to: UPGRADE_MAP[from], count });
  }

  const lower = text.toLowerCase();
  const linkingCount = LINKING_WORDS.reduce(
    (s, w) => s + (lower.split(w).length - 1),
    0
  );

  const advice: string[] = [];
  if (wordLimit) {
    if (wordCount < wordLimit * 0.7) {
      advice.push(
        `字数 ${wordCount}，距离要求 ${wordLimit} 词还差 ${wordLimit - wordCount} 词，论证可能不够充分。`
      );
    } else if (wordCount > wordLimit * 1.2) {
      advice.push(
        `字数 ${wordCount}，超出要求 ${wordLimit} 词 ${wordCount - wordLimit} 词，建议精简。`
      );
    } else {
      advice.push(`字数 ${wordCount}，符合要求（${wordLimit} 词左右）。`);
    }
  }
  if (paragraphCount < 3) {
    advice.push(
      `当前 ${paragraphCount} 段，建议至少 3 段（引言 / 主体 / 结论），结构更清晰。`
    );
  }
  if (sentenceCount > 0 && avgSentenceLength > 30) {
    advice.push(
      `平均句长 ${avgSentenceLength} 词，偏长，可适当拆分为短句，避免长难句影响可读性。`
    );
  } else if (sentenceCount > 0 && avgSentenceLength < 10) {
    advice.push(
      `平均句长 ${avgSentenceLength} 词，偏短，可用从句、连接词增强句式多样性。`
    );
  }
  if (linkingCount < 3 && sentenceCount > 5) {
    advice.push(
      "连接词使用较少，建议多用 however / therefore / moreover / for example 等增强逻辑衔接。"
    );
  }
  if (repeatedWords.length > 0) {
    advice.push(
      `高频重复词：${repeatedWords
        .slice(0, 3)
        .map((w) => `"${w.word}"（${w.count}次）`)
        .join("、")}，建议用同义词替换。`
    );
  }
  if (upgrades.length > 0) {
    advice.push(
      `可升级的简单表达：${upgrades
        .slice(0, 3)
        .map((u) => `"${u.from}" → ${u.to[0]}`)
        .join("、")}。`
    );
  }
  if (advice.length === 0) {
    advice.push("整体结构、字数和表达良好，继续保持！");
  }

  return {
    wordCount,
    sentenceCount,
    avgSentenceLength,
    paragraphCount,
    repeatedWords,
    upgrades,
    linkingCount,
    advice,
  };
}
