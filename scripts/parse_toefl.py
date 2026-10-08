#!/usr/bin/env python3
"""Parse 新托福核心词4500.pdf into public/data/toefl.json (WordEntry format)."""
import re
import json
import PyPDF2

PDF = "/Users/Ru_air/Desktop/All/TOEFL/新TOEFL/词汇/新托福核心词4500.pdf"
OUT = "/Users/Ru_air/vibe-english/public/data/toefl.json"

reader = PyPDF2.PdfReader(PDF)
raw = "\n".join((p.extract_text() or "") for p in reader.pages)
raw = raw.replace("\xa0", " ").replace("\n", " ")

starts = [m.start() for m in re.finditer(r"[ABC][12](?=[A-Za-z])", raw)]
entries = []

POS_LIST = "n|v|adj|adv|prep|pron|conj|num|det|int|aux|modal|art"
POS_INLINE = re.compile(r"(?<![A-Za-z])(?:" + POS_LIST + r")\.")

for i, s in enumerate(starts):
    end = starts[i + 1] if i + 1 < len(starts) else len(raw)
    seg = raw[s:end]

    m = re.match(r"[ABC][12]([A-Za-z][A-Za-z'\-\.]*)\s*(/[^/\n]{2,40}/)?", seg)
    if not m:
        continue
    word = m.group(1).rstrip(".")
    phonetic = (m.group(2) or "").strip()
    rest = seg[m.end():]

    ex_idx = next((j for j, ch in enumerate(rest) if "A" <= ch <= "Z"), None)
    if ex_idx is None:
        meaning = rest
        example = ""
        example_cn = ""
    else:
        meaning = rest[:ex_idx]
        tail = rest[ex_idx:]
        cn_idx = next((j for j, ch in enumerate(tail) if "\u4e00" <= ch <= "\u9fff"), None)
        example = tail[:cn_idx].strip() if cn_idx is not None else tail.strip()
        example_cn = tail[cn_idx:].strip() if cn_idx is not None else ""

    pm = POS_INLINE.search(meaning)
    pos = pm.group(0).rstrip(".") if pm else ""
    translation = POS_INLINE.sub(" ", meaning).strip()
    translation = re.sub(r"\s+", " ", translation).strip(" ；;，,、.")

    example = re.sub(r"\s+", " ", example).strip()
    example_cn = example_cn.replace(" ", "").strip()

    if not word or not translation:
        continue

    entry = {
        "word": word,
        "translations": [{"translation": translation, "type": pos}],
        "phrases": [{"phrase": example, "translation": example_cn}] if example else [],
        "phonetic": {"us": phonetic, "uk": phonetic},
    }
    entries.append(entry)

seen = set()
deduped = []
for e in entries:
    w = e["word"].lower()
    if w in seen:
        continue
    seen.add(w)
    deduped.append(e)

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(deduped, f, ensure_ascii=False, indent=1)

print(f"parsed={len(entries)} deduped={len(deduped)}")
print("with phonetic:", sum(1 for e in deduped if e['phonetic']['us']))
print("with example:", sum(1 for e in deduped if e['phrases']))
print("with example_cn:", sum(1 for e in deduped if e['phrases'] and e['phrases'][0]['translation']))
print("with pos:", sum(1 for e in deduped if e['translations'][0]['type']))
# check residual latin in translation
bad = [e for e in deduped if re.search(r"[a-zA-Z]{2,}", e["translations"][0]["translation"])]
print("translations containing latin:", len(bad))
for e in bad[:10]:
    print("  ", e["word"], "=>", e["translations"][0]["translation"])
for e in deduped[:6]:
    print(json.dumps(e, ensure_ascii=False))
