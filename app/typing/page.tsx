"use client";

import * as React from "react";
import { AppShell } from "@/components/Layout/AppShell";
import { TypingWord } from "@/components/TypingWord";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assetPath } from "@/lib/paths";
import { useMounted } from "@/lib/hooks";
import { setSpeechAccent, setSpeechRate, type SpeechAccent } from "@/lib/tts";
import { buildSessionWords, type SessionWordSource, type PracticeMode } from "@/lib/selectWords";
import type { WordEntry } from "@/lib/types";

const WORD_BOOKS = [
  { id: "cet6", label: "六级 CET-6", file: "cet6.json" },
  { id: "kaoyan", label: "考研", file: "kaoyan.json" },
  { id: "toefl", label: "托福 4500", file: "toefl.json" },
  { id: "gre", label: "GRE 核心", file: "gre-core.json" },
];

const MODES: { id: PracticeMode; label: string; desc: string }[] = [
  { id: "smart", label: "智能组词", desc: "复习 + 新词混合" },
  { id: "review", label: "仅复习", desc: "到期词 + 错词" },
  { id: "wrong", label: "仅错词", desc: "只练出错的词" },
];

const COUNTS = [10, 20, 40];

export default function TypingPage() {
  const mounted = useMounted();
  const [book, setBook] = React.useState("cet6");
  const [count, setCount] = React.useState(20);
  const [mode, setMode] = React.useState<PracticeMode>("smart");
  const [words, setWords] = React.useState<WordEntry[]>([]);
  const [source, setSource] = React.useState<SessionWordSource | null>(null);
  const [started, setStarted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [emptyMsg, setEmptyMsg] = React.useState<string | null>(null);
  const [accent, setAccent] = React.useState<SpeechAccent>("british");
  const [speechRate, setLocalRate] = React.useState(0.85);

  React.useEffect(() => {
    setSpeechAccent(accent);
  }, [accent]);

  React.useEffect(() => {
    setSpeechRate(speechRate);
  }, [speechRate]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("mode");
    if (m === "review" || m === "wrong" || m === "smart") setMode(m);
  }, []);

  const start = async () => {
    setLoading(true);
    setEmptyMsg(null);
    try {
      const b = WORD_BOOKS.find((x) => x.id === book)!;
      const res = await fetch(assetPath(`/data/${b.file}`));
      const data = (await res.json()) as WordEntry[];
      const { words, source } = await buildSessionWords(data, count, mode);
      if (words.length === 0) {
        setWords([]);
        setEmptyMsg(
          mode === "wrong"
            ? "暂无错词，先去智能组词练习积累吧！"
            : mode === "review"
            ? "暂无到期复习词，去智能组词学习新词吧！"
            : "当前词库为空，请检查数据文件。"
        );
        return;
      }
      setWords(words);
      setSource(source);
      setStarted(true);
    } catch {
      setWords([]);
      setEmptyMsg("词库加载失败，请检查网络后重试。");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <AppShell>
        <div className="py-20 text-center text-muted-foreground">加载中…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 text-2xl font-bold">单词打字练习</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          通过打字强化拼写与发音记忆，数据自动记录到生词本与学习统计。
        </p>

        {!started ? (
          <Card>
            <CardHeader>
              <CardTitle>选择词库</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={book} onValueChange={setBook}>
                <TabsList>
                  {WORD_BOOKS.map((b) => (
                    <TabsTrigger key={b.id} value={b.id}>
                      {b.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div>
                <div className="mb-2 text-sm font-medium">本轮单词数</div>
                <div className="flex gap-2">
                  {COUNTS.map((c) => (
                    <Button
                      key={c}
                      variant={count === c ? "default" : "outline"}
                      onClick={() => setCount(c)}
                    >
                      {c}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium">练习模式</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={
                        "rounded-lg border p-3 text-left transition-colors " +
                        (mode === m.id
                          ? "border-primary bg-accent"
                          : "hover:bg-accent")
                      }
                    >
                      <div className="text-sm font-semibold">{m.label}</div>
                      <div className="text-xs text-muted-foreground">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium">发音设置</div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-1">
                    {(["british", "american"] as SpeechAccent[]).map((a) => (
                      <Button
                        key={a}
                        size="sm"
                        variant={accent === a ? "default" : "outline"}
                        onClick={() => setAccent(a)}
                      >
                        {a === "british" ? "英式发音" : "美式发音"}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    {[0.6, 0.75, 0.85, 1.0].map((r) => (
                      <Button
                        key={r}
                        size="sm"
                        variant={speechRate === r ? "default" : "outline"}
                        onClick={() => setLocalRate(r)}
                      >
                        {r === 0.6 ? "慢" : r === 0.75 ? "中" : r === 0.85 ? "常" : "快"}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={start} disabled={loading}>
                {loading ? "加载中…" : "开始练习"}
              </Button>
              {emptyMsg && (
                <p className="text-center text-sm text-muted-foreground">{emptyMsg}</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {source && (
              <p className="mb-4 text-sm text-muted-foreground">
                本轮{source.due > 0 || source.wrong > 0 ? "复习" : ""}：
                {source.due > 0 && <span className="font-medium text-blue-500">待复习 {source.due}</span>}
                {source.due > 0 && source.wrong > 0 && " · "}
                {source.wrong > 0 && <span className="font-medium text-red-500">错词 {source.wrong}</span>}
                {source.fresh > 0 && (source.due > 0 || source.wrong > 0 ? " · " : "")}
                {source.fresh > 0 && <span>新词 {source.fresh}</span>}
              </p>
            )}
            <TypingWord words={words} onExit={() => setStarted(false)} />
          </>
        )}
      </div>
    </AppShell>
  );
}
