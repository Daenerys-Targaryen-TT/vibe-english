"use client";

import * as React from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { AppShell } from "@/components/Layout/AppShell";
import { ArticleReader } from "@/components/ArticleReader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { assetPath } from "@/lib/paths";
import { useMounted } from "@/lib/hooks";
import type { Article } from "@/lib/types";

interface ArticleMeta {
  id: string;
  file: string;
}

export default function ReadingPage() {
  const mounted = useMounted();
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [current, setCurrent] = React.useState<Article | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(assetPath("/articles/index.json"))
      .then((r) => r.json())
      .then(async (list: ArticleMeta[]) => {
        const loaded = await Promise.all(
          list.map((m) =>
            fetch(assetPath(`/articles/${m.file}`)).then((r) => r.json())
          )
        );
        setArticles(loaded);
      })
      .finally(() => setLoading(false));
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
          <Button
            variant="ghost"
            className="mb-4 -ml-2"
            onClick={() => setCurrent(null)}
          >
            <ArrowLeft className="h-4 w-4" /> 返回列表
          </Button>
          <h1 className="mb-2 text-2xl font-bold">{current.title}</h1>
          <ArticleReader article={current} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-2xl font-bold">外刊精读</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          划词查词、一键加入生词本，文内自动高亮你积累的生词。
        </p>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground">加载中…</div>
        ) : articles.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            暂无文章，请将 JSON 文件放入 public/articles/。
          </div>
        ) : (
          <div className="grid gap-4">
            {articles.map((a) => (
              <Card
                key={a.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => setCurrent(a)}
              >
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <BookOpen className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <h2 className="font-semibold">{a.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {a.source} · {a.date}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{a.difficulty}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
