from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agents.comic_style import detect_genre_id, list_styles, resolve_style_id
from app.database import get_db
from app.models.chapter import Chapter
from app.models.novel import Novel
from app.services.comic_service import ComicService
from app.services.novel_service import NovelService

router = APIRouter()


class GenerateRequest(BaseModel):
    chapter_id: str
    style_id: Optional[str] = None  # auto | xianxia | scifi | ...


class ComicStatusResponse(BaseModel):
    chapter_id: str
    status: str
    images: List[str]


class ComicPanelResponse(BaseModel):
    id: str
    panel_index: int
    script: str
    image_path: str


async def generate_comic_task(chapter_id: str, style_id: Optional[str]):
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        service = ComicService(db)
        await service.generate_chapter_comic(chapter_id, style_id=style_id)
    finally:
        db.close()


@router.get("/styles")
async def get_styles():
    """漫画风格预设列表（供前端选择）。"""
    return {"styles": list_styles()}


@router.post("/detect-style")
async def detect_style(chapter_id: Optional[str] = None, novel_id: Optional[str] = None,
                       db: Session = Depends(get_db)):
    """根据小说/章节内容建议风格 id。"""
    content = ""
    title = ""
    if novel_id:
        novel = db.query(Novel).filter(Novel.id == novel_id).first()
        if not novel:
            raise HTTPException(status_code=404, detail="小说不存在")
        content, title = novel.content, novel.title
    elif chapter_id:
        chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if not chapter:
            raise HTTPException(status_code=404, detail="章节不存在")
        novel = db.query(Novel).filter(Novel.id == chapter.novel_id).first()
        content = chapter.content
        title = novel.title if novel else ""
    else:
        raise HTTPException(status_code=400, detail="需要 chapter_id 或 novel_id")

    sid = detect_genre_id(content, title)
    return {"style_id": sid}


@router.post("/generate")
async def generate_comic(
    request: GenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    novel_service = NovelService(db)
    chapter = novel_service.get_chapter(request.chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="章节不存在")

    if chapter.comic_status == "generating":
        raise HTTPException(status_code=400, detail="该章节正在生成中")

    background_tasks.add_task(
        generate_comic_task,
        request.chapter_id,
        request.style_id,
    )

    return {
        "message": "漫画生成任务已启动",
        "chapter_id": request.chapter_id,
        "style_id": request.style_id or "auto",
    }


@router.get("/{chapter_id}/status", response_model=ComicStatusResponse)
async def get_comic_status(chapter_id: str, db: Session = Depends(get_db)):
    service = ComicService(db)
    try:
        status = service.get_chapter_status(chapter_id)
        return ComicStatusResponse(**status)
    except ValueError:
        raise HTTPException(status_code=404, detail="章节不存在")


@router.get("/{chapter_id}/images", response_model=List[ComicPanelResponse])
async def get_comic_images(chapter_id: str, db: Session = Depends(get_db)):
    service = ComicService(db)
    panels = service.get_chapter_comics(chapter_id)
    return [
        ComicPanelResponse(
            id=p.id,
            panel_index=p.panel_index,
            script=p.script,
            image_path=p.image_path,
        )
        for p in panels
    ]
