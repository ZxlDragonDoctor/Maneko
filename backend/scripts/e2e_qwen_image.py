"""End-to-end smoke: DashScope text + qwen-image-3.0 panel generation."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.agents.image_providers import create_image_provider
from app.agents.comic_script import ComicScriptAgent
from app.agents.comic_generator import ComicGeneratorAgent


async def main() -> int:
    print("provider=", settings.IMAGE_PROVIDER)
    print("model=", settings.QWEN_IMAGE_MODEL, "mode=", settings.QWEN_IMAGE_MODE)
    print("key_ok=", bool(settings.DASHSCOPE_API_KEY) and not settings.DASHSCOPE_API_KEY.startswith("your-"))

    provider = create_image_provider()
    print("active_provider=", type(provider).__name__, provider.name)

    content = "少年站在山顶，眺望霓虹城市夜景，决定出发寻找失踪的妹妹。风吹起衣角。"
    print("--- comic script ---")
    script = ComicScriptAgent()
    panels = await script.generate_script(content, style="mystery", title="测试章节")
    print("panels=", len(panels))
    if panels:
        print("panel0 keys=", list(panels[0].keys()))
        print("scene=", (panels[0].get("scene") or "")[:80])

    out_dir = Path(settings.COMIC_DIR) / "e2e_qwen_test"
    out_dir.mkdir(parents=True, exist_ok=True)
    # temporarily point COMIC_DIR via generator
    gen = ComicGeneratorAgent(provider=provider)
    print("--- image gen (1 panel) ---")
    paths = await gen.generate_comic(
        panels[:1] or [{"scene": content, "style_notes": "悬疑霓虹", "mood": "紧张"}],
        "e2e_qwen_test",
        style_id="mystery",
        novel_content=content,
        novel_title="测试章节",
    )
    print("paths=", paths)
    for p in paths:
        if p:
            fp = Path(p)
            print("file=", fp, "size=", fp.stat().st_size if fp.exists() else None)
    ok = any(paths) and paths[0] and Path(paths[0]).exists() and Path(paths[0]).stat().st_size > 1000
    print("RESULT=", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
