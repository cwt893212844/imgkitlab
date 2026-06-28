#!/usr/bin/env python3
"""Split concatenated HTML files back into individual pages."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def split_file(src: Path, out_dir: Path, url_prefix: str) -> None:
    text = src.read_text(encoding="utf-8-sig")
    parts = [p.strip() for p in re.split(r"(?=<!DOCTYPE html>)", text) if p.strip()]
    for part in parts:
        m = re.search(
            rf'rel="canonical" href="https://imgkitlab\.com/{re.escape(url_prefix)}/([^"]+)"',
            part,
        )
        if not m:
            print(f"skip in {src.name}: no canonical")
            continue
        name = m.group(1)
        out = out_dir / name
        out.write_text(part + "\n", encoding="utf-8")
        print(f"  {name}: {len(part)} bytes")


def main() -> None:
    split_file(ROOT / "tools" / "compress-jpg.html", ROOT / "tools", "tools")
    split_file(ROOT / "pages" / "about.html", ROOT / "pages", "pages")


if __name__ == "__main__":
    main()
