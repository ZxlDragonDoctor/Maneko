from app.agents.comic_generator import ComicGeneratorAgent
from app.agents.comic_style import (
    STYLE_PRESETS,
    build_panel_prompt,
    detect_genre_id,
    list_styles,
    resolve_style_id,
)
from app.agents.image_providers import MockImageProvider


def test_list_styles_includes_core_genres():
    ids = {s["id"] for s in list_styles()}
    for expected in (
        "auto", "xianxia", "wuxia", "scifi", "mystery",
        "romance", "fantasy", "daily", "neon-tokyo",
    ):
        assert expected in ids


def test_detect_xianxia_keywords():
    content = "少年服下筑基丹，金丹已成，宗门长老命他御剑飞升。"
    assert detect_genre_id(content) == "xianxia"


def test_detect_scifi_keywords():
    content = "星舰跃迁失败，机甲部队在外星基地遭遇人工智能叛乱。"
    assert detect_genre_id(content) == "scifi"


def test_detect_mystery_keywords():
    content = "密室里的尸体，侦探根据线索推理凶手身份。"
    assert detect_genre_id(content) == "mystery"


def test_resolve_auto_and_unknown():
    content = "江湖侠客在客栈拔剑。"
    assert resolve_style_id("auto", content) == "wuxia"
    assert resolve_style_id("not-exist", content) == "wuxia"
    assert resolve_style_id("scifi", content) == "scifi"


def test_build_panel_prompt_uses_genre_not_always_neon():
    p = build_panel_prompt(
        {"scene": "御剑飞行", "characters": ["修士"], "mood": "壮阔"},
        style_id="xianxia",
    )
    assert "xianxia" in p.lower() or "cultivation" in p.lower()
    assert "Neon Tokyo" not in p
    assert "Scene: 御剑飞行" in p


def test_generator_accepts_style_id(tmp_path, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "COMIC_DIR", tmp_path)
    agent = ComicGeneratorAgent(provider=MockImageProvider())
    panels = [{"scene": "测试", "style_notes": STYLE_PRESETS["scifi"]["script_zh"]}]
    # async run
    import asyncio
    paths = asyncio.run(agent.generate_comic(panels, "ch1", style_id="scifi"))
    assert paths and paths[0]
