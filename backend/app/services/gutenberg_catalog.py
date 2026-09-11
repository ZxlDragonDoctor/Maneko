"""Project Gutenberg catalog + download (official free public-domain books).

Catalog: https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv
Text:    https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import quote

import httpx

from app.config import settings

TIMEOUT = 60.0
CATALOG_URL = "https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv"
UA = "novel-comic-library/1.0 (+local educational use)"

# cache file next to backend data
_cache_path = Path("data") / "pg_catalog.json"


@dataclass
class PgBook:
    id: str
    title: str
    author: str
    language: str
    subjects: str
    text_url: str
    cover_url: str

    def to_dict(self) -> Dict:
        return {
            "source": "gutenberg",
            "source_ref": self.id,
            "title": self.title,
            "author": self.author,
            "summary": self.subjects[:240],
            "cover_url": self.cover_url,
            "download_url": self.text_url,
            "language": self.language,
            "copyright": False,
            "importable": True,
            "tags": [],
        }


def _cache_file() -> Path:
    p = Path(settings.UPLOAD_DIR).parent / "data" / "pg_catalog.json"
    # prefer backend/data
    p = Path("data") / "pg_catalog.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


async def download_catalog(force: bool = False) -> Path:
    """Download official Gutenberg catalog CSV and convert to lightweight JSON."""
    out = _cache_file()
    if out.exists() and not force:
        return out

    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True, headers={"User-Agent": UA}) as client:
        r = await client.get(CATALOG_URL)
        r.raise_for_status()
        raw = r.content

    # parse CSV (can be large)
    text = raw.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        book_id = (row.get("Text#") or row.get("Text") or "").strip()
        if not book_id or not book_id.isdigit():
            continue
        title = (row.get("Title") or "").strip()
        authors = (row.get("Authors") or "").strip()
        lang = (row.get("Language") or "").strip()
        subjects = (row.get("Subjects") or "").strip()
        # prefer plain text urls in Loc
        loc = row.get("Loc") or ""
        # Official stable text URL
        text_url = f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt"
        cover = f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.cover.medium.jpg"
        if not title:
            continue
        rows.append({
            "id": book_id,
            "title": title[:200],
            "author": authors[:120],
            "language": lang[:16],
            "subjects": subjects[:500],
            "text_url": text_url,
            "cover_url": cover,
        })

    import json
    out.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    return out


def load_catalog() -> List[Dict]:
    import json

    p = _cache_file()
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return []


FICTION_MARKERS = (
    "fiction",
    "novel",
    "short stories",
    "adventure",
    "romance",
    "mystery",
    "detective",
    "horror",
    "science fiction",
    "fantasy",
    "historical fiction",
    "love stories",
    "ghost stories",
    "fairy tales",
    "juvenile fiction",
    "western stories",
    "war stories",
    "humorous stories",
    "comic books",
    "graphic novels",
)


def is_fiction(subjects: str, title: str = "") -> bool:
    blob = f"{subjects or ''} {title or ''}".lower()
    return any(m in blob for m in FICTION_MARKERS)


def search_catalog(
    q: str,
    limit: int = 20,
    lang: Optional[str] = None,
    fiction_only: bool = True,
) -> List[Dict]:
    q = (q or "").strip().lower()
    items = load_catalog()
    if not items:
        return []
    scored = []
    for it in items:
        if lang and it.get("language", "").lower() != lang.lower():
            continue
        if fiction_only and not is_fiction(it.get("subjects", ""), it.get("title", "")):
            continue
        title = (it.get("title") or "").lower()
        author = (it.get("author") or "").lower()
        subj = (it.get("subjects") or "").lower()
        score = 0
        if not q:
            score = 1
        elif q in title:
            score = 100 - min(len(title), 50)
        elif q in author:
            score = 60
        elif q in subj:
            score = 20
        if score:
            scored.append((score, it))
    scored.sort(key=lambda x: -x[0])
    return [x[1] for x in scored[:limit]]


async def fetch_text(book_id: str) -> str:
    url = f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt"
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True, headers={"User-Agent": UA}) as client:
        r = await client.get(url)
        if r.status_code == 404:
            # fallback path
            url2 = f"https://www.gutenberg.org/files/{book_id}/{book_id}-0.txt"
            r = await client.get(url2)
        r.raise_for_status()
        return r.text[:400000]
