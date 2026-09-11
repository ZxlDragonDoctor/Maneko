from typing import List, Optional

from sqlalchemy.orm import Session

from app.agents.comic_script import ComicScriptAgent
from app.agents.comic_generator import ComicGeneratorAgent
from app.agents.comic_style import resolve_style_id
from app.models.chapter import Chapter
from app.models.comic_panel import ComicPanel
from app.models.novel import Novel


class ComicService:
    def __init__(self, db: Session):
        self.db = db
        self.script_agent = ComicScriptAgent()
        self.generator_agent = ComicGeneratorAgent()

    def _load_novel_for_chapter(self, chapter: Chapter) -> Optional[Novel]:
        return self.db.query(Novel).filter(Novel.id == chapter.novel_id).first()

    async def generate_chapter_comic(
        self,
        chapter_id: str,
        style_id: Optional[str] = None,
    ) -> Chapter:
        """为章节生成漫画；style_id 为空时自动按内容适配。"""
        chapter = self.db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if not chapter:
            raise ValueError("Chapter not found")

        novel = self._load_novel_for_chapter(chapter)
        title = novel.title if novel else ""
        novel_content = novel.content if novel else chapter.content

        chapter.comic_status = "generating"
        self.db.commit()

        try:
            resolved_style = resolve_style_id(style_id, chapter.content or novel_content, title)

            panels_data = await self.script_agent.generate_script(
                chapter.content, style=resolved_style, title=title
            )

            image_paths = await self.generator_agent.generate_comic(
                panels_data,
                chapter_id,
                style_id=resolved_style,
                novel_content=chapter.content or novel_content,
                novel_title=title,
            )

            for i, (panel, img_path) in enumerate(zip(panels_data, image_paths)):
                if img_path:
                    self.db.add(ComicPanel(
                        chapter_id=chapter_id,
                        panel_index=i + 1,
                        script=panel.get("scene", ""),
                        image_path=img_path,
                    ))

            chapter.comic_images = [p for p in image_paths if p]
            chapter.comic_status = "completed"
            self.db.commit()

        except Exception as e:
            chapter.comic_status = "error"
            self.db.commit()
            raise e

        return chapter

    def get_chapter_status(self, chapter_id: str) -> dict:
        chapter = self.db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if not chapter:
            raise ValueError("Chapter not found")
        return {
            "chapter_id": chapter.id,
            "status": chapter.comic_status,
            "images": chapter.comic_images,
        }

    def get_chapter_comics(self, chapter_id: str) -> List[ComicPanel]:
        return (
            self.db.query(ComicPanel)
            .filter(ComicPanel.chapter_id == chapter_id)
            .order_by(ComicPanel.panel_index)
            .all()
        )
