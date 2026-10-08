"use client";

import * as React from "react";
import { Volume2, Plus, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { speak } from "@/lib/tts";
import { db } from "@/lib/db";
import type { LookupResult } from "@/lib/dictionary";

interface VocabularyCardProps {
  word: string;
  translation?: string;
  phonetic?: string | null;
  lookup?: LookupResult | null;
  example?: string;
  onAdded?: () => void;
}

export function VocabularyCard({
  word,
  translation,
  phonetic,
  lookup,
  example,
  onAdded,
}: VocabularyCardProps) {
  const [added, setAdded] = React.useState(false);

  const displayPhonetic = phonetic ?? lookup?.phonetic;
  const displayTranslation =
    translation ??
    lookup?.meanings
      .slice(0, 2)
      .map((m) => m.definition)
      .join("；");
  const displayExample = example ?? lookup?.meanings.find((m) => m.example)?.example;

  const handleAdd = async () => {
    const existing = await db.vocabulary.get({ word });
    if (!existing) {
      await db.vocabulary.add({
        word,
        translation: displayTranslation ?? "",
        phonetic: displayPhonetic ?? "",
        addedAt: Date.now(),
        mastered: false,
        reviewCount: 0,
        lastReviewAt: null,
        nextReviewAt: null,
      });
    }
    setAdded(true);
    onAdded?.();
  };

  return (
    <Card className="w-72 max-w-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">{word}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="朗读"
            onClick={() => speak(word)}
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>
        {displayPhonetic && (
          <p className="mt-1 text-sm text-muted-foreground">{displayPhonetic}</p>
        )}
        {displayTranslation && (
          <p className="mt-2 text-sm">{displayTranslation}</p>
        )}
        {displayExample && (
          <p className="mt-2 text-xs italic text-muted-foreground">
            “{displayExample}”
          </p>
        )}
        <Button
          size="sm"
          className="mt-3 w-full"
          disabled={added}
          onClick={handleAdd}
        >
          {added ? (
            <>
              <Check className="h-4 w-4" /> 已加入生词本
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> 加入生词本
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
