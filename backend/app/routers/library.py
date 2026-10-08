"""Library & external book-source APIs."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import book_sources
from app.services.library_service import LibraryService, novel_to_library_dict

router = APIRouter()


class CategoryCreate(BaseModel):
    name: str
    color: str = "#80535d"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    summary: Optional[str] = None
    category_id: Optional[str] = None
    clear_category: bool = False
    tags: Optional[List[str]] = None
    favorite: Optional[bool] = None
    progress: Optional[float] = Field(default=None, ge=0, le=1)


class ImportUrlRequest(BaseModel):
    url: str
    title: Optional[str] = None
    author: str = ""
    category_id: Optional[str] = None
    tags: List[str] = []


class ImportSearchRequest(BaseModel):
    source: str
    source_ref: str
    download_url: str
    title: str
    author: str = ""
    summary: str = ""
    cover_url: str = ""
    category_id: Optional[str] = None
    tags: List[str] = []


@router.get("/sources")
async def list_sources(include_disabled: bool = False):
    srcs = book_sources.SOURCE_REGISTRY
    if not include_disabled:
        srcs = [s for s in srcs if s.get("enabled", True)]
    return {"sources": srcs}


@router.get("/sources/{source_id}/search")
async def search_source(
    source_id: str,
    q: str = Query("", max_length=100),
    limit: int = Query(12, ge=1, le=30),
):
    if source_id == "url":
        raise HTTPException(status_code=400, detail="链接导入请使用 POST /api/library/import/url")
    if source_id == "all":
        books_raw = await book_sources.search_all_sources(q, limit)
        return {"query": q, "source": "all", "books": books_raw, "total": len(books_raw)}
    try:
        books = await book_sources.search_source(source_id, q, limit)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"书源请求失败: {e}")
    return {"query": q, "source": source_id, "books": [b.to_dict() for b in books], "total": len(books)}


@router.post("/sources/gutenberg/catalog")
async def refresh_gutenberg_catalog(force: bool = False):
    """Download/refresh official Project Gutenberg catalog (~79k books)."""
    from app.services import gutenberg_catalog as pg
    try:
        path = await pg.download_catalog(force=force)
        items = pg.load_catalog()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"目录下载失败: {e}")
    return {"ok": True, "path": str(path), "count": len(items)}


@router.get("/search")
async def search_all(
    q: str = Query("", max_length=100),
    limit: int = Query(16, ge=1, le=40),
):
    """跨书源聚合搜索；空 q 返回各源默认前几本。"""
    try:
        books = await book_sources.search_all_sources(q, limit)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"搜索失败: {e}")
    return {"query": q, "books": books, "total": len(books)}


@router.get("/books")
async def list_books(
    q: str = "",
    category_id: Optional[str] = None,
    favorite: Optional[bool] = None,
    source: Optional[str] = None,
    tag: Optional[str] = None,
    sort: str = "updated",
    db: Session = Depends(get_db),
):
    svc = LibraryService(db)
    return {"books": svc.list_books(q=q, category_id=category_id, favorite=favorite, source=source, tag=tag, sort=sort)}


@router.get("/stats")
async def library_stats(db: Session = Depends(get_db)):
    return LibraryService(db).stats()


@router.get("/categories")
async def list_categories(db: Session = Depends(get_db)):
    svc = LibraryService(db)
    svc.ensure_default_categories()
    cats = svc.list_categories()
    return {
        "categories": [
            {"id": c.id, "name": c.name, "color": c.color, "sort_order": c.sort_order}
            for c in cats
        ]
    }


@router.post("/categories")
async def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    svc = LibraryService(db)
    try:
        c = svc.create_category(body.name, body.color)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": c.id, "name": c.name, "color": c.color, "sort_order": c.sort_order}


@router.patch("/categories/{cat_id}")
async def update_category(cat_id: str, body: CategoryUpdate, db: Session = Depends(get_db)):
    svc = LibraryService(db)
    try:
        c = svc.update_category(cat_id, **body.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": c.id, "name": c.name, "color": c.color, "sort_order": c.sort_order}


@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, db: Session = Depends(get_db)):
    svc = LibraryService(db)
    try:
        svc.delete_category(cat_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.patch("/books/{novel_id}")
async def update_book(novel_id: str, body: BookUpdate, db: Session = Depends(get_db)):
    svc = LibraryService(db)
    try:
        return svc.update_book(novel_id, **body.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/import/url")
async def import_from_url(body: ImportUrlRequest, db: Session = Depends(get_db)):
    svc = LibraryService(db)
    try:
        text = await book_sources.fetch_url_text(body.url)
        title = body.title or body.url.rstrip("/").split("/")[-1][:80] or "链接导入"
        book = await svc.import_from_source(
            source="url",
            title=title,
            content=text,
            author=body.author,
            source_ref=body.url,
            category_id=body.category_id,
            tags=body.tags,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"book": book}


@router.post("/import/search")
async def import_from_search(body: ImportSearchRequest, db: Session = Depends(get_db)):
    if not body.download_url:
        raise HTTPException(
            status_code=400,
            detail="该书为版权作品，站内不提供全文。请将正版 txt/md 上传到书库后再生成漫画。",
        )
    svc = LibraryService(db)
    try:
        book = await svc.import_book_from_search(
            source=body.source,
            source_ref=body.source_ref,
            download_url=body.download_url,
            title=body.title,
            author=body.author,
            summary=body.summary,
            cover_url=body.cover_url,
            category_id=body.category_id,
            tags=body.tags,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"book": book}
