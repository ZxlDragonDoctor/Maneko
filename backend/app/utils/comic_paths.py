"""Comic path helpers — keep API paths URL-friendly across OSes."""
from __future__ import annotations

from pathlib import Path
from typing import Iterable, List, Optional


def to_public_comic_path(path: Optional[str | Path]) -> Optional[str]:
    """Normalize a local comic path to `comics/<chapter>/panel_XX.png`."""
    if not path:
        return None
    s = str(path).replace("\\", "/").strip()
    if not s:
        return None
    marker = "comics/"
    idx = s.find(marker)
    if idx >= 0:
        return s[idx:]
    # already relative like comics/...
    if s.startswith("comics/"):
        return s
    return s.lstrip("/")


def normalize_paths(paths: Optional[Iterable]) -> List[str]:
    out: List[str] = []
    for p in paths or []:
        public = to_public_comic_path(p)
        if public:
            out.append(public)
    return out


def chapter_panel_files(chapter_id: str, comic_dir: Path) -> List[str]:
    """List existing panel files on disk for a chapter (sorted, public paths)."""
    chapter_dir = Path(comic_dir) / chapter_id
    if not chapter_dir.is_dir():
        return []
    files = sorted(chapter_dir.glob("panel_*.png"))
    return [f"comics/{chapter_id}/{f.name}" for f in files]
