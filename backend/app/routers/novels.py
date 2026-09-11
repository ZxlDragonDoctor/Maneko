from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.services.novel_service import NovelService
from app.services.library_service import novel_to_library_dict

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
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """上传小说文件（.txt / .md）"""
    name = (file.filename or "").lower()
    if not name.endswith((".txt", ".md", ".markdown")):
        raise HTTPException(status_code=400, detail="只支持 .txt / .md 文本文件")

    content = await file.read()

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="文件大小不能超过10MB")

    try:
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            text_content = content.decode('gbk')
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="无法解析文件编码")

    title = file.filename.rsplit('.', 1)[0]

    service = NovelService(db)
    novel = await service.upload_novel(title, text_content)

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