import asyncio

from app.agents.image_providers import MockImageProvider
from app.config import settings
from app.database import SessionLocal, engine, Base
from app.models.chapter import Chapter
from app.models.comic_panel import ComicPanel
from app.models.novel import Novel
from app.services.comic_service import ComicService


def _setup_db(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "COMIC_DIR", tmp_path / "comics")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    novel = Novel(title="t", content="content", status="completed")
    db.add(novel)
    db.commit()
    db.refresh(novel)
    chapter = Chapter(
        novel_id=novel.id,
        chapter_number=1,
        title="ch",
        content="少年在霓虹街头遇见修士，决定出发。",
        comic_status="pending",
    )
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    return db, novel, chapter


def test_generate_with_mock_and_force(tmp_path, monkeypatch):
    db, novel, chapter = _setup_db(tmp_path, monkeypatch)
    try:
        service = ComicService(db)
        service.generator_agent.provider = MockImageProvider()

        async def fake_script(content, style=None, title=""):
            return [
                {"scene": "霓虹街头相遇", "characters": ["少年"], "mood": "紧张", "style_notes": "霓虹东京"},
                {"scene": "决定出发", "characters": ["少女"], "mood": "坚定", "style_notes": "霓虹东京"},
            ]

        monkeypatch.setattr(service.script_agent, "generate_script", fake_script)

        result = asyncio.run(
            service.generate_chapter_comic(chapter.id, style_id="neon-tokyo")
        )
        assert result.comic_status == "completed"
        assert result.comic_images
        assert all(p.startswith("comics/") for p in result.comic_images)
        assert all("\\" not in p for p in result.comic_images)

        # force regenerate
        result2 = asyncio.run(
            service.generate_chapter_comic(chapter.id, style_id="scifi", force=True)
        )
        assert result2.comic_status == "completed"
        assert result2.comic_images
    finally:
        db.close()


def test_recover_stuck_generating_from_disk(tmp_path, monkeypatch):
    db, novel, chapter = _setup_db(tmp_path, monkeypatch)
    try:
        # simulate crash: files exist, status stuck
        chapter_dir = tmp_path / "comics" / chapter.id
        chapter_dir.mkdir(parents=True)
        (chapter_dir / "panel_01.png").write_bytes(b"png")
        (chapter_dir / "panel_02.png").write_bytes(b"png")
        chapter.comic_status = "generating"
        chapter.comic_images = []
        db.commit()

        service = ComicService(db)
        status = service.get_chapter_status(chapter.id)
        assert status["status"] == "completed"
        assert status["images"] == [
            f"comics/{chapter.id}/panel_01.png",
            f"comics/{chapter.id}/panel_02.png",
        ]
        panels = db.query(ComicPanel).filter(ComicPanel.chapter_id == chapter.id).all()
        assert len(panels) == 2
    finally:
        db.close()


def test_do_not_recover_active_generating_with_progress(tmp_path, monkeypatch):
    db, novel, chapter = _setup_db(tmp_path, monkeypatch)
    try:
        chapter_dir = tmp_path / "comics" / chapter.id
        chapter_dir.mkdir(parents=True)
        (chapter_dir / "panel_01.png").write_bytes(b"png")
        chapter.comic_status = "generating"
        chapter.comic_images = [f"comics/{chapter.id}/panel_01.png"]
        db.commit()

        service = ComicService(db)
        status = service.get_chapter_status(chapter.id)
        assert status["status"] == "generating"
        assert len(status["images"]) == 1
    finally:
        db.close()
