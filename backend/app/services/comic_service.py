from pathlib import Path
from typing import List, Optional
import shutil
from uuid import uuid4

from sqlalchemy.orm import Session

from app.agents.comic_script import ComicScriptAgent
from app.agents.comic_generator import ComicGeneratorAgent
from app.agents.comic_style import resolve_style_id
from app.config import settings
from app.models.chapter import Chapter
from app.models.comic_panel import ComicPanel
from app.models.novel import Novel
from app.utils.comic_paths import chapter_panel_files, normalize_paths, to_public_comic_path


ACTIVE_COMIC_GENERATIONS = set()


class ComicService:
    def __init__(self, db: Session):
        self.db = db
        self.script_agent = ComicScriptAgent()
        self.generator_agent = ComicGeneratorAgent()

    def _load_novel_for_chapter(self, chapter: Chapter) -> Optional[Novel]:
        return self.db.query(Novel).filter(Novel.id == chapter.novel_id).first()

    def _clear_panels(self, chapter_id: str) -> None:
        self.db.query(ComicPanel).filter(ComicPanel.chapter_id == chapter_id).delete()

    def _chapter_directory(self, chapter_id: str) -> Path:
        if not chapter_id or "/" in chapter_id or "\\" in chapter_id or chapter_id in {".", ".."}:
            raise ValueError("Invalid chapter id")
        comic_root = Path(settings.COMIC_DIR).resolve()
        chapter_dir = (comic_root / chapter_id).resolve()
        if chapter_dir.parent != comic_root:
            raise ValueError("Invalid chapter id")
        return chapter_dir

    def _clear_panel_files(self, chapter_id: str) -> None:
        chapter_dir = self._chapter_directory(chapter_id)
        if not chapter_dir.is_dir():
            return
        for panel in chapter_dir.glob("panel_*.png"):
            if (
                panel.is_file()
                and panel.resolve().parent == chapter_dir
                and panel.stem.startswith("panel_")
                and panel.stem[6:].isdigit()
            ):
                panel.unlink()

    def _prune_panel_files(self, chapter_id: str, keep_paths: List[str]) -> None:
        chapter_dir = self._chapter_directory(chapter_id)
        keep_names = {Path(path).name for path in normalize_paths(keep_paths)}
        if not chapter_dir.is_dir():
            return
        for panel in chapter_dir.glob("panel_*.png"):
            if (
                panel.is_file()
                and panel.resolve().parent == chapter_dir
                and panel.stem.startswith("panel_")
                and panel.stem[6:].isdigit()
                and panel.name not in keep_names
            ):
                panel.unlink()

    def _backup_panel_files(self, chapter_id: str) -> Optional[Path]:
        chapter_dir = self._chapter_directory(chapter_id)
        if not chapter_dir.is_dir():
            return None
        for stale_backup in chapter_dir.glob(".backup-*"):
            if stale_backup.is_dir() and stale_backup.resolve().parent == chapter_dir:
                shutil.rmtree(stale_backup)

        panels = []
        for public_path in chapter_panel_files(chapter_id, settings.COMIC_DIR):
            panel = chapter_dir / Path(public_path).name
            if (
                panel.is_file()
                and panel.resolve().parent == chapter_dir
                and panel.stem.startswith("panel_")
                and panel.stem[6:].isdigit()
            ):
                panels.append(panel)
        if not panels:
            return None

        backup_dir = chapter_dir / f".backup-{uuid4().hex}"
        backup_dir.mkdir()
        try:
            for panel in panels:
                shutil.copy2(panel, backup_dir / panel.name)
        except Exception:
            self._discard_panel_backup(chapter_id, backup_dir)
            raise
        return backup_dir

    def _restore_panel_backup(self, chapter_id: str, backup_dir: Path) -> List[str]:
        chapter_dir = self._chapter_directory(chapter_id)
        backup_dir = backup_dir.resolve()
        if backup_dir.parent != chapter_dir or not backup_dir.name.startswith(".backup-"):
            raise ValueError("Invalid comic backup path")
        self._clear_panel_files(chapter_id)
        for panel in backup_dir.glob("panel_*.png"):
            if (
                panel.is_file()
                and panel.resolve().parent == backup_dir
                and panel.stem.startswith("panel_")
                and panel.stem[6:].isdigit()
            ):
                shutil.copy2(panel, chapter_dir / panel.name)
        return chapter_panel_files(chapter_id, settings.COMIC_DIR)

    def _discard_panel_backup(self, chapter_id: str, backup_dir: Optional[Path]) -> None:
        if backup_dir is None:
            return
        chapter_dir = self._chapter_directory(chapter_id)
        resolved_backup = backup_dir.resolve()
        if resolved_backup.parent == chapter_dir and resolved_backup.name.startswith(".backup-"):
            shutil.rmtree(resolved_backup, ignore_errors=True)

    def _recover_if_stale(self, chapter: Chapter) -> bool:
        """Expose interrupted output as an error, never infer full completion from files alone."""
        if chapter.comic_status != "generating" or chapter.id in ACTIVE_COMIC_GENERATIONS:
            return False

        chapter_dir = self._chapter_directory(chapter.id)
        backups = sorted(
            path for path in chapter_dir.glob(".backup-*")
            if path.is_dir() and path.resolve().parent == chapter_dir
        ) if chapter_dir.is_dir() else []
        if backups:
            files = self._restore_panel_backup(chapter.id, backups[-1])
            images = files
        else:
            files = chapter_panel_files(chapter.id, settings.COMIC_DIR)
            images = list(dict.fromkeys(normalize_paths([*(chapter.comic_images or []), *files])))

        self._clear_panels(chapter.id)
        for i, path in enumerate(images, start=1):
            self.db.add(ComicPanel(
                chapter_id=chapter.id,
                panel_index=i,
                script=f"panel_{i:02d}",
                image_path=path,
            ))
        chapter.comic_images = images
        chapter.comic_status = "error"
        self.db.commit()
        for backup in backups:
            self._discard_panel_backup(chapter.id, backup)
        return True

    def recover_stuck_chapters(self) -> int:
        """Startup helper: surface interrupted jobs as errors with any surviving panels."""
        stuck = self.db.query(Chapter).filter(Chapter.comic_status == "generating").all()
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

        if chapter_id in ACTIVE_COMIC_GENERATIONS:
            raise RuntimeError("该章节正在生成中")

        if chapter.comic_status == "generating":
            # A stale interrupted job is first restored to its previous version.
            if self._recover_if_stale(chapter):
                if force:
                    chapter = self.db.query(Chapter).filter(Chapter.id == chapter_id).first()
                else:
                    return chapter
            else:
                raise RuntimeError("该章节正在生成中")

        novel = self._load_novel_for_chapter(chapter)
        title = novel.title if novel else ""
        novel_content = novel.content if novel else chapter.content

        previous_panels = [
            (panel.panel_index, panel.script, to_public_comic_path(panel.image_path))
            for panel in self.db.query(ComicPanel)
            .filter(ComicPanel.chapter_id == chapter_id)
            .order_by(ComicPanel.panel_index)
            .all()
        ]
        backup_dir = self._backup_panel_files(chapter_id)

        def restore_previous_result(current_chapter: Chapter) -> bool:
            if backup_dir is None:
                return False
            restored_paths = self._restore_panel_backup(chapter_id, backup_dir)
            if not restored_paths:
                return False

            old_panel_data = {
                path: (index, script)
                for index, script, path in previous_panels
                if path
            }
            self._clear_panels(chapter_id)
            for fallback_index, path in enumerate(restored_paths, start=1):
                panel_name = Path(path).stem
                index = int(panel_name[6:]) if panel_name.startswith("panel_") and panel_name[6:].isdigit() else fallback_index
                _, script = old_panel_data.get(path, (index, panel_name))
                self.db.add(ComicPanel(
                    chapter_id=chapter_id,
                    panel_index=index,
                    script=script,
                    image_path=path,
                ))
            current_chapter.comic_images = restored_paths
            current_chapter.comic_status = "error"
            self.db.commit()
            self._discard_panel_backup(chapter_id, backup_dir)
            return True

        self._clear_panels(chapter_id)
        chapter.comic_images = []
        chapter.comic_status = "generating"
        self.db.commit()
        ACTIVE_COMIC_GENERATIONS.add(chapter_id)

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

            public_paths = list(dict.fromkeys(normalize_paths([p for p in (image_paths or []) if p])))
            final_paths = public_paths or normalize_paths(chapter.comic_images or [])

            if len(final_paths) == len(panels_data):
                self._clear_panels(chapter_id)
                for i, path in enumerate(final_paths, start=1):
                    script = panels_data[i - 1].get("scene", "")
                    self.db.add(ComicPanel(
                        chapter_id=chapter_id,
                        panel_index=i,
                        script=script,
                        image_path=path,
                    ))
                chapter.comic_images = final_paths
                chapter.comic_status = "completed"
                self._prune_panel_files(chapter_id, final_paths)
                self.db.commit()
                self._discard_panel_backup(chapter_id, backup_dir)
            elif not restore_previous_result(chapter):
                # First-generation partial output remains visible and retryable.
                self._clear_panels(chapter_id)
                for i, path in enumerate(final_paths, start=1):
                    script = panels_data[i - 1].get("scene", "") if i - 1 < len(panels_data) else ""
                    self.db.add(ComicPanel(
                        chapter_id=chapter_id,
                        panel_index=i,
                        script=script,
                        image_path=path,
                    ))
                chapter.comic_images = final_paths
                chapter.comic_status = "error"
                self.db.commit()

        except Exception as e:
            chapter = self.db.query(Chapter).filter(Chapter.id == chapter_id).first()
            if chapter and not restore_previous_result(chapter):
                chapter.comic_status = "error"
                self.db.commit()
            print(f"generate_chapter_comic failed: {e}")
            if not (chapter.comic_images if chapter else []):
                raise e
        finally:
            ACTIVE_COMIC_GENERATIONS.discard(chapter_id)

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
