"""Lightweight SQLite schema upgrades for library fields (create_all won't ALTER)."""
from __future__ import annotations

from sqlalchemy import inspect, text

from app.database import engine


NOVEL_EXTRA_COLUMNS = {
    "author": "TEXT DEFAULT ''",
    "summary": "TEXT DEFAULT ''",
    "cover_url": "TEXT DEFAULT ''",
    "category_id": "TEXT",
    "tags": "TEXT DEFAULT '[]'",
    "favorite": "INTEGER DEFAULT 0",
    "progress": "REAL DEFAULT 0",
    "source": "TEXT DEFAULT 'upload'",
    "source_ref": "TEXT DEFAULT ''",
}


def ensure_schema() -> None:
    insp = inspect(engine)
    if not insp.has_table("novels"):
        return
    existing = {c["name"] for c in insp.get_columns("novels")}
    with engine.begin() as conn:
        for col, ddl in NOVEL_EXTRA_COLUMNS.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE novels ADD COLUMN {col} {ddl}"))
