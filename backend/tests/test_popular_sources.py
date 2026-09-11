from app.services.book_sources import POPULAR_CATALOG, search_popular, search_builtin


def test_popular_catalog_has_famous_titles():
    titles = {b.title for b in POPULAR_CATALOG}
    assert "龙族" in titles
    assert "斗罗大陆" in titles
    assert "诡秘之主" in titles
    for b in POPULAR_CATALOG:
        assert b.extra and b.extra.get("copyright") is True
        assert not b.download_url


def test_search_popular_matches():
    books = search_popular  # async
    import asyncio
    hits = asyncio.run(search_popular("诡秘"))
    assert hits and hits[0].title == "诡秘之主"
    hits2 = asyncio.run(search_popular("斗罗"))
    assert any("斗罗" in b.title for b in hits2)


def test_builtin_still_searchable():
    import asyncio
    hits = asyncio.run(search_builtin("西游"))
    assert hits
