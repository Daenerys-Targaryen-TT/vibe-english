"use client";

import * as React from "react";
import {
  Volume2,
  Check,
  ArrowRight,
  RotateCcw,
  Gauge,
  Square,
} from "lucide-react";
import { AppShell } from "@/components/Layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assetPath } from "@/lib/paths";
import { useMounted } from "@/lib/hooks";
import { speak, stopSpeech, setSpeechRate, isTtsSupported } from "@/lib/tts";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

interface ListeningQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface ListeningPassage {
  id: string;
  title: string;
  difficulty: string;
  passage: string;
  questions: ListeningQuestion[];
}

const DIFFICULTIES = ["CET-6", "考研"];
const OPTION_LABELS = ["A", "B", "C", "D"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ListeningPage() {
  const mounted = useMounted();
  const [all, setAll] = React.useState<ListeningPassage[]>([]);
  const [difficulty, setDifficulty] = React.useState("all");
  const [rate, setRate] = React.useState(0.85);
  const [session, setSession] = React.useState<ListeningPassage[]>([]);
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [phase, setPhase] = React.useState<"setup" | "practice" | "result">("setup");
  const [checked, setChecked] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [results, setResults] = React.useState<
    { passage: ListeningPassage; correct: number; total: number }[]
  >([]);
  const [historyAvg, setHistoryAvg] = React.useState<number | null>(null);

  React.useEffect(() => {
    fetch(assetPath("/data/listening.json"))
      .then((r) => r.json())
      .then((d: ListeningPassage[]) => setAll(d));
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

  React.useEffect(() => {
    return () => stopSpeech();
  }, []);

  const start = () => {
    const pool =
      difficulty === "all" ? all : all.filter((s) => s.difficulty === difficulty);
    setSession(shuffle(pool));
    setResults([]);
    setIndex(0);
    setAnswers({});
    setChecked(false);
    setPhase("practice");
  };

  const current = session[index];

  const play = () => {
    if (!current) return;
    setPlaying(true);
    speak(current.passage, { rate, onEnd: () => setPlaying(false) });
  };

  const stop = () => {
    stopSpeech();
    setPlaying(false);
  };

  const selectOption = (qIndex: number, optIndex: number) => {
    if (checked) return;
    setAnswers((a) => ({ ...a, [qIndex]: optIndex }));
  };

  const submit = () => {
    if (!current || checked) return;
    let correct = 0;
    current.questions.forEach((q, qi) => {
      if (answers[qi] === q.answer) correct++;
    });
    const total = current.questions.length;
    const accuracy = Math.round((correct / total) * 100);
    db.listeningRecords.add({
      sentenceId: current.id,
      correct: accuracy >= 95,
      accuracy,
      timestamp: Date.now(),
      duration: 0,
    });
    setResults((r) => [...r, { passage: current, correct, total }]);
    setChecked(true);
    stop();
  };

  const next = () => {
    if (index + 1 >= session.length) {
      setPhase("result");
    } else {
      setIndex((i) => i + 1);
      setAnswers({});
      setChecked(false);
    }
  };

  if (!mounted) {
    return (
      <AppShell>
        <div className="py-20 text-center text-muted-foreground">加载中…</div>
      </AppShell>
    );
  }

  if (phase === "result") {
    const answered = results.reduce((s, r) => s + r.correct, 0);
    const totalQ = results.reduce((s, r) => s + r.total, 0);
    const avg = totalQ ? Math.round((answered / totalQ) * 100) : 0;
    const perfect = results.filter((r) => r.correct === r.total).length;
    return (
      <AppShell>
        <div className="mx-auto max-w-xl space-y-4">
          <h1 className="text-xl font-bold">本轮听力完成</h1>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{avg}%</div>
                <div className="text-xs text-muted-foreground">正确率</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{perfect}/{results.length}</div>
                <div className="text-xs text-muted-foreground">全对篇数</div>
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
            目标 95-100% 正确率。未全对的篇目建议精听第二遍：先泛听抓主旨，再逐句重听定位细节。
          </p>
          <div className="space-y-2">
            {results
              .filter((r) => r.correct < r.total)
              .map((r) => (
                <div key={r.passage.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.passage.title}</span>
                    <Badge variant="destructive">
                      {r.correct}/{r.total}
                    </Badge>
                  </div>
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
    const allAnswered = current.questions.every((_, qi) => answers[qi] !== undefined);
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{current.difficulty}</Badge>
              <Badge variant="outline">
                {index + 1} / {session.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Gauge className="h-4 w-4" />
                {[0.6, 0.75, 0.85, 1.0].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRate(r)}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs",
                      rate === r ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    {r === 0.6 ? "慢" : r === 1.0 ? "快" : r === 0.75 ? "中" : "常"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>{current.title}</CardTitle>
              {playing ? (
                <Button variant="outline" size="icon" onClick={stop} aria-label="停止">
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="outline" size="icon" onClick={play} aria-label="播放">
                  <Volume2 className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                点击播放按钮听短文，可多次重听，然后回答下面的问题。
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {current.questions.map((q, qi) => {
              const chosen = answers[qi];
              const isCorrect = checked && chosen === q.answer;
              const isWrong = checked && chosen !== undefined && chosen !== q.answer;
              return (
                <Card key={qi}>
                  <CardContent className="space-y-2 p-4">
                    <p className="font-medium">
                      {qi + 1}. {q.question}
                    </p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, oi) => {
                        const isAnswer = q.answer === oi;
                        const isChosen = chosen === oi;
                        return (
                          <button
                            key={oi}
                            onClick={() => selectOption(qi, oi)}
                            className={cn(
                              "flex w-full items-start gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors",
                              isChosen && !checked && "border-primary bg-accent",
                              checked && isAnswer && "border-emerald-500 bg-emerald-500/10",
                              checked && isChosen && !isAnswer && "border-red-500 bg-red-500/10",
                              !checked && !isChosen && "hover:bg-accent"
                            )}
                          >
                            <span className="font-semibold">{OPTION_LABELS[oi]}.</span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                    {checked && (
                      <div className="rounded-md bg-muted/60 p-2 text-sm">
                        <div className={cn("font-medium", isCorrect ? "text-emerald-600" : "text-red-500")}>
                          {isCorrect
                            ? "✓ 正确"
                            : `✗ 正确答案：${OPTION_LABELS[q.answer]}`}
                        </div>
                        <p className="mt-1 text-muted-foreground">{q.explanation}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pb-8">
            {!checked ? (
              <Button onClick={submit} disabled={!allAnswered}>
                <Check className="h-4 w-4" /> 提交答案
              </Button>
            ) : (
              <Button onClick={next}>
                下一篇 <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <h1 className="mb-1 text-2xl font-bold">听力训练</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          英音朗读短文 + 理解题。建议先读题，再泛听抓主旨，最后精听定位细节。目标正确率 95-100%。
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
                <TabsTrigger value="all">全部（{all.length} 篇）</TabsTrigger>
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
              开始练习
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
