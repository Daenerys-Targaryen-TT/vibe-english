import type { LanguageToolResult } from "./db";

export async function checkGrammar(
  text: string,
  language = "en-US"
): Promise<LanguageToolResult | null> {
  if (!text.trim()) return null;
  try {
    const params = new URLSearchParams();
    params.set("text", text);
    params.set("language", language);
    const res = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as LanguageToolResult;
    return data;
  } catch {
    return null;
  }
}
