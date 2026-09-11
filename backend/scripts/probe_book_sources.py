import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services import book_sources as bs


async def main():
    for q in ["龙族", "诡秘", "austen", "西游", "三体", "poe", "shakespeare"]:
        print("====", q)
        try:
            g = await bs.search_gutenberg(q, 3)
            print(" gutenberg", len(g), [b.title[:40] for b in g[:2]])
        except Exception as e:
            print(" gutenberg ERR", type(e).__name__, e)
        try:
            w = await bs.search_wikisource(q, 3)
            print(" wikisource", len(w), [b.title[:40] for b in w[:2]])
        except Exception as e:
            print(" wikisource ERR", type(e).__name__, e)
        try:
            p = await bs.search_popular(q)
            print(" popular", len(p), [b.title for b in p[:3]])
        except Exception as e:
            print(" popular ERR", e)


if __name__ == "__main__":
    asyncio.run(main())
