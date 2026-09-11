"""Integration: MimoImageProvider against local mock HTTP image API."""
import asyncio
import os
import sys
import time
from pathlib import Path

# Ensure app package imports when run as script from backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agents.image_providers import MimoImageProvider
from app.config import settings


async def main() -> int:
    settings.MIMO_IMAGE_BASE_URL = os.environ.get(
        "MIMO_IMAGE_BASE_URL", "http://127.0.0.1:18081/v1"
    )
    settings.MIMO_IMAGE_API_KEY = os.environ.get("MIMO_IMAGE_API_KEY", "local-test")
    settings.MIMO_IMAGE_MODEL = os.environ.get("MIMO_IMAGE_MODEL", "mimo-image")

    provider = MimoImageProvider()
    out_dir = Path(os.environ.get("COMIC_DIR", "comics")) / "mimo_http_demo"
    out_dir.mkdir(parents=True, exist_ok=True)

    panels = [
        {
            "scene": "少年站在悬崖边眺望远方的霓虹城市",
            "characters": ["小明"],
            "action": "迎风而立",
            "mood": "壮阔",
            "style_notes": "日漫大眼睛，逆光剪影",
        },
        {
            "scene": "少女回头，泪水在眼眶打转",
            "characters": ["小红"],
            "action": "回首",
            "mood": "离别",
            "style_notes": "细腻光影，速度线背景",
        },
        {
            "scene": "两人在雨中奔跑，街道灯影拉长",
            "characters": ["小明", "小红"],
            "action": "奔跑",
            "mood": "紧迫",
            "style_notes": "动态构图",
        },
    ]

    for i, panel in enumerate(panels, 1):
        prompt = (
            f"Japanese manga style, {panel['style_notes']}. "
            f"Scene: {panel['scene']}. "
            f"Characters: {', '.join(panel['characters'])}. "
            f"Action: {panel['action']}. Mood: {panel['mood']}. "
            f"High quality manga illustration."
        )
        out = out_dir / f"panel_{i:02d}.png"
        path = await provider.generate_image(prompt, out)
        print(f"panel {i}: {path}")
        if not path:
            return 1

    print(f"OK: {len(panels)} images → {out_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
