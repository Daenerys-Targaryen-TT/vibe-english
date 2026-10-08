export interface DictMeaning {
  partOfSpeech: string;
  definitions: { definition: string; example?: string }[];
}

export interface DictEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings: DictMeaning[];
}

export interface LookupResult {
  word: string;
  phonetic: string | null;
  meanings: { partOfSpeech: string; definition: string; example: string | null }[];
}

export async function lookupWord(word: string): Promise<LookupResult | null> {
  const clean = word.trim().toLowerCase().replace(/[^a-z\s'-]/g, "");
  if (!clean) return null;
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as DictEntry[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const entry = data[0];
    const phonetic =
      entry.phonetic ??
      entry.phonetics?.find((p) => p.text)?.text ??
      null;
    const meanings = entry.meanings.flatMap((m) =>
      m.definitions.slice(0, 2).map((d) => ({
        partOfSpeech: m.partOfSpeech,
        definition: d.definition,
        example: d.example ?? null,
      }))
    );
    return { word: clean, phonetic, meanings };
  } catch {
    return null;
  }
}
