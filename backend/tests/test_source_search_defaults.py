import asyncio

from app.services.book_sources import (
    BUILTIN_CATALOG,
    POPULAR_CATALOG,
    search_all_sources,
    search_builtin,
    search_gutenberg,
    search_popular,
)


def test_empty_search_returns_defaults():
    pop = asyncio.run(search_popular("", 6))
    assert len(pop) >= 5
    assert any("龙族" in b.title for b in pop)

    bi = asyncio.run(search_builtin("", 6))
    assert len(bi) >= 5
    titles = " ".join(b.title for b in bi)
    assert "测试" not in titles and "演示" not in titles


def test_gutenberg_empty_and_keyword():
    # requires catalog file; download if missing is handled inside
    try:
        books = asyncio.run(search_gutenberg("", 5))
    except RuntimeError:
        # network blocked — skip
        return
    assert len(books) >= 1
    assert books[0].title
    assert books[0].download_url.startswith("https://")


def test_search_all_empty_not_empty():
    try:
        books = asyncio.run(search_all_sources("", 12))
    except Exception:
        books = asyncio.run(search_all_sources("", 12))
    # popular + builtin always available offline
    assert len(books) >= 5


def test_no_test_demo_labels_in_catalogs():
    for b in list(POPULAR_CATALOG) + list(BUILTIN_CATALOG):
        blob = f"{b.title} {b.summary}"
        assert "测试" not in blob
        assert "演示" not in blob
