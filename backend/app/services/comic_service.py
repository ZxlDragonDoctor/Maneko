from typing import List, Optional

from sqlalchemy.orm import Session

from app.agents.comic_script import ComicScriptAgent
from app.agents.comic_generator import ComicGeneratorAgent
from app.agents.comic_style import resolve_style_id
from app.config import settings
from app.models.chapter import Chapter
from app.models.comic_panel import ComicPanel
from app.models.novel import Novel
from app.utils.comic_paths import chapter_panel_files, normalize_paths, to_public_comic_path


class ComicService:
    def __init__(self, db: Session):
        self.db = db
        self.script_agent = ComicScriptAgent()
        self.generator_agent = ComicGeneratorAgent()

    def _load_novel_for_chapter(self, chapter: Chapter) -> Optional[Novel]:
        return self.db.query(Novel).filter(Novel.id == chapter.novel_id).first()

    def _clear_panels(self, chapter_id: str) -> None:
        self.db.query(ComicPanel).filter(ComicPanel.chapter_id == chapter_id).delete()

    def _recover_if_stale(self, chapter: Chapter) -> bool:
        """If status is stuck generating/error with no DB images but panels on disk, complete it.

        Active generation already records progressive `comic_images`, so leave those alone.
        """
        if chapter.comic_status not in ("generating", "error"):
            return False
        # Live generation: images are flowing in — do not steal the status
        if chapter.comic_status == "generating" and (chapter.comic_images or []):
            return False

        files = chapter_panel_files(chapter.id, settings.COMIC_DIR)
        if not files:
            return False

        self._clear_panels(chapter.id)
        for i, path in enumerate(files, start=1):
            self.db.add(ComicPanel(
                chapter_id=chapter.id,
                panel_index=i,
                script=f"panel_{i:02d}",
                image_path=path,
            ))
        chapter.comic_images = files
        chapter.comic_status = "completed"
        self.db.commit()
        return True

    def recover_stuck_chapters(self) -> int:
        """Startup helper: complete chapters that have panels on disk."""
        stuck = (
            self.db.query(Chapter)
            .filter(Chapter.comic_status.in_(["generating", "error"]))
            .all()
        )
        recovered = 0
        for ch in stuck:
            if self._recover_if_stale(ch):
                recovered += 1
        return recovered

    async def generate_chapter_comic(
        self,
        chapter_id: str,
        style_id: Optional[str] = None,
        force: bool = False,
    ) -> Chapter:
        """为章节生成漫画；style_id 为空时自动按内容适配。"""
        chapter = self.db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if not chapter:
            raise ValueError("Chapter not found")

        if chapter.comic_status == "generating" and not force:
            # recoverable leftover?
            if self._recover_if_stale(chapter):
                return chapter
            raise RuntimeError("该章节正在生成中")

        novel = self._load_novel_for_chapter(chapter)
        title = novel.title if novel else ""
        novel_content = novel.content if novel else chapter.content

        self._clear_panels(chapter_id)
        chapter.comic_images = []
        chapter.comic_status = "generating"
        self.db.commit()

        try:
            resolved_style = resolve_style_id(style_id, chapter.content or novel_content, title)

            panels_data = await self.script_agent.generate_script(
                chapter.content, style=resolved_style, title=title
            )
            if not panels_data:
                raise RuntimeError("分镜脚本为空")

            async def on_panel(index: int, image_path: Optional[str]) -> None:
                if not image_path:
                    return
                public = to_public_comic_path(image_path)
                chapter = self.db.query(Chapter).filter(Chapter.id == chapter_id).first()
                if not chapter:
                    return
                existing = list(chapter.comic_images or [])
                if public not in existing:
                    existing.append(public)
                    chapter.comic_images = existing
                self.db.merge(ComicPanel(
                    chapter_id=chapter_id,
                    panel_index=index + 1,
                    script=panels_data[index].get("scene", "") if index < len(panels_data) else "",
                    image_path=public,
                ))
                self.db.commit()

            image_paths = await self.generator_agent.generate_comic(
                panels_data,
                chapter_id,
                style_id=resolved_style,
                novel_content=chapter.content or novel_content,
                novel_title=title,
                on_panel=on_panel,
            )

            public_paths = normalize_paths([p for p in image_paths if p])
            disk_fallback = chapter_panel_files(chapter_id, settings.COMIC_DIR)
            final_paths = public_paths or disk_fallback

            # rebuild panels in order for consistency
            self._clear_panels(chapter_id)
            for i, path in enumerate(final_paths, start=1):
                script = ""
                if i - 1 < len(panels_data):
                    script = panels_data[i - 1].get("scene", "")
                self.db.add(ComicPanel(
                    chapter_id=chapter_id,
                    panel_index=i,
                    script=script,
                    image_path=path,
                ))

            chapter.comic_images = final_paths
            if final_paths:
                chapter.comic_status = "completed"
            else:
                chapter.comic_status = "error"
            self.db.commit()

        except Exception as e:
            # keep any partial panels visible
            disk_paths = chapter_panel_files(chapter_id, settings.COMIC_DIR)
            chapter = self.db.query(Chapter).filter(Chapter.id == chapter_id).first()
            if chapter:
                if disk_paths:
                    chapter.comic_images = disk_paths
                    chapter.comic_status = "completed" if len(disk_paths) > 0 else "error"
                else:
                    chapter.comic_status = "error"
                self.db.commit()
            print(f"generate_chapter_comic failed: {e}")
            if not disk_paths:
                raise e

        return self.db.query(Chapter).filter(Chapter.id == chapter_id).first()

    def get_chapter_status(self, chapter_id: str) -> dict:
        chapter = self.db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if not chapter:
            raise ValueError("Chapter not found")
        self._recover_if_stale(chapter)
        self.db.refresh(chapter)
        return {
            "chapter_id": chapter.id,
            "status": chapter.comic_status,
            "images": normalize_paths(chapter.comic_images or []),
        }

    def get_chapter_comics(self, chapter_id: str) -> List[ComicPanel]:
        return (
            self.db.query(ComicPanel)
            .filter(ComicPanel.chapter_id == chapter_id)
            .order_by(ComicPanel.panel_index)
            .all()
        )
