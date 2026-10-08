from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import main as main_module
from app.config import Settings, settings
from app.database import Base, get_db
from app.models.chapter import Chapter
from app.models.comic_panel import ComicPanel
from app.models.novel import Novel
from app.services.comic_service import ComicService
from app.utils.comic_paths import chapter_panel_files


client = TestClient(main_module.app)


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    test_engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=test_engine)
    monkeypatch.setattr(main_module, "engine", test_engine)
    test_sessions = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    def override_get_db():
        db = test_sessions()
        try:
            yield db
        finally:
            db.close()

    main_module.app.dependency_overrides[get_db] = override_get_db
    yield test_sessions
    main_module.app.dependency_overrides.pop(get_db, None)
    test_engine.dispose()


def test_ready_checks_database_connection(monkeypatch):
    test_engine = create_engine("sqlite://")
    monkeypatch.setattr(main_module, "engine", test_engine)
    monkeypatch.setattr(settings, "DASHSCOPE_API_KEY", "sk-test-configured")
    monkeypatch.setattr(settings, "IMAGE_PROVIDER", "qwen")

    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}
    test_engine.dispose()


def test_health_is_live_without_database_probe(monkeypatch):
    class BrokenEngine:
        def connect(self):
            raise AssertionError("liveness must not connect to the database")

    monkeypatch.setattr(main_module, "engine", BrokenEngine())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_ready_reports_database_failure(monkeypatch):
    class BrokenEngine:
        def connect(self):
            raise OSError("database unavailable")

    monkeypatch.setattr(main_module, "engine", BrokenEngine())

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "not_ready", "dependency": "database"}


def test_ready_rejects_mock_image_provider(monkeypatch):
    monkeypatch.setattr(settings, "DASHSCOPE_API_KEY", "sk-test-configured")
    monkeypatch.setattr(settings, "IMAGE_PROVIDER", "mock")

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "not_ready", "dependency": "production_image_provider"}


def test_ready_rejects_mimo_loopback_endpoint(monkeypatch):
    monkeypatch.setattr(settings, "DASHSCOPE_API_KEY", "sk-test-configured")
    monkeypatch.setattr(settings, "IMAGE_PROVIDER", "mimo")
    monkeypatch.setattr(settings, "MIMO_IMAGE_API_KEY", "mimo-test-key")
    monkeypatch.setattr(settings, "MIMO_IMAGE_BASE_URL", "http://127.0.0.1:7342/v1")

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "not_ready", "dependency": "image_provider_endpoint"}


def test_ready_accepts_configured_mimo_endpoint(monkeypatch):
    monkeypatch.setattr(settings, "DASHSCOPE_API_KEY", "sk-test-configured")
    monkeypatch.setattr(settings, "IMAGE_PROVIDER", "mimo")
    monkeypatch.setattr(settings, "MIMO_IMAGE_API_KEY", "mimo-test-key")
    monkeypatch.setattr(settings, "MIMO_IMAGE_BASE_URL", "https://images.vendor.net/v1")

    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_upload_body_limit_rejects_chunked_body_without_content_length(monkeypatch):
    middleware_type = getattr(main_module, "UploadBodySizeLimitMiddleware", None)
    assert middleware_type is not None, "upload size limit must wrap ASGI receive for chunked bodies"
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE", 8)
    body_limit = settings.MAX_UPLOAD_SIZE + 128 * 1024
    chunks = [
        {"type": "http.request", "body": b"x" * body_limit, "more_body": True},
        {"type": "http.request", "body": b"x", "more_body": False},
    ]
    sent = []

    async def downstream(scope, receive, send):
        while True:
            message = await receive()
            if not message.get("more_body", False):
                break
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    async def receive():
        return chunks.pop(0)

    async def send(message):
        sent.append(message)

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/novels/upload",
        "headers": [(b"content-type", b"multipart/form-data; boundary=test")],
    }
    middleware = middleware_type(downstream)
    asyncio.run(middleware(scope, receive, send))

    assert sent[0]["status"] == 413


