"""Personal library: categories, import, favorites, progress."""
from __future__ import annotations

import json
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.agents.novel_parser import NovelParserAgent, split_chapters_locally
from app.models.category import Category
from app.models.chapter import Chapter
from app.models.novel import Novel
from app.services import book_sources


def _parse_tags(raw) -> List[str]:
    if not raw:
        return []
    if isinstance(raw, list):
        return [str(x) for x in raw]
    try:
        val = json.loads(raw)
        return [str(x) for x in val] if isinstance(val, list) else []
    except Exception:
        return []


def novel_to_library_dict(n: Novel) -> Dict:
    cat = n.category
    return {
        "id": n.id,
        "title": n.title,
        "author": getattr(n, "author", "") or "",
        "summary": (getattr(n, "summary", "") or "")[:200],
        "cover_url": getattr(n, "cover_url", "") or "",
        "status": n.status,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "favorite": bool(getattr(n, "favorite", False)),
        "progress": float(getattr(n, "progress", 0) or 0),
        "source": getattr(n, "source", "upload") or "upload",
        "source_ref": getattr(n, "source_ref", "") or "",
        "tags": _parse_tags(getattr(n, "tags", "[]")),
        "category_id": getattr(n, "category_id", None),
        "category_name": cat.name if cat else None,
        "category_color": cat.color if cat else None,
        "content_length": len(n.content or ""),
    }


