"use client";

import * as React from "react";
import { Flame, BookX, Volume2, Check } from "lucide-react";
import { AppShell } from "@/components/Layout/AppShell";
import {
  LineChart,
  BarChart,
  DonutChart,
  type ChartPoint,
  type StackedBarPoint,
} from "@/components/ProgressChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMounted } from "@/lib/hooks";
import { db, todayKey } from "@/lib/db";
import { computeStreak } from "@/lib/stats";
import { speak } from "@/lib/tts";
import { lookupWord, type LookupResult } from "@/lib/dictionary";

interface WrongWord {
  word: string;
  count: number;
  lookup: LookupResult | null;
}

function weekKey(ts: number): string {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return `${monday.getMonth() + 1}/${monday.getDate()}`;
}

function dayLabel(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default function DashboardPage() {
  const mounted = useMounted();
  const [vocabGrowth, setVocabGrowth] = React.useState<ChartPoint[]>([]);
  const [dailyBars, setDailyBars] = React.useState<StackedBarPoint[]>([]);
  const [accuracyTrend, setAccuracyTrend] = React.useState<ChartPoint[]>([]);
  const [donut, setDonut] = React.useState<ChartPoint[]>([]);
  const [wrongWords, setWrongWords] = React.useState<WrongWord[]>([]);
  const [streak, setStreak] = React.useState({ current: 0, longest: 0 });
  const [masteredCount, setMasteredCount] = React.useState(0);
  const [totalWords, setTotalWords] = React.useState(0);

  React.useEffect(() => {
    if (!mounted) return;

    (async () => {
      const vocab = await db.vocabulary.toArray();
      setMasteredCount(vocab.filter((v) => v.mastered).length);
      setTotalWords(vocab.length);

      const mastered = vocab
        .filter((v) => v.mastered)
        .sort((a, b) => a.addedAt - b.addedAt);
      const byWeek = new Map<string, number>();
      mastered.forEach((v) => {
        const k = weekKey(v.addedAt);
        byWeek.set(k, (byWeek.get(k) ?? 0) + 1);
      });
      const weeks = [...byWeek.entries()].sort((a, b) =>
        a[0].localeCompare(b[0], undefined, { numeric: true })
      );
      let cum = 0;
      setVocabGrowth(
        weeks.map(([k, n]) => {
          cum += n;
          return { label: k, value: cum };
        })
      );

      const stats = await db.dailyStats.toArray();
      stats.sort((a, b) => a.date.localeCompare(b.date));
      const last14 = stats.slice(-14);
      setDailyBars(
        last14.map((s) => ({
          label: dayLabel(s.date),
          typing: Math.round(s.typingMinutes),
          reading: Math.round(s.readingMinutes),
          writing: Math.round(s.writingMinutes),
          translation: Math.round(s.translationMinutes),
        }))
      );
      const totalT = stats.reduce((s, x) => s + x.typingMinutes, 0);
      const totalR = stats.reduce((s, x) => s + x.readingMinutes, 0);
      const totalW = stats.reduce((s, x) => s + x.writingMinutes, 0);
      const totalTr = stats.reduce((s, x) => s + x.translationMinutes, 0);
      setDonut(
        [
          { label: "打字", value: Math.round(totalT) },
          { label: "阅读", value: Math.round(totalR) },
          { label: "写作", value: Math.round(totalW) },
          { label: "翻译", value: Math.round(totalTr) },
        ].filter((d) => d.value > 0)
      );

      const records = await db.typingRecords.toArray();
      const byWeekAcc = new Map<string, { sum: number; n: number }>();
      records.forEach((r) => {
        const k = weekKey(r.timestamp);
        const cur = byWeekAcc.get(k) ?? { sum: 0, n: 0 };
        cur.sum += r.accuracy;
        cur.n += 1;
        byWeekAcc.set(k, cur);
      });
      setAccuracyTrend(
        [...byWeekAcc.entries()]
          .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
          .map(([k, v]) => ({ label: k, value: Math.round(v.sum / v.n) }))
      );

      const wrongMap = new Map<string, number>();
      records.filter((r) => !r.correct).forEach((r) => {
        wrongMap.set(r.word, (wrongMap.get(r.word) ?? 0) + 1);
      });
      const wrong = [...wrongMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([word, count]) => ({ word, count, lookup: null as LookupResult | null }));
      setWrongWords(wrong);

      setStreak(await computeStreak());
    })();
  }, [mounted]);

  const markMastered = async (word: string) => {
    const existing = await db.vocabulary.get({ word });
    if (existing) {
      await db.vocabulary.update(existing.id!, { mastered: true });
    } else {
      await db.vocabulary.add({
        word,
        translation: "",
        phonetic: "",
        addedAt: Date.now(),
        mastered: true,
        reviewCount: 0,
        lastReviewAt: null,
        nextReviewAt: null,
      });
    }
    setWrongWords((w) => w.filter((x) => x.word !== word));
  };

  const showLookup = (word: string) => {
    lookupWord(word).then((res) => {
      setWrongWords((w) => w.map((x) => (x.word === word ? { ...x, lookup: res } : x)));
    });
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
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-2xl font-bold">学习数据面板</h1>
        <p className="mb-6 text-sm text-muted-foreground">所有数据保存在本地浏览器。</p>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                <Flame className="h-5 w-5 text-orange-500" /> {streak.current}
              </div>
              <div className="text-xs text-muted-foreground">连续学习天数</div>
              <div className="mt-1 text-xs text-muted-foreground">最长 {streak.longest} 天</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{masteredCount}</div>
              <div className="text-xs text-muted-foreground">已掌握单词</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{totalWords}</div>
              <div className="text-xs text-muted-foreground">生词本总数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{wrongWords.length}</div>
              <div className="text-xs text-muted-foreground">错词数量</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>词汇量增长（周）</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart data={vocabGrowth} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>打字正确率趋势（周）</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart data={accuracyTrend} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>每日学习时长（分钟）</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart data={dailyBars} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>模块时间占比</CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart data={donut} />
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookX className="h-5 w-5" /> 错词本
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wrongWords.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                暂无错词，继续加油！
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {wrongWords.map((w) => (
                  <div
                    key={w.word}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{w.word}</span>
                        <Badge variant="destructive">错 {w.count} 次</Badge>
                      </div>
                      {w.lookup && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {w.lookup.phonetic ?? ""}{" "}
                          {w.lookup.meanings[0]?.definition ?? ""}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => speak(w.word)}
                        aria-label="朗读"
                      >
                        <Volume2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => showLookup(w.word)}
                        aria-label="查看释义"
                      >
                        <BookX className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => markMastered(w.word)}
                        aria-label="标记为已掌握"
                      >
                        <Check className="h-4 w-4 text-emerald-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
