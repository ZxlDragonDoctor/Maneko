from typing import List, Optional
from pathlib import Path

from sqlalchemy.orm import Session
from app.config import settings
from app.models.novel import Novel
from app.models.chapter import Chapter
from app.agents.novel_parser import NovelParserAgent


class NovelService:
    def __init__(self, db: Session):
        self.db = db
        self.parser_agent = NovelParserAgent()

    async def upload_novel(self, title: str, content: str) -> Novel:
        """上传并解析小说"""
        novel = Novel(title=title, content=content, status="processing")
        self.db.add(novel)
        self.db.commit()
        self.db.refresh(novel)
        novel_id = novel.id

        try:
            chapters_data = await self.parser_agent.parse_novel(content)
            if not chapters_data:
                chapters_data = [{"title": "全文", "content": content}]

            for i, ch_data in enumerate(chapters_data):
                chapter = Chapter(
                    novel_id=novel_id,
                    chapter_number=i + 1,
                    title=ch_data.get("title", f"第{i+1}章"),
                    content=ch_data.get("content", "") or content,
                    comic_status="pending",
                )
                self.db.add(chapter)

            novel.status = "completed"
            self.db.commit()

        except Exception as e:
            # Local fallback so upload still yields readable chapters
            print(f"upload_novel AI path failed, local fallback: {e}")
            self.db.rollback()
            novel = self.db.query(Novel).filter(Novel.id == novel_id).first()
            if novel is None:
                raise
            try:
                from app.agents.novel_parser import split_chapters_locally

                chapters_data = split_chapters_locally(content) or [
                    {"title": "全文", "content": content}
                ]
            except Exception:
                chapters_data = [{"title": "全文", "content": content}]

            for i, ch_data in enumerate(chapters_data):
                self.db.add(Chapter(
                    novel_id=novel_id,
                    chapter_number=i + 1,
                    title=ch_data.get("title", f"第{i+1}章"),
                    content=ch_data.get("content", "") or content,
                    comic_status="pending",
                ))
            novel.status = "completed"
            self.db.commit()
            self.db.refresh(novel)

        return novel

    def get_novel(self, novel_id: str) -> Optional[Novel]:
        """获取小说详情"""
        return self.db.query(Novel).filter(Novel.id == novel_id).first()

    def get_all_novels(self) -> List[Novel]:
        """获取所有小说"""
        return self.db.query(Novel).order_by(Novel.created_at.desc()).all()

    def delete_novel(self, novel_id: str) -> bool:
        """删除小说（含章节漫画文件）"""
        novel = self.get_novel(novel_id)
        if not novel:
            return False

        chapter_ids = [ch.id for ch in (novel.chapters or [])]
        for cid in chapter_ids:
            chapter_dir = Path(settings.COMIC_DIR) / cid
            if chapter_dir.is_dir():
                for f in chapter_dir.glob("panel_*.png"):
                    try:
                        f.unlink(missing_ok=True)
                    except OSError:
                        pass
                try:
                    chapter_dir.rmdir()
                except OSError:
                    pass

        self.db.delete(novel)
        self.db.commit()
        return True

    def get_chapters(self, novel_id: str) -> List[Chapter]:
        """获取小说的所有章节"""
        return (
            self.db.query(Chapter)
            .filter(Chapter.novel_id == novel_id)
            .order_by(Chapter.chapter_number)
            .all()
        )

    def get_chapter(self, chapter_id: str) -> Optional[Chapter]:
        """获取章节详情"""
        return self.db.query(Chapter).filter(Chapter.id == chapter_id).first()
