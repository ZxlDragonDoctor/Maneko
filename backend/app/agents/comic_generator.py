import asyncio
from typing import Awaitable, Callable, Dict, List, Optional

from app.agents.comic_style import build_negative_prompt, build_panel_prompt
from app.agents.image_providers import ImageProvider, create_image_provider
from app.config import settings


class ComicGeneratorAgent:
    def __init__(self, provider: Optional[ImageProvider] = None):
        self.provider = provider or create_image_provider()

    def _build_prompt(
        self,
        panel: Dict,
        style_id: Optional[str] = None,
        novel_content: str = "",
        novel_title: str = "",
    ) -> str:
        return build_panel_prompt(panel, style_id, novel_content, novel_title)

    async def generate_comic(
        self,
        panels: List[Dict],
        chapter_id: str,
        style_id: Optional[str] = None,
        novel_content: str = "",
        novel_title: str = "",
        on_panel: Optional[Callable[[int, Optional[str]], Awaitable[None]]] = None,
    ) -> List[Optional[str]]:
        chapter_dir = settings.COMIC_DIR / chapter_id
        chapter_dir.mkdir(parents=True, exist_ok=True)

        # apply genre negative prompt when provider supports it
        neg = build_negative_prompt(style_id, settings.QWEN_IMAGE_NEGATIVE_PROMPT)
        if hasattr(self.provider, "negative_prompt") and neg:
            self.provider.negative_prompt = neg

        image_paths: List[Optional[str]] = []
        for i, panel in enumerate(panels):
            try:
                prompt = self._build_prompt(panel, style_id, novel_content, novel_title)
                image_path = chapter_dir / f"panel_{i + 1:02d}.png"
                result = await self.provider.generate_image(prompt, image_path)
                image_paths.append(result)
            except Exception as e:
                print(f"生成分镜{i + 1}异常: {e}")
                image_paths.append(None)

            if on_panel is not None:
                try:
                    await on_panel(i, image_paths[-1])
                except Exception as e:
                    print(f"on_panel callback failed: {e}")

            if self.provider.name != "mock":
                await asyncio.sleep(1)

        return image_paths

    def save_comic_paths(self, chapter_id: str, image_paths: List[str]) -> str:
        import json

        paths_file = settings.COMIC_DIR / chapter_id / "paths.json"
        with open(paths_file, "w", encoding="utf-8") as f:
            json.dump(image_paths, f, ensure_ascii=False, indent=2)
        return str(paths_file)
