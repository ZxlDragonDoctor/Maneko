"""Real Gutenberg catalog search + download text smoke."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.gutenberg_catalog import load_catalog, search_catalog, fetch_text


async def main():
    items = load_catalog()
    print("catalog_count", len(items))
    assert len(items) > 10000, "catalog too small"

    hits = search_catalog("pride and prejudice", limit=5)
    print("pride hits", [(h["id"], h["title"][:40], h["author"][:30]) for h in hits])
    assert hits

    hits2 = search_catalog("sherlock", limit=3)
    print("sherlock", [h["title"][:40] for h in hits2])

    # download one short book text
    bid = hits[0]["id"]
    text = await fetch_text(bid)
    print("text_id", bid, "len", len(text), "head", text[:60].replace("\n", " "))
    assert len(text) > 500
    print("RESULT PASS")


if __name__ == "__main__":
    asyncio.run(main())
