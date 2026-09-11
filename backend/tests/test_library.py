"""Library service + book source unit tests (offline)."""
import asyncio

from app.services.book_sources import (
    SOURCE_REGISTRY,
    BUILTIN_CATALOG,
    search_builtin,
    fetch_builtin_text,
)
from app.services.library_service import LibraryService
from app.database import SessionLocal
from app.models.category import Category


def test_source_registry():
    ids = {s["id"] for s in SOURCE_REGISTRY}
    assert {"builtin", "gutenberg", "wikisource", "url"} <= ids


def test_builtin_search_and_text():
    books = asyncio.run(search_builtin("西游"))
    assert books and "西游" in books[0].title
    text = asyncio.run(fetch_builtin_text(BUILTIN_CATALOG[0].download_url))
    assert "花果山" in text


def test_library_categories_and_book_meta(tmp_path, monkeypatch):
    # use real sqlite from backend cwd — tests already do this
    db = SessionLocal()
    try:
        svc = LibraryService(db)
        svc.ensure_default_categories()
        cats = svc.list_categories()
        assert len(cats) >= 3

        book = asyncio.run(svc.import_from_source(
            source="builtin",
            title="测试书库导入",
            content="第一章 开始\n\n这是测试正文，足够长以便分章。",
            source_ref="test-import-1",
            tags=["测试"],
        ))
        assert book["title"] == "测试书库导入"
        assert book["status"] == "completed"

        cat_id = cats[0].id
        updated = svc.update_book(book["id"], category_id=cat_id, favorite=True, tags=["测试", "入库"])
        assert updated["favorite"] is True
        assert updated["category_id"] == cat_id
        assert "入库" in updated["tags"]

        listed = svc.list_books(q="测试书库导入")
        assert any(b["id"] == book["id"] for b in listed)
        stats = svc.stats()
        assert stats["total"] >= 1
    finally:
        db.close()
