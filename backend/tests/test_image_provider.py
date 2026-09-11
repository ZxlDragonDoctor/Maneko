import asyncio
from pathlib import Path

import pytest

from app.agents.comic_generator import ComicGeneratorAgent
from app.agents.image_providers import (
    MimoImageProvider,
    MockImageProvider,
    create_image_provider,
)


def test_create_provider_default_mock():
    provider = create_image_provider("mock")
    assert provider.name == "mock"


def test_create_provider_mimo():
    provider = create_image_provider("mimo")
    assert isinstance(provider, MimoImageProvider)
    assert provider.name == "mimo"


def test_create_provider_unknown():
    with pytest.raises(ValueError):
        create_image_provider("not-a-provider")


@pytest.mark.asyncio
async def test_mock_provider_writes_png(tmp_path: Path):
    provider = MockImageProvider()
    out = tmp_path / "panel.png"
    result = await provider.generate_image("manga panel: hero on cliff", out)
    assert result == str(out)
    assert out.exists()
    assert out.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"


@pytest.mark.asyncio
async def test_comic_generator_uses_provider(tmp_path: Path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "COMIC_DIR", tmp_path)
    agent = ComicGeneratorAgent(provider=MockImageProvider())
    panels = [
        {
            "scene": "山顶远眺",
            "characters": ["小明"],
            "action": "站立",
            "dialogue": "",
            "mood": "平静",
            "style_notes": "日漫",
        },
        {
            "scene": "城市夜景",
            "characters": [],
            "action": "俯瞰",
            "dialogue": "",
            "mood": "紧张",
            "style_notes": "速度线",
        },
    ]
    paths = await agent.generate_comic(panels, "chapter_test_1")
    assert len(paths) == 2
    assert all(p is not None for p in paths)
    for p in paths:
        assert Path(p).exists()
        assert Path(p).read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"

    saved = agent.save_comic_paths("chapter_test_1", paths)
    assert Path(saved).exists()


def test_mimo_endpoint_join():
    provider = MimoImageProvider()
    # base ends with /v1 → join /images/generations
    assert provider._endpoint().endswith("/images/generations")
    provider.base_url = "https://api.example.com/v1/images/generations"
    assert provider._endpoint() == "https://api.example.com/v1/images/generations"
