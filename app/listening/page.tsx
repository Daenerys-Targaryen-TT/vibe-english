"use client";

import * as React from "react";
import { Volume2, Check, ArrowRight, RotateCcw, Gauge } from "lucide-react";
import { AppShell } from "@/components/Layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assetPath } from "@/lib/paths";
import { useMounted } from "@/lib/hooks";
import { speak, stopSpeech, setSpeechRate, isTtsSupported } from "@/lib/tts";
import { db } from "@/lib/db";

interface ListeningSentence {
  id: string;
  text: string;
  difficulty: string;
  translation: string;
}

const DIFFICULTIES = ["CET-4", "CET-6", "考研"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

export default function ListeningPage() {
  const mounted = useMounted();
  const [all, setAll] = React.useState<ListeningSentence[]>([]);
  const [difficulty, setDifficulty] = React.useState("all");
  const [rate, setRate] = React.useState(0.85);
  const [session, setSession] = React.useState<ListeningSentence[]>([]);
  const [index, setIndex] = React.useState(0);
  const [input, setInput] = React.useState("");
  const [phase, setPhase] = React.useState<"setup" | "practice" | "result">("setup");
  const [checked, setChecked] = React.useState(false);
  const [results, setResults] = React.useState<{ sentence: ListeningSentence; accuracy: number }[]>([]);
  const [historyAvg, setHistoryAvg] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch(assetPath("/data/listening.json"))
      .then((r) => r.json())
      .then((d: ListeningSentence[]) => setAll(d));
    db.listeningRecords.toArray().then((recs) => {
      if (recs.length > 0) {
        const avg = recs.reduce((s, r) => s + r.accuracy, 0) / recs.length;
        setHistoryAvg(Math.round(avg));
      }
    });
  }, []);

  React.useEffect(() => {
    setSpeechRate(rate);
  }, [rate]);

  const start = () => {
    const pool =
      difficulty === "all" ? all : all.filter((s) => s.difficulty === difficulty);
    setSession(shuffle(pool).slice(0, 10));
    setResults([]);
    setIndex(0);
    setInput("");
    setChecked(false);
    setPhase("practice");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const current = session[index];

  React.useEffect(() => {
    if (phase === "practice" && current && !checked) {
      speak(current.text, { rate });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase]);

  const checkAnswer = () => {
    if (!current || checked) return;
    const ref = normalizeWords(current.text);
    const user = normalizeWords(input);
    const total = ref.length;
    let correct = 0;
    for (let i = 0; i < total; i++) {
      if (user[i] === ref[i]) correct++;
    }
    const accuracy = Math.round((correct / total) * 100);
    const record = {
      sentenceId: current.id,
      correct: accuracy >= 95,
      accuracy,
      timestamp: Date.now(),
      duration: 0,
    };
    db.listeningRecords.add(record);
    setResults((r) => [...r, { sentence: current, accuracy }]);
    setChecked(true);
  };

  const next = () => {
    if (index + 1 >= session.length) {
      setPhase("result");
      stopSpeech();
    } else {
      setIndex((i) => i + 1);
      setInput("");
      setChecked(false);
    }
  };

  const renderDiff = () => {
    if (!current) return null;
    const ref = normalizeWords(current.text);
    const user = normalizeWords(input);
    const max = Math.max(ref.length, user.length);
    return (
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: max }).map((_, i) => {
          const r = ref[i];
          const u = user[i];
          if (r === undefined) {
            return (
              <span key={i} className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-500">
                {u}
              </span>
            );
          }
          const cls = u === r ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-500";
          return (
            <span key={i} className={"rounded px-1.5 py-0.5 " + cls}>
              {r}
            </span>
          );
        })}
      </div>
    );
  };

  if (!mounted) {
    return (
      <AppShell>
        <div className="py-20 text-center text-muted-foreground">加载中…</div>
      </AppShell>
    );
  }

  if (phase === "result") {
    const avg = results.length
      ? Math.round(results.reduce((s, r) => s + r.accuracy, 0) / results.length)
      : 0;
    const perfect = results.filter((r) => r.accuracy >= 95).length;
    return (
      <AppShell>
        <div className="mx-auto max-w-xl space-y-4">
          <h1 className="text-xl font-bold">本轮听力完成</h1>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{avg}%</div>
                <div className="text-xs text-muted-foreground">平均正确率</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{perfect}/{results.length}</div>
                <div className="text-xs text-muted-foreground">达95%的句子</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{historyAvg ?? "-"}%</div>
                <div className="text-xs text-muted-foreground">历史平均</div>
              </CardContent>
            </Card>
          </div>
          <p className="text-sm text-muted-foreground">
            目标是每句 95-100% 正确率。若未达标，建议重听并逐词核对，重点关注连读、弱读和数字。
          </p>
          <div className="space-y-2">
            {results
              .filter((r) => r.accuracy < 95)
              .map((r) => (
                <div key={r.sentence.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.sentence.text}</span>
                    <Badge variant={r.accuracy >= 95 ? "success" : "destructive"}>{r.accuracy}%</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{r.sentence.translation}</p>
                </div>
              ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={start}>
              <RotateCcw className="h-4 w-4" /> 再来一轮
            </Button>
            <Button variant="outline" onClick={() => setPhase("setup")}>
              返回设置
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (phase === "practice" && current) {
    return (
      <AppShell>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-6">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="secondary">{current.difficulty}</Badge>
            <Badge variant="outline">{index + 1} / {session.length}</Badge>
          </div>

          <Button
            variant="outline"
            size="lg"
            className="h-16 w-16 rounded-full"
            onClick={() => speak(current.text, { rate })}
            aria-label="播放句子"
          >
            <Volume2 className="h-7 w-7" />
          </Button>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gauge className="h-4 w-4" />
            语速
            <div className="flex gap-1">
              {[0.6, 0.75, 0.85, 1.0].map((r) => (
                <button
                  key={r}
                  onClick={() => setRate(r)}
                  className={
                    "rounded px-2 py-1 text-xs " +
                    (rate === r ? "bg-primary text-primary-foreground" : "bg-muted")
                  }
                >
                  {r === 0.6 ? "慢" : r === 1.0 ? "快" : r === 0.75 ? "中" : "常"}
                </button>
              ))}
            </div>
          </div>

          {checked ? (
            <div className="w-full space-y-4">
              <div className="rounded-lg border p-4">
                <div className="mb-2 text-sm font-medium">对照结果（绿色=正确，红色=参考）</div>
                {renderDiff()}
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="font-medium">原句：{current.text}</div>
                <div className="mt-1 text-muted-foreground">{current.translation}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => speak(current.text, { rate })}>
                  <Volume2 className="h-4 w-4" /> 重听
                </Button>
                <Button onClick={next}>
                  下一句 <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex w-full max-w-md gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    checkAnswer();
                  }
                }}
                className="h-12 w-full rounded-lg border border-input bg-transparent px-4 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="听写你听到的句子…"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          )}

          {!checked && (
            <Button onClick={checkAnswer} disabled={!input.trim()}>
              <Check className="h-4 w-4" /> 提交
            </Button>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <h1 className="mb-1 text-2xl font-bold">听力听写</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          英音朗读，逐词听写。目标正确率 95-100%，训练对连读、弱读和语速的敏感度。
        </p>
        {!isTtsSupported() && (
          <p className="mb-4 text-sm text-destructive">
            当前浏览器不支持语音合成，无法使用听力功能。
          </p>
        )}
        <Card>
          <CardHeader>
            <CardTitle>选择难度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={difficulty} onValueChange={setDifficulty}>
              <TabsList>
                <TabsTrigger value="all">全部</TabsTrigger>
                {DIFFICULTIES.map((d) => (
                  <TabsTrigger key={d} value={d}>
                    {d}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {historyAvg !== null && (
              <p className="text-sm text-muted-foreground">
                历史平均正确率：<span className="font-medium">{historyAvg}%</span>
              </p>
            )}
            <Button className="w-full" size="lg" onClick={start} disabled={all.length === 0}>
              开始听写（10 句）
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