class LibraryService:
    def __init__(self, db: Session):
        self.db = db
        self.parser = NovelParserAgent()

    # —— Categories ——
    def list_categories(self) -> List[Category]:
        return (
            self.db.query(Category)
            .order_by(Category.sort_order, Category.created_at)
            .all()
        )

    def create_category(self, name: str, color: str = "#80535d") -> Category:
        name = (name or "").strip()
        if not name:
            raise ValueError("分类名不能为空")
        exists = self.db.query(Category).filter(Category.name == name).first()
        if exists:
            raise ValueError("分类已存在")
        cat = Category(name=name, color=color or "#80535d")
        self.db.add(cat)
        self.db.commit()
        self.db.refresh(cat)
        return cat

    def update_category(self, cat_id: str, **fields) -> Category:
        cat = self.db.query(Category).filter(Category.id == cat_id).first()
        if not cat:
            raise ValueError("分类不存在")
        if "name" in fields and fields["name"]:
            cat.name = fields["name"].strip()
        if "color" in fields and fields["color"]:
            cat.color = fields["color"]
        if "sort_order" in fields and fields["sort_order"] is not None:
            cat.sort_order = int(fields["sort_order"])
        self.db.commit()
        self.db.refresh(cat)
        return cat

    def delete_category(self, cat_id: str) -> None:
        cat = self.db.query(Category).filter(Category.id == cat_id).first()
        if not cat:
            raise ValueError("分类不存在")
        # unlink novels
        for n in self.db.query(Novel).filter(Novel.category_id == cat_id).all():
            n.category_id = None
        self.db.delete(cat)
        self.db.commit()

    def ensure_default_categories(self) -> None:
        if self.db.query(Category).count() > 0:
            return
        defaults = [
            ("修仙", "#80535d"),
            ("科幻", "#32675f"),
            ("悬疑", "#875b2e"),
            ("言情", "#a33e42"),
            ("日常", "#596259"),
        ]
        for i, (name, color) in enumerate(defaults):
            self.db.add(Category(name=name, color=color, sort_order=i))
        self.db.commit()

    # —— Library listing ——
    def list_books(
        self,
        q: str = "",
        category_id: Optional[str] = None,
        favorite: Optional[bool] = None,
        source: Optional[str] = None,
        tag: Optional[str] = None,
        sort: str = "updated",
    ) -> List[Dict]:
        query = self.db.query(Novel)
        if category_id == "none":
            query = query.filter(Novel.category_id.is_(None))
        elif category_id:
            query = query.filter(Novel.category_id == category_id)
        if favorite is not None:
            query = query.filter(Novel.favorite == bool(favorite))
        if source:
            query = query.filter(Novel.source == source)
        q = (q or "").strip()
        if q:
            like = f"%{q}%"
            query = query.filter(
                (Novel.title.ilike(like))
                | (Novel.author.ilike(like))
                | (Novel.summary.ilike(like))
            )
        if sort == "title":
            query = query.order_by(Novel.title)
        elif sort == "progress":
            query = query.order_by(Novel.progress.desc())
        else:
            query = query.order_by(Novel.updated_at.desc())

        books = [novel_to_library_dict(n) for n in query.all()]
        if tag:
            books = [b for b in books if tag in b["tags"]]
        return books

    def stats(self) -> Dict:
        total = self.db.query(Novel).count()
        fav = self.db.query(Novel).filter(Novel.favorite.is_(True)).count()
        by_source: Dict[str, int] = {}
        for n in self.db.query(Novel.source).all():
            key = n[0] or "upload"
            by_source[key] = by_source.get(key, 0) + 1
        by_cat: Dict[str, int] = {}
        cats = {c.id: c.name for c in self.list_categories()}
        for n in self.db.query(Novel.category_id).all():
            key = cats.get(n[0]) if n[0] else "未分类"
            key = key or "未分类"
            by_cat[key] = by_cat.get(key, 0) + 1
        return {
            "total": total,
            "favorite": fav,
            "categories": len(cats),
            "by_source": by_source,
            "by_category": by_cat,
        }

    # —— Book meta ——
    def update_book(
        self,
        novel_id: str,
        *,
        title: Optional[str] = None,
        author: Optional[str] = None,
        summary: Optional[str] = None,
        category_id: Optional[str] = None,
        clear_category: bool = False,
        tags: Optional[List[str]] = None,
        favorite: Optional[bool] = None,
        progress: Optional[float] = None,
    ) -> Dict:
        n = self.db.query(Novel).filter(Novel.id == novel_id).first()
        if not n:
            raise ValueError("书籍不存在")
        if title:
            n.title = title.strip()
        if author is not None:
            n.author = author.strip()
        if summary is not None:
            n.summary = summary
        if clear_category:
            n.category_id = None
        elif category_id is not None:
            if category_id and not self.db.query(Category).filter(Category.id == category_id).first():
                raise ValueError("分类不存在")
            n.category_id = category_id or None
        if tags is not None:
            n.tags = json.dumps([t.strip() for t in tags if t and t.strip()], ensure_ascii=False)
        if favorite is not None:
            n.favorite = bool(favorite)
        if progress is not None:
            n.progress = max(0.0, min(1.0, float(progress)))
        self.db.commit()
        self.db.refresh(n)
        return novel_to_library_dict(n)

    # —— Import ——
    async def import_from_source(
        self,
        *,
        source: str,
        title: str,
        content: str,
        author: str = "",
        summary: str = "",
        cover_url: str = "",
        source_ref: str = "",
        category_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict:
        title = (title or "未命名").strip()
        content = (content or "").strip()
        if len(content) < 20:
            raise ValueError("正文过短，无法导入")

        # dedupe by source_ref
        if source_ref:
            exists = (
                self.db.query(Novel)
                .filter(Novel.source == source, Novel.source_ref == source_ref)
                .first()
            )
            if exists:
                return novel_to_library_dict(exists)

        n = Novel(
            title=title[:250],
            content=content,
            status="processing",
            author=(author or "")[:120],
            summary=(summary or "")[:2000],
            cover_url=(cover_url or "")[:500],
            category_id=category_id,
            tags=json.dumps(tags or [], ensure_ascii=False),
            source=source,
            source_ref=(source_ref or "")[:500],
        )
        self.db.add(n)
        self.db.commit()
        self.db.refresh(n)

        try:
            chapters = await self.parser.parse_novel(content)
            if not chapters:
                chapters = split_chapters_locally(content)
            for i, ch in enumerate(chapters):
                self.db.add(Chapter(
                    novel_id=n.id,
                    chapter_number=i + 1,
                    title=ch.get("title", f"第{i+1}章"),
                    content=ch.get("content") or content,
                    comic_status="pending",
                ))
            n.status = "completed"
            self.db.commit()
        except Exception as e:
            print(f"import parse fallback: {e}")
            self.db.rollback()
            n = self.db.query(Novel).filter(Novel.id == n.id).first()
            self.db.add(Chapter(
                novel_id=n.id,
                chapter_number=1,
                title="全文",
                content=content,
                comic_status="pending",
            ))
            n.status = "completed"
            self.db.commit()

        self.db.refresh(n)
        return novel_to_library_dict(n)

    async def import_book_from_search(
        self,
        source: str,
        source_ref: str,
        download_url: str,
        title: str,
        author: str = "",
        summary: str = "",
        cover_url: str = "",
        category_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict:
        text = await book_sources.fetch_book_text(source, download_url, source_ref)
        return await self.import_from_source(
            source=source,
            title=title,
            content=text,
            author=author,
            summary=summary,
            cover_url=cover_url,
            source_ref=source_ref,
            category_id=category_id,
            tags=tags,
        )
