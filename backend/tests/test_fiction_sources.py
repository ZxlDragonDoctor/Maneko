from app.services.book_sources import (
    BUILTIN_CATALOG,
    POPULAR_CATALOG,
    SOURCE_REGISTRY,
    search_builtin,
    search_popular,
)
from app.services.gutenberg_catalog import is_fiction


def test_sources_are_fiction_first():
    enabled = {s["id"] for s in SOURCE_REGISTRY if s.get("enabled")}
    assert "popular" in enabled
    assert "gutenberg" in enabled
    assert "builtin" in enabled
    # academic source disabled by default
    wiki = next(s for s in SOURCE_REGISTRY if s["id"] == "wikisource")
    assert wiki.get("enabled") is False


def test_builtin_is_novels_not_academic():
    titles = " ".join(b.title for b in BUILTIN_CATALOG)
    assert "西游" in titles or "水浒" in titles
    for b in BUILTIN_CATALOG:
        assert "维基" not in b.title
        assert b.download_url.startswith("builtin://")


def test_popular_and_builtin_searchable():
    import asyncio
    assert asyncio.run(search_popular("斗罗"))
    assert asyncio.run(search_builtin("聊斋")) or asyncio.run(search_builtin("西游"))


def test_gutenberg_fiction_filter():
    assert is_fiction("Science fiction; Horror tales", "Frankenstein")
    assert not is_fiction("Biology -- Textbooks", "Anatomy 101")
