import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional


PRIORITY = ["code", "table", "chart", "steps", "list", "paragraph"]


@dataclass
class FormatIntent:
    format: str
    confidence: float
    matched_keywords: List[str]


def _load_keywords() -> Dict[str, List[str]]:
    base = Path(__file__).resolve().parent.parent / "config" / "format_keywords.json"
    if base.exists():
        return json.loads(base.read_text(encoding="utf-8"))
    return {}


def detect_format_intent(text: str, keywords: Optional[Dict[str, List[str]]] = None) -> FormatIntent:
    s = (text or "").strip().lower()
    kws = keywords if keywords is not None else _load_keywords()

    hits: Dict[str, List[str]] = {}
    for fmt, words in (kws or {}).items():
        for w in words:
            ww = str(w).strip().lower()
            if not ww:
                continue
            if ww in s:
                hits.setdefault(fmt, []).append(ww)

    for fmt in PRIORITY:
        if fmt in hits and hits[fmt]:
            conf = 0.7 + min(0.25, 0.05 * len(hits[fmt]))
            return FormatIntent(format=fmt, confidence=conf, matched_keywords=hits[fmt])

    if re.search(r"```", s):
        return FormatIntent(format="code", confidence=0.65, matched_keywords=["```"])

    if re.search(r"\|.+\|", s) and "table" in s:
        return FormatIntent(format="table", confidence=0.6, matched_keywords=["|"])

    return FormatIntent(format="paragraph", confidence=0.3, matched_keywords=[])
