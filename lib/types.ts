export type TypingMode = "en2en" | "zh2en" | "listen2en";

export type JudgeMode = "strict" | "lenient" | "sentence";

export interface WordTranslation {
  translation: string;
  type?: string;
}

export interface WordPhrase {
  phrase: string;
  translation: string;
}

export interface WordPhonetic {
  us?: string;
  uk?: string;
}

export interface WordEntry {
  word: string;
  translations: WordTranslation[];
  phrases?: WordPhrase[];
  phonetic?: WordPhonetic;
}

export interface ArticleParagraph {
  id: string;
  text: string;
}

export interface ArticleGlossary {
  word: string;
  translation: string;
}

export interface Article {
  id: string;
  title: string;
  source: string;
  date: string;
  difficulty: string;
  paragraphs: ArticleParagraph[];
  glossary?: ArticleGlossary[];
}

export interface WritingPrompt {
  id: string;
  type: "argumentative" | "commentary";
  title?: string;
  prompt: string;
  wordLimit: number;
  timeLimit: number;
  category: string;
  sample?: string;
}

export interface TranslationSentence {
  id: string;
  chinese: string;
  reference: string;
}

export interface TranslationMaterial {
  id: string;
  title: string;
  author: string;
  source: string;
  difficulty: string;
  sentences: TranslationSentence[];
}
