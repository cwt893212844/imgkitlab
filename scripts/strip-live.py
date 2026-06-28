#!/usr/bin/env python3
"""Remove Impeccable live.js injection blocks from HTML files."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
pattern = re.compile(
    r"\n?<!-- impeccable-live-start -->\s*"
    r'<script src="http://localhost:8400/live\.js"></script>\s*'
    r"<!-- impeccable-live-end -->\s*",
    re.MULTILINE,
)

for path in ROOT.rglob("*.html"):
    if ".impeccable" in path.parts:
        continue
    text = path.read_text(encoding="utf-8")
    cleaned, n = pattern.subn("\n", text)
    if n:
        path.write_text(cleaned.rstrip() + "\n", encoding="utf-8")
        print(f"stripped {path.relative_to(ROOT)}")
