"use client";

import * as React from "react";
import { ArrowLeft, Languages, Eye, EyeOff, History } from "lucide-react";
import { AppShell } from "@/components/Layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assetPath } from "@/lib/paths";
import { useMounted } from "@/lib/hooks";
import { db, addMinutes } from "@/lib/db";
import type { TranslationMaterial, TranslationSentence } from "@/lib/types";

interface AnswerState {
  translation: string;
  notes: string;
  showRef: boolean;
}

export default function TranslationPage() {
  const mounted = useMounted();
  const [materials, setMaterials] = React.useState<TranslationMaterial[]>([]);
  const [current, setCurrent] = React.useState<TranslationMaterial | null>(null);
  const [view, setView] = React.useState<"practice" | "history">("practice");
  const [answers, setAnswers] = React.useState<Record<string, AnswerState>>({});
  const [history, setHistory] = React.useState<{ id?: number; materialId: string; sentenceId: string; userTranslation: string; reference: string; timestamp: number }[]>([]);

  React.useEffect(() => {
    fetch(assetPath("/data/translation-materials.json"))
      .then((r) => r.json())
      .then(setMaterials);
  }, []);

  React.useEffect(() => {
    db.translationRecords.orderBy("timestamp").reverse().toArray().then(setHistory);
  }, [current]);

  const loadAnswers = (material: TranslationMaterial) => {
    const init: Record<string, AnswerState> = {};
    material.sentences.forEach((s) => {
      init[s.id] = { translation: "", notes: "", showRef: false };
    });
    db.translationRecords.where("materialId").equals(material.id).toArray().then((recs) => {
      const merged = { ...init };
      recs.forEach((r) => {
        merged[r.sentenceId] = {
          translation: r.userTranslation,
          notes: r.notes,
          showRef: false,
        };
      });
      setAnswers(merged);
    });
  };

  const saveSentence = (material: TranslationMaterial, sentence: TranslationSentence) => {
    const a = answers[sentence.id];
    if (!a) return;
    db.translationRecords.put({
      materialId: material.id,
      sentenceId: sentence.id,
      userTranslation: a.translation,
      reference: sentence.reference,
      notes: a.notes,
      timestamp: Date.now(),
    });
  };

  const finish = () => {
    if (!current) return;
    addMinutes("translation", 5, { translationCount: 1 });
    setCurrent(null);
  };

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
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" className="-ml-2" onClick={() => setCurrent(null)}>
              <ArrowLeft className="h-4 w-4" /> 返回
            </Button>
            <Button onClick={finish}>完成本次练习</Button>
          </div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{current.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {current.author} · {current.source} · {current.difficulty}
            </p>
          </div>

          <div className="space-y-6">
            {current.sentences.map((s) => {
              const a = answers[s.id] ?? { translation: "", notes: "", showRef: false };
              return (
                <Card key={s.id}>
                  <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                    <div>
                      <p className="text-base leading-relaxed">{s.chinese}</p>
                    </div>
                    <div className="space-y-2">
                      <Textarea
                        className="min-h-[80px]"
                        placeholder="在此输入你的译文…"
                        value={a.translation}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [s.id]: { ...a, translation: e.target.value },
                          }))
                        }
                        onBlur={() => saveSentence(current, s)}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [s.id]: { ...a, showRef: !a.showRef },
                            }))
                          }
                        >
                          {a.showRef ? (
                            <>
                              <EyeOff className="h-4 w-4" /> 隐藏参考译文
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4" /> 对照参考译文
                            </>
                          )}
                        </Button>
                      </div>
                      {a.showRef && (
                        <div className="rounded-lg bg-muted p-3 text-sm leading-relaxed">
                          {s.reference}
                        </div>
                      )}
                      <Textarea
                        className="min-h-[48px] text-sm"
                        placeholder="对参考译文做笔记…"
                        value={a.notes}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [s.id]: { ...a, notes: e.target.value },
                          }))
                        }
                        onBlur={() => saveSentence(current, s)}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-2xl font-bold">翻译训练</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          张培基英译散文选段，逐句对照，记录你的翻译与笔记。
        </p>

        <Tabs value={view} onValueChange={(v) => setView(v as "practice" | "history")}>
          <TabsList>
            <TabsTrigger value="practice">
              <Languages className="mr-1 h-4 w-4" /> 练习素材
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-1 h-4 w-4" /> 翻译历史
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {view === "practice" ? (
          <div className="mt-4 grid gap-4">
            {materials.map((m) => (
              <Card
                key={m.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => {
                  setCurrent(m);
                  loadAnswers(m);
                }}
              >
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <h2 className="font-semibold">{m.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {m.author} · {m.sentences.length} 句
                    </p>
                  </div>
                  <Badge variant="secondary">{m.difficulty}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {history.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">暂无翻译记录</p>
            ) : (
              history.map((h) => {
                const mat = materials.find((m) => m.id === h.materialId);
                return (
                  <div
                    key={h.id ?? `${h.materialId}-${h.sentenceId}`}
                    className="rounded-lg border p-4 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{mat?.title ?? h.materialId}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.timestamp).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    {h.userTranslation && (
                      <p className="mt-2 text-muted-foreground">你的译文：{h.userTranslation}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
