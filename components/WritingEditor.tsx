"use client";

import * as React from "react";
import { Clock, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { checkGrammar } from "@/lib/languagetool";
import { db, addMinutes, type LanguageToolResult } from "@/lib/db";
import type { WritingPrompt } from "@/lib/types";

const CHECKLIST = [
  { category: "语法", items: ["主谓一致", "时态一致", "冠词使用"] },
  { category: "搭配", items: ["动名词搭配", "介词搭配"] },
  { category: "逻辑", items: ["论点是否清晰", "论据是否充分", "段落过渡是否自然"] },
  { category: "词汇", items: ["是否有重复用词", "是否使用高级表达"] },
];

export function WritingEditor({
  prompt,
  onBack,
}: {
  prompt: WritingPrompt;
  onBack: () => void;
}) {
  const [content, setContent] = React.useState("");
  const [remaining, setRemaining] = React.useState(prompt.timeLimit * 60);
  const [status, setStatus] = React.useState<"writing" | "submitted">("writing");
  const [checking, setChecking] = React.useState(false);
  const [checkResult, setCheckResult] = React.useState<LanguageToolResult | null>(null);

  const wordCount = React.useMemo(
    () => (content.trim() ? content.trim().split(/\s+/).length : 0),
    [content]
  );

  React.useEffect(() => {
    db.writingDrafts.get({ promptId: prompt.id }).then((draft) => {
      if (draft && !draft.submittedAt) {
        setContent(draft.content);
      }
    });
  }, [prompt.id]);

  React.useEffect(() => {
    if (status !== "writing") return;
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  React.useEffect(() => {
    if (remaining === 0 && status === "writing") {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  React.useEffect(() => {
    if (status !== "writing" || !content) return;
    const save = () => {
      db.writingDrafts.put({
        promptId: prompt.id,
        content,
        wordCount,
        savedAt: Date.now(),
        submittedAt: null,
        checkResult: null,
      });
    };
    const interval = setInterval(save, 10000);
    return () => {
      clearInterval(interval);
      save();
    };
  }, [content, wordCount, status, prompt.id]);

  const handleSubmit = async () => {
    setStatus("submitted");
    addMinutes("writing", Math.max(0.1, (prompt.timeLimit * 60 - remaining) / 60), {
      writingCount: 1,
    });
    setChecking(true);
    const result = await checkGrammar(content);
    setCheckResult(result);
    setChecking(false);
    db.writingDrafts.put({
      promptId: prompt.id,
      content,
      wordCount,
      savedAt: Date.now(),
      submittedAt: Date.now(),
      checkResult: result,
    });
  };

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  if (status === "submitted") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <h2 className="text-xl font-bold">写作完成</h2>
          <Badge variant="secondary">{wordCount} 词</Badge>
        </div>

        <div>
          <h3 className="mb-3 font-semibold">自查清单</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {CHECKLIST.map((section) => (
              <div key={section.category} className="rounded-lg border p-4">
                <div className="mb-2 text-sm font-semibold">{section.category}</div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-semibold">语法检查</h3>
          {checking ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 正在调用 LanguageTool…
            </div>
          ) : checkResult && checkResult.matches.length > 0 ? (
            <div className="space-y-2">
              {checkResult.matches.map((m, i) => (
                <div key={i} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium text-destructive">{m.shortMessage}</div>
                  <p className="mt-1 text-muted-foreground">
                    原文：“{m.sentence.slice(0, 120)}”
                  </p>
                  {m.replacements.length > 0 && (
                    <p className="mt-1">
                      建议：
                      {m.replacements
                        .slice(0, 3)
                        .map((r) => r.value)
                        .join(" / ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {checkResult
                ? "未检测到明显语法错误，继续保持！"
                : "语法检查不可用（可能网络受限），请对照自查清单人工检查。"}
            </p>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-semibold">你的作文</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        </div>

        <Button variant="outline" onClick={onBack}>
          返回题目列表
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{prompt.type === "argumentative" ? "议论文" : "Commentary"}</Badge>
          <Badge variant="outline">{prompt.category}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{wordCount} 词</span>
          <span className="flex items-center gap-1 font-mono text-sm">
            <Clock className="h-4 w-4" />
            {minutes}:{String(seconds).padStart(2, "0")}
          </span>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="font-semibold">{prompt.title ?? "写作题目"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{prompt.prompt}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          要求：{prompt.wordLimit} 词 · 限时 {prompt.timeLimit} 分钟
        </p>
      </div>

      <Textarea
        className="min-h-[320px] text-base leading-relaxed"
        placeholder="开始写作…（草稿每 10 秒自动保存）"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>
          返回
        </Button>
        <Button onClick={handleSubmit} disabled={!content.trim()}>
          完成并检查
        </Button>
      </div>
    </div>
  );
}
