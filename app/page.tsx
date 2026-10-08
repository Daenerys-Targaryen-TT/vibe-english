"use client";

import Link from "next/link";
import * as React from "react";
import {
  Keyboard,
  BookOpen,
  PenLine,
  Languages,
  Flame,
  Clock,
  AlertCircle,
  Headphones,
} from "lucide-react";
import { AppShell } from "@/components/Layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMounted } from "@/lib/hooks";
import { db, todayKey } from "@/lib/db";
import { computeStreak } from "@/lib/stats";

const MODULES = [
  { href: "/typing", label: "单词打字", desc: "拼写 + 默写 + 发音强化", icon: Keyboard, color: "text-blue-500" },
  { href: "/listening", label: "听力听写", desc: "英音朗读 · 逐词听写", icon: Headphones, color: "text-cyan-500" },
  { href: "/reading", label: "外刊精读", desc: "划词查词 + 生词高亮", icon: BookOpen, color: "text-emerald-500" },
  { href: "/writing", label: "写作训练", desc: "限时写作 + 批改 + 范文", icon: PenLine, color: "text-amber-500" },
  { href: "/translation", label: "翻译训练", desc: "散文逐句对照", icon: Languages, color: "text-violet-500" },
];

export default function HomePage() {
  const mounted = useMounted();
  const [streak, setStreak] = React.useState({ current: 0, longest: 0 });
  const [dueWords, setDueWords] = React.useState(0);
  const [weeklyMinutes, setWeeklyMinutes] = React.useState(0);
  const [todayMinutes, setTodayMinutes] = React.useState(0);

  React.useEffect(() => {
    if (!mounted) return;
    (async () => {
      setStreak(await computeStreak());
      const now = Date.now();
      const due = await db.vocabulary
        .where("nextReviewAt")
        .above(0)
        .and((w) => (w.nextReviewAt ?? 0) <= now && !w.mastered)
        .count();
      setDueWords(due);

      const stats = await db.dailyStats.toArray();
      const nowD = new Date();
      let weekly = 0;
      let today = 0;
      const todayK = todayKey();
      for (const s of stats) {
        const sum =
          s.typingMinutes + s.readingMinutes + s.writingMinutes + s.translationMinutes;
        if (s.date === todayK) today += sum;
        const d = new Date(s.date);
        const diff = (startOfDay(nowD).getTime() - startOfDay(d).getTime()) / 86400000;
        if (diff >= 0 && diff < 7) weekly += sum;
      }
      setWeeklyMinutes(Math.round(weekly));
      setTodayMinutes(Math.round(today));
    })();
  }, [mounted]);

  function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

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
        <h1 className="mb-1 text-2xl font-bold">你好，欢迎回来 👋</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          目标：六级 600+ · 上外英语语言文学考研
        </p>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                <Flame className="h-5 w-5 text-orange-500" /> {streak.current}
              </div>
              <div className="text-xs text-muted-foreground">连续学习天数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{dueWords}</div>
              <div className="text-xs text-muted-foreground">待复习单词</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                <Clock className="h-5 w-5 text-muted-foreground" /> {todayMinutes}
              </div>
              <div className="text-xs text-muted-foreground">今日学习(分)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{weeklyMinutes}</div>
              <div className="text-xs text-muted-foreground">本周学习(分)</div>
            </CardContent>
          </Card>
        </div>

        {dueWords > 0 && (
          <Card className="mb-6 border-blue-500/30">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                有 {dueWords} 个单词到期需要复习，巩固记忆效果最好。
              </div>
              <Link href="/typing?mode=review">
                <Button size="sm">去复习</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <h2 className="mb-3 font-semibold">开始学习</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-4 p-5">
                  <m.icon className={`h-8 w-8 ${m.color}`} />
                  <div>
                    <h3 className="font-semibold">{m.label}</h3>
                    <p className="text-sm text-muted-foreground">{m.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>今日建议</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. 每天 20 个单词打字练习，保持拼写肌肉记忆。</p>
            <p>2. 精读一篇文章，划词 5 个以上生词。</p>
            <p>3. 每周完成 2 篇限时写作 + 2 篇翻译。</p>
            <p>4. 定期回顾错词本，直到清零。</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
