import asyncio

from app.services.book_sources import POPULAR_CATALOG, search_popular


def test_yinian_yongheng_findable():
    hits = asyncio.run(search_popular("一念永恒"))
    assert hits, "一念永恒 must be searchable"
    assert hits[0].title == "一念永恒"
    assert hits[0].author == "耳根"


def test_popular_catalog_size_and_titles():
    assert len(POPULAR_CATALOG) >= 30
    titles = {b.title for b in POPULAR_CATALOG}
    for t in ("一念永恒", "仙逆", "斗破苍穹", "遮天", "盗墓笔记", "全职高手", "魔道祖师"):
        assert t in titles


def test_partial_keyword_match():
    hits = asyncio.run(search_popular("一念"))
    assert any("一念" in b.title for b in hits)
    hits2 = asyncio.run(search_popular("耳根"))
    assert any(b.author == "耳根" for b in hits2)
