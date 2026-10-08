from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.services.novel_service import NovelService
from app.services.library_service import novel_to_library_dict
from app.config import settings

router = APIRouter()

class NovelResponse(BaseModel):
    id: str
    title: str
    status: str
    created_at: str
    author: str = ""
    favorite: bool = False
    progress: float = 0
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    source: str = "upload"
    tags: List[str] = []

    class Config:
        from_attributes = True

class NovelDetailResponse(NovelResponse):
    content: str

def _to_response(n) -> NovelResponse:
    d = novel_to_library_dict(n)
    return NovelResponse(
        id=d["id"],
        title=d["title"],
        status=d["status"],
        created_at=d["created_at"] or "",
        author=d["author"],
        favorite=d["favorite"],
        progress=d["progress"],
        category_id=d["category_id"],
        category_name=d["category_name"],
        source=d["source"],
        tags=d["tags"],
    )

@router.post("/upload", response_model=NovelResponse)
async def upload_novel(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """上传小说：支持文件（.txt / .md）或直接粘贴正文；可自定义标题。"""
    text_content = None
    default_title = "未命名小说"

    if file is not None:
        name = (file.filename or "").lower()
        if not name.endswith((".txt", ".md", ".markdown")):
            raise HTTPException(status_code=400, detail="只支持 .txt / .md 文本文件")

        content = await file.read(settings.MAX_UPLOAD_SIZE + 1)
        if len(content) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"文件大小不能超过 {settings.MAX_UPLOAD_SIZE} 字节",
            )

        try:
            text_content = content.decode('utf-8')
        except UnicodeDecodeError:
            try:
                text_content = content.decode('gbk')
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="无法解析文件编码（支持 UTF-8 / GBK）")

        default_title = (file.filename or default_title).rsplit('.', 1)[0]
    elif text is not None:
        text_content = text
        if len(text_content.encode("utf-8")) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"正文不能超过 {settings.MAX_UPLOAD_SIZE} 字节",
            )
    else:
        raise HTTPException(status_code=400, detail="请上传文件或粘贴正文")

    if not (text_content or "").strip():
        raise HTTPException(status_code=400, detail="正文为空")

    final_title = (title or "").strip() or default_title
    if len(final_title) > 80:
        final_title = final_title[:80]

    service = NovelService(db)
    novel = await service.upload_novel(final_title, text_content)

    return _to_response(novel)

@router.get("/", response_model=List[NovelResponse])
async def list_novels(db: Session = Depends(get_db)):
    service = NovelService(db)
    novels = service.get_all_novels()
    return [_to_response(n) for n in novels]

@router.get("/{novel_id}", response_model=NovelDetailResponse)
async def get_novel(novel_id: str, db: Session = Depends(get_db)):
    service = NovelService(db)
    novel = service.get_novel(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="小说不存在")

    base = _to_response(novel)
    return NovelDetailResponse(**base.model_dump(), content=novel.content or "")

@router.delete("/{novel_id}")
async def delete_novel(novel_id: str, db: Session = Depends(get_db)):
    """删除小说"""
    service = NovelService(db)
    if not service.delete_novel(novel_id):
        raise HTTPException(status_code=404, detail="小说不存在")
    return {"message": "删除成功"}
