from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import List, Optional
from zipfile import ZIP_DEFLATED, ZipFile
import os

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agents.comic_style import detect_genre_id, list_styles, resolve_style_id
from app.database import get_db
from app.config import settings
from app.models.chapter import Chapter
from app.models.novel import Novel
from app.services.comic_service import ComicService
from app.services.novel_service import NovelService
from app.utils.comic_paths import to_public_comic_path

router = APIRouter()


class GenerateRequest(BaseModel):
    chapter_id: str
    style_id: Optional[str] = None  # auto | xianxia | scifi | ...
    force: bool = False  # allow restart even if status is generating


class ComicStatusResponse(BaseModel):
    chapter_id: str
    status: str
    images: List[str]


class ComicPanelResponse(BaseModel):
    id: str
    panel_index: int
    script: str
    image_path: str


async def generate_comic_task(chapter_id: str, style_id: Optional[str], force: bool = False):
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        service = ComicService(db)
        await service.generate_chapter_comic(chapter_id, style_id=style_id, force=force)
    except Exception as e:
        print(f"background generate failed for {chapter_id}: {e}")
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

    if chapter.comic_status == "generating" and not request.force:
        # try auto-recover if panels already on disk
        service = ComicService(db)
        status = service.get_chapter_status(request.chapter_id)
        if status["status"] == "generating":
            raise HTTPException(status_code=400, detail="该章节正在生成中")

    background_tasks.add_task(
        generate_comic_task,
        request.chapter_id,
        request.style_id,
        request.force,
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
            image_path=to_public_comic_path(p.image_path) or p.image_path,
        )
        for p in panels
    ]


@router.get("/{chapter_id}/export")
async def export_comic(chapter_id: str, db: Session = Depends(get_db)):
    """Download all generated panel PNGs for a chapter as a ZIP archive."""
    chapter = NovelService(db).get_chapter(chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail="章节不存在")

    chapter_dir = (Path(settings.COMIC_DIR) / chapter_id).resolve()
    if not chapter_dir.is_dir():
        raise HTTPException(status_code=404, detail="该章节还没有可导出的漫画图片")
    panels = sorted(
        path for path in chapter_dir.glob("panel_*.png")
        if path.is_file() and path.resolve().parent == chapter_dir
    )
    if not panels:
        raise HTTPException(status_code=404, detail="该章节还没有可导出的漫画图片")

    archive_path = None
    try:
        with NamedTemporaryFile(prefix="maneko-comic-", suffix=".zip", delete=False) as tmp:
            archive_path = tmp.name
        with ZipFile(archive_path, "w", compression=ZIP_DEFLATED) as archive:
            for panel in panels:
                archive.write(panel, arcname=panel.name)
    except Exception:
        if archive_path:
            try:
                os.unlink(archive_path)
            except OSError:
                pass
        raise

    return FileResponse(
        archive_path,
        media_type="application/zip",
        filename=f"maneko-chapter-{chapter.chapter_number}.zip",
        background=BackgroundTask(lambda: os.path.exists(archive_path) and os.unlink(archive_path)),
    )
