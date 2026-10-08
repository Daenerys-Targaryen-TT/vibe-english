"use client";

import * as React from "react";
import { PenLine, History } from "lucide-react";
import { AppShell } from "@/components/Layout/AppShell";
import { WritingEditor } from "@/components/WritingEditor";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { assetPath } from "@/lib/paths";
import { useMounted } from "@/lib/hooks";
import { db } from "@/lib/db";
import type { WritingPrompt } from "@/lib/types";

export default function WritingPage() {
  const mounted = useMounted();
  const [prompts, setPrompts] = React.useState<WritingPrompt[]>([]);
  const [current, setCurrent] = React.useState<WritingPrompt | null>(null);
  const [history, setHistory] = React.useState<{ promptId: string; submittedAt: number; wordCount: number }[]>([]);

  React.useEffect(() => {
    fetch(assetPath("/data/writing-prompts.json"))
      .then((r) => r.json())
      .then(setPrompts);
    db.writingDrafts.where("submittedAt").above(0).toArray().then((drafts) => {
      setHistory(
        drafts
          .map((d) => ({
            promptId: d.promptId,
            submittedAt: d.submittedAt ?? 0,
            wordCount: d.wordCount,
          }))
          .sort((a, b) => b.submittedAt - a.submittedAt)
      );
    });
  }, []);

  if (!mounted) {
    return (
      <AppShell>
        <div className="py-20 text-center text-muted-foreground">加载中…</div>
      </AppShell>
    );
  }

  if (current) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <WritingEditor prompt={current} onBack={() => setCurrent(null)} />
        </div>
      </AppShell>
    );
  }

  const promptTitle = (id: string) =>
    prompts.find((p) => p.id === id)?.title ?? id;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-2xl font-bold">写作训练</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          上外考研真题风格题目，限时写作 + 语法检查 + 自查清单。
        </p>

        <div className="grid gap-4">
          {prompts.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setCurrent(p)}
            >
              <CardContent className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary">
                    {p.type === "argumentative" ? "议论文" : "Commentary"}
                  </Badge>
                  <Badge variant="outline">{p.category}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {p.wordLimit} 词 · {p.timeLimit} 分钟
                  </span>
                </div>
                <p className="text-sm font-medium">{p.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {history.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <History className="h-4 w-4" /> 历史记录
            </h2>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <span>{promptTitle(h.promptId)}</span>
                  <span className="text-muted-foreground">
                    {h.wordCount} 词 · {new Date(h.submittedAt).toLocaleString("zh-CN")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
