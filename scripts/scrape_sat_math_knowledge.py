#!/usr/bin/env python3
"""Scrape SAT Math knowledge-point practice questions to Word."""

from __future__ import annotations

import sys
from pathlib import Path

import scrape_sat_rw_knowledge as scraper

scraper.SUBJECT = "Math"
scraper.TARGET_BANKS = [
    "历年真题",
    "Bluebook Practice Test",
    "可汗学院",
    "Educator Question Bank",
    "老SAT",
]
scraper.DOC_TITLE = "SAT 数学 · 知识点练习题库"
scraper.DEFAULT_OUTPUT = (
    Path(__file__).resolve().parents[1]
    / "research"
    / "data"
    / "sat_math_knowledge_questions.docx"
)
scraper.CHECKPOINT_PATH = (
    Path(__file__).resolve().parents[1]
    / "research"
    / "data"
    / "sat_math_knowledge_questions.json"
)


if __name__ == "__main__":
    raise SystemExit(scraper.main())
