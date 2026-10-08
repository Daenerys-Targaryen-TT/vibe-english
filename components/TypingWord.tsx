"use client";

import * as React from "react";
import { Volume2, SkipForward, RotateCcw, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { speak, stopSpeech, isTtsSupported } from "@/lib/tts";
import { db, addMinutes, type TypingRecord } from "@/lib/db";
import { updateWordSrs } from "@/lib/srs";
import type { WordEntry, TypingMode, JudgeMode } from "@/lib/types";

interface SessionResult {
  word: WordEntry;
  correct: boolean;
  accuracy: number;
  duration: number;
  reaction: number;
}

const MODE_LABEL: Record<TypingMode, string> = {
  en2en: "看英文打英文",
  zh2en: "看中文打英文",
  listen2en: "听发音打英文",
};

const JUDGE_LABEL: Record<JudgeMode, string> = {
  strict: "严格模式",
  lenient: "宽松模式",
  sentence: "整句模式",
};

function maskWord(word: string): string {
  return "•".repeat(Math.max(1, Math.min(word.length, 8)));
}

export function TypingWord({
  words,
  onExit,
}: {
  words: WordEntry[];
  onExit: () => void;
}) {
  const [mode, setMode] = React.useState<TypingMode>("en2en");
  const [judge, setJudge] = React.useState<JudgeMode>("strict");
  const [index, setIndex] = React.useState(0);
  const [input, setInput] = React.useState("");
  const [errors, setErrors] = React.useState(0);
  const [results, setResults] = React.useState<SessionResult[]>([]);
  const [phase, setPhase] = React.useState<"practice" | "result">("practice");
  const [revealed, setRevealed] = React.useState(false);
  const [sessionWords, setSessionWords] = React.useState<WordEntry[]>(() => words);

  const startedAtRef = React.useRef(0);
  const firstKeyRef = React.useRef(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const spaceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = sessionWords[index % sessionWords.length];
  const ttsSupported = isTtsSupported();

  const currentTarget = React.useMemo(() => current?.word ?? "", [current]);
  const translation = React.useMemo(
    () => current?.translations[0]?.translation ?? "",
    [current]
  );
  const phonetic = current?.phonetic?.us ?? current?.phonetic?.uk ?? "";
  const example = current?.phrases?.[0];

  const startWord = React.useCallback(() => {
    setInput("");
    setErrors(0);
    setRevealed(false);
    startedAtRef.current = Date.now();
    firstKeyRef.current = 0;
    if (mode === "en2en" || mode === "listen2en") {
      if (current) speak(current.word);
    }
  }, [mode, current]);

  React.useEffect(() => {
    startWord();
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, mode, judge]);

  const finishWord = React.useCallback(
    (correct: boolean, accuracy: number) => {
      const word = current;
      const duration = Date.now() - startedAtRef.current;
      const reaction = firstKeyRef.current
        ? firstKeyRef.current - startedAtRef.current
        : duration;

      const record: TypingRecord = {
        word: word.word,
        mode,
        correct,
        accuracy: Math.round(accuracy * 100),
        timestamp: Date.now(),
        duration,
      };
      db.typingRecords.add(record);
      addMinutes("typing", Math.max(0.05, duration / 60000), {
        typingCount: 1,
        typingCorrect: correct ? 1 : 0,
      });
      updateWordSrs(word, correct, accuracy);

      const next = [...results, { word, correct, accuracy, duration, reaction }];
      setResults(next);

      if (index + 1 >= sessionWords.length) {
        setPhase("result");
        stopSpeech();
      } else {
        setIndex((i) => i + 1);
      }
    },
    [current, mode, results, index, sessionWords.length]
  );

  const submitForJudge = React.useCallback(
    (typed: string) => {
      if (judge === "strict") {
        const accuracy = errors === 0 ? 1 : currentTarget.length / (currentTarget.length + errors);
        finishWord(errors === 0, accuracy);
      } else if (judge === "lenient") {
        let correct = 0;
        const n = Math.max(currentTarget.length, typed.length);
        for (let i = 0; i < n; i++) {
          if (typed[i] === currentTarget[i]) correct++;
        }
        const accuracy = currentTarget.length ? correct / currentTarget.length : 0;
        finishWord(correct === currentTarget.length, accuracy);
      } else {
        // sentence mode: compare on Enter
        let correct = 0;
        const n = Math.max(currentTarget.length, typed.length);
        for (let i = 0; i < n; i++) {
          if (typed[i] === currentTarget[i]) correct++;
        }
        const accuracy = currentTarget.length ? correct / currentTarget.length : 0;
        finishWord(correct === currentTarget.length, accuracy);
      }
    },
    [judge, errors, currentTarget, finishWord]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (phase === "result") return;

    if (e.key === "Enter") {
      e.preventDefault();
      if (judge === "sentence") {
        if (revealed) {
          startWord();
        } else {
          submitForJudge(input);
        }
      } else {
        if (input.length >= currentTarget.length || revealed) {
          if (revealed) startWord();
          else submitForJudge(input);
        }
      }
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const modes: TypingMode[] = ["en2en", "zh2en", "listen2en"];
      setMode((m) => modes[(modes.indexOf(m) + 1) % modes.length]);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      onExit();
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      if (!spaceTimerRef.current) {
        spaceTimerRef.current = setTimeout(() => {
          if (current) speak(current.word);
          spaceTimerRef.current = null;
        }, 400);
      }
      return;
    }

    if (e.key.length === 1) {
      e.preventDefault();
      if (firstKeyRef.current === 0) firstKeyRef.current = Date.now();

      if (judge === "strict") {
        const nextChar = currentTarget[input.length];
        if (e.key === nextChar) {
          const next = input + e.key;
          setInput(next);
          if (next.length >= currentTarget.length) {
            finishWord(true, 1);
          }
        } else {
          setErrors((n) => n + 1);
        }
      } else {
        if (input.length < currentTarget.length) {
          const next = input + e.key;
          setInput(next);
          if (next.length >= currentTarget.length && judge === "lenient") {
            let correct = 0;
            for (let i = 0; i < currentTarget.length; i++) {
              if (next[i] === currentTarget[i]) correct++;
            }
            finishWord(correct === currentTarget.length, correct / currentTarget.length);
          }
        }
      }
    }
  };

  const giveUp = () => {
    if (revealed) return;
    setRevealed(true);
    setInput("");
    if (firstKeyRef.current === 0) firstKeyRef.current = Date.now();
  };

  const revealAndNext = () => {
    if (revealed) {
      const record: TypingRecord = {
        word: current.word,
        mode,
        correct: false,
        accuracy: 0,
        timestamp: Date.now(),
        duration: Date.now() - startedAtRef.current,
      };
      db.typingRecords.add(record);
      updateWordSrs(current, false, 0);
      const next = [
        ...results,
        { word: current, correct: false, accuracy: 0, duration: 0, reaction: 0 },
      ];
      setResults(next);
      if (index + 1 >= sessionWords.length) setPhase("result");
      else setIndex((i) => i + 1);
    }
  };

  const retryWrong = () => {
    const wrong = results.filter((r) => !r.correct);
    if (wrong.length === 0) return;
    setSessionWords(wrong.map((r) => r.word));
    setResults([]);
    setIndex(0);
    setInput("");
    setErrors(0);
    setRevealed(false);
    setPhase("practice");
    startedAtRef.current = Date.now();
    firstKeyRef.current = 0;
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const accuracyTotal = results.length
    ? Math.round(
        (results.reduce((s, r) => s + r.accuracy, 0) / results.length) * 100
      )
    : 0;
  const avgReaction = results.length
    ? Math.round(results.reduce((s, r) => s + r.reaction, 0) / results.length)
    : 0;
  const wrongWords = results.filter((r) => !r.correct);

  if (phase === "result") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h2 className="text-xl font-bold">本轮完成！</h2>
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{results.length}</div>
              <div className="text-xs text-muted-foreground">练习单词数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{accuracyTotal}%</div>
              <div className="text-xs text-muted-foreground">正确率</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{avgReaction}ms</div>
              <div className="text-xs text-muted-foreground">平均反应时间</div>
            </CardContent>
          </Card>
        </div>

        {wrongWords.length > 0 && (
          <div>
            <h3 className="mb-2 font-semibold">错误单词</h3>
            <div className="space-y-2">
              {wrongWords.map((r) => {
                const phonetic = r.word.phonetic?.us ?? r.word.phonetic?.uk ?? "";
                const ex = r.word.phrases?.[0];
                return (
                  <div
                    key={r.word.word}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div>
                      <span className="font-medium">{r.word.word}</span>
                      {phonetic && (
                        <span className="ml-2 text-xs text-muted-foreground">{phonetic}</span>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {r.word.translations[0]?.translation}
                      </div>
                      {ex && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          <span className="italic">{ex.phrase}</span>
                          {ex.translation && <span> — {ex.translation}</span>}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => speak(r.word.word)}
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {wrongWords.length > 0 && (
            <Button onClick={retryWrong}>
              <RotateCcw className="h-4 w-4" /> 重练错词（{wrongWords.length}）
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setResults([]);
              setIndex(0);
              setPhase("practice");
            }}
          >
            <RotateCcw className="h-4 w-4" /> 再来一轮
          </Button>
          <Button variant="outline" onClick={onExit}>
            退出练习
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge variant="secondary">{MODE_LABEL[mode]}</Badge>
        <Badge variant="secondary">{JUDGE_LABEL[judge]}</Badge>
        <Badge variant="outline">
          {index + 1} / {sessionWords.length}
        </Badge>
        <Badge variant="outline">错误 {errors}</Badge>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <span className="hidden sm:inline">Enter 提交 · Tab 切换模式 · Esc 退出 · </span>
        空格长按 重听发音
      </div>

      {mode === "listen2en" ? (
        <div className="flex flex-col items-center gap-4 py-10">
          <Button
            variant="outline"
            size="lg"
            className="h-16 w-16 rounded-full"
            onClick={() => current && speak(current.word)}
            aria-label="播放发音"
          >
            <Volume2 className="h-7 w-7" />
          </Button>
          {revealed && (
            <div className="text-center">
              <div className="text-3xl font-semibold">{currentTarget}</div>
              <div className="mt-2 text-muted-foreground">{translation}</div>
            </div>
          )}
          {!ttsSupported && (
            <p className="text-sm text-destructive">
              当前浏览器不支持语音合成，请改用其他模式。
            </p>
          )}
        </div>
      ) : (
        <div className="text-center">
          {mode === "en2en" ? (
            <>
              <div className="text-4xl font-bold sm:text-5xl">{currentTarget}</div>
              {phonetic && (
                <div className="mt-2 text-lg text-muted-foreground">{phonetic}</div>
              )}
              <div className="mt-1 text-muted-foreground">{translation}</div>
              {example && (
                <div className="mt-2 text-sm italic text-muted-foreground">
                  {example.phrase} — {example.translation}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-2xl font-semibold sm:text-3xl">{translation}</div>
              <div className="mt-2 text-lg tracking-widest text-muted-foreground">
                {revealed ? currentTarget : maskWord(currentTarget)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {currentTarget.length} 个字母
              </div>
            </>
          )}
        </div>
      )}

      {judge === "sentence" && !revealed && (
        <div className="flex gap-1 tracking-wide">
          {currentTarget.split("").map((ch, i) => (
            <span
              key={i}
              className={
                i < input.length
                  ? input[i] === ch
                    ? "correct-char"
                    : "incorrect-char"
                  : "text-muted-foreground"
              }
            >
              {input[i] ?? "·"}
            </span>
          ))}
        </div>
      )}

      {mode !== "listen2en" && (
        <div className="flex w-full max-w-sm gap-2">
          <input
            ref={inputRef}
            value={input}
            onKeyDown={handleKeyDown}
            onChange={() => {}}
            className="h-12 w-full rounded-lg border border-input bg-transparent px-4 text-center text-2xl tracking-widest focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder={mode === "zh2en" ? "输入英文" : "开始打字…"}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12"
            onClick={() => current && speak(current.word)}
            aria-label="朗读"
          >
            <Volume2 className="h-5 w-5" />
          </Button>
        </div>
      )}

      {revealed && (phonetic || example) && (
        <div className="w-full max-w-md rounded-lg border border-dashed bg-accent/40 p-4 text-center">
          {phonetic && (
            <div className="text-sm text-muted-foreground">{phonetic}</div>
          )}
          {example && (
            <div className="mt-1 text-sm">
              <span className="italic">{example.phrase}</span>
              {example.translation && (
                <span className="text-muted-foreground"> — {example.translation}</span>
              )}
            </div>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            已自动记入生词本，稍后会安排复习
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!revealed && (
          <Button variant="outline" onClick={giveUp}>
            <Flag className="h-4 w-4" /> 不会，看答案
          </Button>
        )}
        {revealed && (
          <Button onClick={revealAndNext}>
            <SkipForward className="h-4 w-4" /> 下一个
          </Button>
        )}
      </div>
    </div>
  );
}
