"""Lightweight similarity checks; swap for Moss / embeddings in production."""

from __future__ import annotations

import re
from difflib import SequenceMatcher


def normalize_code(source: str) -> str:
    without_strings = re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', '""', source)
    without_comments = re.sub(r"#.*?$|//.*?$|/\*.*?\*/", "", without_strings, flags=re.MULTILINE | re.DOTALL)
    collapsed = re.sub(r"\s+", " ", without_comments.strip().lower())
    return collapsed


def max_similarity_to_others(candidate: str, others: list[str]) -> float:
    if not others:
        return 0.0
    normalized = normalize_code(candidate)
    best = 0.0
    for o in others:
        ratio = SequenceMatcher(None, normalized, normalize_code(o)).ratio()
        if ratio > best:
            best = ratio
    return round(best, 4)
