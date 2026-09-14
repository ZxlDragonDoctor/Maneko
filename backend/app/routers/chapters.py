from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from app.database import get_db
from app.services.novel_service import NovelService
from app.utils.comic_paths import normalize_paths

router = APIRouter()

class ChapterResponse(BaseModel):
    id: str
    chapter_number: int
    title: str
    content: str
    comic_status: str
    comic_images: List[str]
    
    class Config:
        from_attributes = True

@router.get("/novels/{novel_id}/chapters", response_model=List[ChapterResponse])
async def get_novel_chapters(novel_id: str, db: Session = Depends(get_db)):
    """获取小说的所有章节"""
    service = NovelService(db)
    chapters = service.get_chapters(novel_id)
    return [
        ChapterResponse(
            id=ch.id,
            chapter_number=ch.chapter_number,
            title=ch.title,
            content=ch.content,
            comic_status=ch.comic_status,
            comic_images=normalize_paths(ch.comic_images or [])
        ) for ch in chapters
    ]

@router.get("/chapters/{chapter_id}", response_model=ChapterResponse)
async def get_chapter(chapter_id: str, db: Session = Depends(get_db)):
    """获取章节详情"""
    service = NovelService(db)
    chapter = service.get_chapter(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="章节不存在")
    
    return ChapterResponse(
        id=chapter.id,
        chapter_number=chapter.chapter_number,
        title=chapter.title,
        content=chapter.content,
        comic_status=chapter.comic_status,
        comic_images=normalize_paths(chapter.comic_images or [])
    )