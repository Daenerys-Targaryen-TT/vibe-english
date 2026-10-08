"use client";

import * as React from "react";
import { Volume2, Square, Pause, Play, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VocabularyCard } from "@/components/VocabularyCard";
import { lookupWord, type LookupResult } from "@/lib/dictionary";
import { speak, stopSpeech, isTtsSupported } from "@/lib/tts";
import { db, addMinutes } from "@/lib/db";
import type { Article } from "@/lib/types";

interface SelectionState {
  word: string;
  x: number;
  y: number;
  lookup: LookupResult | null;
  loading: boolean;
}

function highlightText(text: string, vocab: Set<string>) {
  const parts = text.split(/(\s+)/);
  return parts.map((token, i) => {
    const cleaned = token.toLowerCase().replace(/[^a-z'-]/g, "");
    if (cleaned && vocab.has(cleaned)) {
      const match = token.match(/^([^a-zA-Z]*)([a-zA-Z'-]+)([^a-zA-Z]*)$/);
      if (match) {
        return (
          <React.Fragment key={i}>
            {match[1]}
            <mark data-word={cleaned}>{match[2]}</mark>
            {match[3]}
          </React.Fragment>
        );
      }
    }
    return <React.Fragment key={i}>{token}</React.Fragment>;
  });
}

export function ArticleReader({ article }: { article: Article }) {
  const [vocab, setVocab] = React.useState<Set<string>>(new Set());
  const [selection, setSelection] = React.useState<SelectionState | null>(null);
  const [speakingPara, setSpeakingPara] = React.useState<string | null>(null);
  const [paused, setPaused] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const lastReadRef = React.useRef<string>("");
  const startAtRef = React.useRef<number>(0);

  React.useEffect(() => {
    startAtRef.current = Date.now();
    return () => {
      const elapsedMin = Math.max(0.1, (Date.now() - startAtRef.current) / 60000);
      addMinutes("reading", elapsedMin, { readingCount: 1 });
    };
  }, [article.id]);

  React.useEffect(() => {
    db.vocabulary.toArray().then((words) => {
      const set = new Set(words.map((w) => w.word.toLowerCase()));
      article.glossary?.forEach((g) => set.add(g.word.toLowerCase()));
      setVocab(set);
    });
  }, [article]);

  React.useEffect(() => {
    db.readingProgress.get({ articleId: article.id }).then((p) => {
      if (p) {
        lastReadRef.current = p.lastParagraphId;
        const el = document.getElementById(`para-${p.lastParagraphId}`);
        if (el) el.scrollIntoView({ block: "start" });
      }
    });
  }, [article.id]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-para-id");
            if (id) lastReadRef.current = id;
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    containerRef.current?.querySelectorAll("[data-para-id]").forEach((el) => {
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, [article, vocab]);

  React.useEffect(() => {
    return () => {
      if (lastReadRef.current) {
        db.readingProgress.put({
          articleId: article.id,
          lastParagraphId: lastReadRef.current,
          updatedAt: Date.now(),
        });
      }
    };
  }, [article.id]);

  const handleSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    const wordMatch = text.match(/^[a-zA-Z'-]+$/);
    const word = wordMatch ? text : text.split(/\s+/)[0];
    if (!word) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.bottom + window.scrollY + 8;

    setSelection({ word, x, y, lookup: null, loading: true });
    lookupWord(word).then((res) => {
      setSelection((prev) =>
        prev && prev.word === word
          ? { ...prev, lookup: res, loading: false }
          : prev
      );
    });
  };

  const openWord = (word: string, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.bottom + window.scrollY + 8;
    setSelection({ word, x, y, lookup: null, loading: true });
    lookupWord(word).then((res) => {
      setSelection((prev) =>
        prev && prev.word === word
          ? { ...prev, lookup: res, loading: false }
          : prev
      );
    });
  };

  const toggleSpeak = (paraId: string, text: string) => {
    if (speakingPara === paraId && !paused) {
      window.speechSynthesis.pause();
      setPaused(true);
      return;
    }
    if (speakingPara === paraId && paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      return;
    }
    stopSpeech();
    setSpeakingPara(paraId);
    setPaused(false);
    speak(text, {
      onEnd: () => {
        setSpeakingPara(null);
        setPaused(false);
      },
    });
  };

  const stopAll = () => {
    stopSpeech();
    setSpeakingPara(null);
    setPaused(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseUp={handleSelection}
      onTouchEnd={handleSelection}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === "MARK") {
          const word = target.getAttribute("data-word");
          if (word) openWord(word, target);
        }
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{article.difficulty}</Badge>
          <span className="text-sm text-muted-foreground">{article.source}</span>
          <span className="text-sm text-muted-foreground">{article.date}</span>
        </div>
        {speakingPara && (
          <Button variant="outline" size="sm" onClick={stopAll}>
            <Square className="h-4 w-4" /> 停止朗读
          </Button>
        )}
      </div>

      <div className="space-y-5 text-lg leading-relaxed">
        {article.paragraphs.map((para) => (
          <div
            key={para.id}
            id={`para-${para.id}`}
            data-para-id={para.id}
            className="group relative"
          >
            <p className="pr-10">{highlightText(para.text, vocab)}</p>
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-1 top-0 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="朗读本段"
              onClick={() => toggleSpeak(para.id, para.text)}
            >
              {speakingPara === para.id && !paused ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            {speakingPara === para.id && paused && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-1 top-8 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="继续朗读"
                onClick={() => toggleSpeak(para.id, para.text)}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {article.glossary && article.glossary.length > 0 && (
        <div className="mt-8 rounded-lg border p-4">
          <h3 className="mb-2 font-semibold">生词注释</h3>
          <div className="grid gap-1 sm:grid-cols-2">
            {article.glossary.map((g) => (
              <div key={g.word} className="text-sm">
                <span className="font-medium">{g.word}</span>
                <span className="ml-2 text-muted-foreground">{g.translation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selection && (
        <div
          className="fixed z-50"
          style={{ left: selection.x, top: selection.y, transform: "translateX(-50%)" }}
        >
          {selection.loading ? (
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow">
              查询中…
            </div>
          ) : selection.lookup ? (
            <VocabularyCard
              word={selection.word}
              lookup={selection.lookup}
            />
          ) : (
            <div className="w-64 rounded-lg border bg-card p-4 text-sm shadow">
              <p className="font-medium">{selection.word}</p>
              <p className="mt-1 text-xs text-muted-foreground">未找到释义</p>
              <Button
                size="sm"
                className="mt-2 w-full"
                onClick={async () => {
                  const existing = await db.vocabulary.get({ word: selection.word });
                  if (!existing) {
                    await db.vocabulary.add({
                      word: selection.word,
                      translation: "",
                      phonetic: "",
                      addedAt: Date.now(),
                      mastered: false,
                      reviewCount: 0,
                      lastReviewAt: null,
                      nextReviewAt: null,
                    });
                  }
                  setSelection(null);
                }}
              >
                <BookmarkPlus className="h-4 w-4" /> 仍加入生词本
              </Button>
            </div>
          )}
        </div>
      )}

      {selection && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setSelection(null)}
        />
      )}
    </div>
  );
}