def test_upload_rejects_file_over_configured_limit(monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE", 8)
    response = client.post(
        "/api/novels/upload",
        files={"file": ("novel.txt", b"123456789", "text/plain")},
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "文件大小不能超过 8 字节"


def test_cors_rejects_wildcards_in_json_array():
    with pytest.raises(ValueError, match="wildcard patterns are unsupported"):
        Settings(CORS_ORIGINS='["https://*.example.com"]')


def test_comic_export_downloads_all_panels_as_zip(tmp_path, monkeypatch, isolated_database):
    db = isolated_database()
    novel = Novel(title="Export test", content="A story")
    db.add(novel)
    db.flush()
    chapter = Chapter(novel_id=novel.id, chapter_number=1, title="Chapter 1", content="A scene")
    db.add(chapter)
    db.commit()
    chapter_id = chapter.id
    db.close()

    comic_dir = tmp_path / "comics"
    panel_dir = comic_dir / chapter_id
    panel_dir.mkdir(parents=True)
    (panel_dir / "panel_01.png").write_bytes(b"panel-one")
    (panel_dir / "panel_02.png").write_bytes(b"panel-two")
    monkeypatch.setattr(settings, "COMIC_DIR", comic_dir)

    response = client.get(f"/api/comics/{chapter_id}/export")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/zip")
    with ZipFile(BytesIO(response.content)) as archive:
        assert archive.namelist() == ["panel_01.png", "panel_02.png"]
        assert archive.read("panel_02.png") == b"panel-two"


def test_partial_comic_generation_is_reported_as_error(tmp_path, monkeypatch, isolated_database):
    db = isolated_database()
    novel = Novel(title="Partial test", content="A story")
    db.add(novel)
    db.flush()
    chapter = Chapter(novel_id=novel.id, chapter_number=1, title="Chapter 1", content="A scene")
    db.add(chapter)
    db.commit()
    chapter_id = chapter.id
    db.close()

    monkeypatch.setattr(settings, "COMIC_DIR", tmp_path / "comics")
    db = isolated_database()
    service = ComicService(db)

    async def fake_script(*args, **kwargs):
        return [{"scene": "first"}, {"scene": "second"}]

    async def partial_generator(panels, requested_chapter_id, **kwargs):
        return [f"comics/{requested_chapter_id}/panel_01.png", None]

    service.script_agent.generate_script = fake_script
    service.generator_agent.generate_comic = partial_generator

    try:
        result = asyncio.run(service.generate_chapter_comic(chapter_id, style_id="daily"))
        assert result.comic_status == "error"
        assert result.comic_images == [f"comics/{chapter_id}/panel_01.png"]
    finally:
        db.close()


def test_error_status_is_not_recovered_from_old_disk_panels(tmp_path, monkeypatch, isolated_database):
    db = isolated_database()
    novel = Novel(title="Retry test", content="A story")
    db.add(novel)
    db.flush()
    chapter = Chapter(
        novel_id=novel.id,
        chapter_number=1,
        title="Chapter 1",
        content="A scene",
        comic_status="error",
        comic_images=[],
    )
    db.add(chapter)
    db.commit()
    chapter_id = chapter.id
    db.close()

    comic_dir = tmp_path / "comics"
    chapter_dir = comic_dir / chapter_id
    chapter_dir.mkdir(parents=True)
    (chapter_dir / "panel_01.png").write_bytes(b"stale panel")
    monkeypatch.setattr(settings, "COMIC_DIR", comic_dir)

    db = isolated_database()
    try:
        status = ComicService(db).get_chapter_status(chapter_id)
        assert status["status"] == "error"
        assert status["images"] == []
    finally:
        db.close()


def test_force_regeneration_does_not_recover_old_panels_midflight(tmp_path, monkeypatch, isolated_database):
    comic_dir = tmp_path / "comics"
    monkeypatch.setattr(settings, "COMIC_DIR", comic_dir)
    db = isolated_database()
    novel = Novel(title="Regenerate test", content="A story")
    db.add(novel)
    db.flush()
    chapter = Chapter(
        novel_id=novel.id,
        chapter_number=1,
        title="Chapter 1",
        content="A new scene",
        comic_status="completed",
        comic_images=[f"comics/{novel.id}/panel_01.png"],
    )
    db.add(chapter)
    db.commit()
    chapter_id = chapter.id
    db.close()

    chapter_dir = comic_dir / chapter_id
    chapter_dir.mkdir(parents=True)
    (chapter_dir / "panel_01.png").write_bytes(b"old result")

    db = isolated_database()
    service = ComicService(db)
    statuses_seen_during_generation = []

    async def fake_script(*args, **kwargs):
        return [{"scene": "new panel"}]

    async def fake_generator(panels, requested_chapter_id, **kwargs):
        panel = comic_dir / requested_chapter_id / "panel_01.png"
        panel.parent.mkdir(parents=True, exist_ok=True)
        panel.write_bytes(b"new panel before progress callback")
        statuses_seen_during_generation.append(service.get_chapter_status(requested_chapter_id))
        return [f"comics/{requested_chapter_id}/panel_01.png"]

    service.script_agent.generate_script = fake_script
    service.generator_agent.generate_comic = fake_generator

    try:
        result = asyncio.run(service.generate_chapter_comic(chapter_id, style_id="daily", force=True))
        assert statuses_seen_during_generation == [{
            "chapter_id": chapter_id,
            "status": "generating",
            "images": [],
        }]
        assert result.comic_status == "completed"
    finally:
        db.close()


def test_panel_cleanup_rejects_chapter_ids_that_escape_the_chapter_root(tmp_path, monkeypatch, isolated_database):
    comic_dir = tmp_path / "comics"
    other_chapter = comic_dir / "other"
    other_chapter.mkdir(parents=True)
    panel = other_chapter / "panel_01.png"
    panel.write_bytes(b"belongs to another chapter")
    monkeypatch.setattr(settings, "COMIC_DIR", comic_dir)
    db = isolated_database()

    try:
        with pytest.raises(ValueError, match="Invalid chapter id"):
            ComicService(db)._clear_panel_files("../comics/other")
        assert panel.exists()
    finally:
        db.close()


def test_interrupted_generation_with_disk_images_is_error_not_completed(tmp_path, monkeypatch, isolated_database):
    comic_dir = tmp_path / "comics"
    monkeypatch.setattr(settings, "COMIC_DIR", comic_dir)
    db = isolated_database()
    novel = Novel(title="Interrupted test", content="A story")
    db.add(novel)
    db.flush()
    chapter = Chapter(
        novel_id=novel.id,
        chapter_number=1,
        title="Chapter 1",
        content="A scene",
        comic_status="generating",
        comic_images=[],
    )
    db.add(chapter)
    db.commit()
    chapter_id = chapter.id
    db.close()

    chapter_dir = comic_dir / chapter_id
    chapter_dir.mkdir(parents=True)
    (chapter_dir / "panel_01.png").write_bytes(b"partial panel")

    db = isolated_database()
    try:
        status = ComicService(db).get_chapter_status(chapter_id)
        assert status == {
            "chapter_id": chapter_id,
            "status": "error",
            "images": [f"comics/{chapter_id}/panel_01.png"],
        }
    finally:
        db.close()


def test_interrupted_generation_without_outputs_becomes_retryable_error(isolated_database):
    db = isolated_database()
    novel = Novel(title="Empty interruption", content="A story")
    db.add(novel)
    db.flush()
    chapter = Chapter(
        novel_id=novel.id,
        chapter_number=1,
        title="Chapter 1",
        content="A scene",
        comic_status="generating",
        comic_images=[],
    )
    db.add(chapter)
    db.commit()
    chapter_id = chapter.id

    try:
        status = ComicService(db).get_chapter_status(chapter_id)
        assert status["status"] == "error"
        assert status["images"] == []
    finally:
        db.close()


def test_failed_force_regeneration_restores_previous_completed_comic(tmp_path, monkeypatch, isolated_database):
    comic_dir = tmp_path / "comics"
    monkeypatch.setattr(settings, "COMIC_DIR", comic_dir)
    db = isolated_database()
    novel = Novel(title="Keep previous", content="A story")
    db.add(novel)
    db.flush()
    chapter = Chapter(
        novel_id=novel.id,
        chapter_number=1,
        title="Chapter 1",
        content="A replacement scene",
        comic_status="completed",
        comic_images=[],
    )
    db.add(chapter)
    db.flush()
    chapter_id = chapter.id
    previous_paths = [
        f"comics/{chapter_id}/panel_01.png",
        f"comics/{chapter_id}/panel_02.png",
    ]
    chapter.comic_images = previous_paths
    db.add_all([
        ComicPanel(chapter_id=chapter_id, panel_index=1, script="old first", image_path=previous_paths[0]),
        ComicPanel(chapter_id=chapter_id, panel_index=2, script="old second", image_path=previous_paths[1]),
    ])
    db.commit()
    db.close()

    chapter_dir = comic_dir / chapter_id
    chapter_dir.mkdir(parents=True)
    (chapter_dir / "panel_01.png").write_bytes(b"previous panel one")
    (chapter_dir / "panel_02.png").write_bytes(b"previous panel two")

    db = isolated_database()
    service = ComicService(db)

    async def fake_script(*args, **kwargs):
        return [{"scene": "replacement"}]

    async def failed_generator(*args, **kwargs):
        (chapter_dir / "panel_01.png").write_bytes(b"failed replacement")
        raise RuntimeError("image service unavailable")

    service.script_agent.generate_script = fake_script
    service.generator_agent.generate_comic = failed_generator

    try:
        result = asyncio.run(service.generate_chapter_comic(chapter_id, style_id="daily", force=True))
        assert result.comic_status == "error"
        assert result.comic_images == previous_paths
        assert (chapter_dir / "panel_01.png").read_bytes() == b"previous panel one"
        assert (chapter_dir / "panel_02.png").read_bytes() == b"previous panel two"
        panels = db.query(ComicPanel).filter(ComicPanel.chapter_id == chapter_id).order_by(ComicPanel.panel_index).all()
        assert [panel.script for panel in panels] == ["old first", "old second"]
    finally:
        db.close()


def test_restart_during_force_regeneration_restores_backup_and_marks_error(tmp_path, monkeypatch, isolated_database):
    comic_dir = tmp_path / "comics"
    monkeypatch.setattr(settings, "COMIC_DIR", comic_dir)
    db = isolated_database()
    novel = Novel(title="Restart recovery", content="A story")
    db.add(novel)
    db.flush()
    chapter = Chapter(
        novel_id=novel.id,
        chapter_number=1,
        title="Chapter 1",
        content="A scene",
        comic_status="generating",
        comic_images=[f"comics/{novel.id}/panel_01.png"],
    )
    db.add(chapter)
    db.commit()
    chapter_id = chapter.id
    db.close()

    chapter_dir = comic_dir / chapter_id
    backup_dir = chapter_dir / ".backup-interrupted"
    backup_dir.mkdir(parents=True)
    (backup_dir / "panel_01.png").write_bytes(b"previous panel one")
    (backup_dir / "panel_02.png").write_bytes(b"previous panel two")
    (chapter_dir / "panel_01.png").write_bytes(b"partial replacement")

    db = isolated_database()
    try:
        status = ComicService(db).get_chapter_status(chapter_id)
        assert status == {
            "chapter_id": chapter_id,
            "status": "error",
            "images": [
                f"comics/{chapter_id}/panel_01.png",
                f"comics/{chapter_id}/panel_02.png",
            ],
        }
        assert (chapter_dir / "panel_01.png").read_bytes() == b"previous panel one"
        assert (chapter_dir / "panel_02.png").read_bytes() == b"previous panel two"
        assert not backup_dir.exists()
    finally:
        db.close()


def test_successful_shorter_regeneration_removes_old_trailing_panels(tmp_path, monkeypatch, isolated_database):
    comic_dir = tmp_path / "comics"
    monkeypatch.setattr(settings, "COMIC_DIR", comic_dir)
    db = isolated_database()
    novel = Novel(title="Shorter regeneration", content="A story")
    db.add(novel)
    db.flush()
    chapter = Chapter(
        novel_id=novel.id,
        chapter_number=1,
        title="Chapter 1",
        content="A shorter replacement",
        comic_status="completed",
        comic_images=[],
    )
    db.add(chapter)
    db.commit()
    chapter_id = chapter.id
    db.close()

    chapter_dir = comic_dir / chapter_id
    chapter_dir.mkdir(parents=True)
    (chapter_dir / "panel_01.png").write_bytes(b"old panel one")
    (chapter_dir / "panel_02.png").write_bytes(b"old panel two")

    db = isolated_database()
    service = ComicService(db)

    async def fake_script(*args, **kwargs):
        return [{"scene": "only new panel"}]

    async def successful_generator(*args, **kwargs):
        (chapter_dir / "panel_01.png").write_bytes(b"new panel one")
        return [f"comics/{chapter_id}/panel_01.png"]

    service.script_agent.generate_script = fake_script
    service.generator_agent.generate_comic = successful_generator

    try:
        result = asyncio.run(service.generate_chapter_comic(chapter_id, style_id="daily", force=True))
        assert result.comic_status == "completed"
        assert result.comic_images == [f"comics/{chapter_id}/panel_01.png"]
        assert [Path(path).name for path in chapter_panel_files(chapter_id, comic_dir)] == ["panel_01.png"]
        assert (chapter_dir / "panel_01.png").read_bytes() == b"new panel one"
    finally:
        db.close()
