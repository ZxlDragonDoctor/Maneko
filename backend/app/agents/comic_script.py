import json
import re
from typing import List, Dict, Optional

from agentscope.agent import Agent
from agentscope.model import DashScopeChatModel
from agentscope.credential import DashScopeCredential
from agentscope.message import UserMsg
from app.agents.comic_style import (
    STYLE_PRESETS,
    get_style,
    resolve_style_id,
    style_script_system_prompt,
)
from app.config import settings


def split_script_locally(
    content: str,
    max_panels: int = 4,
    style_id: Optional[str] = None,
    title: str = "",
) -> List[Dict]:
    """Build simple panels when AI script generation is unavailable."""
    resolved = resolve_style_id(style_id, content, title)
    notes = STYLE_PRESETS[resolved]["script_zh"]

    text = (content or "").strip()
    if not text:
        return [{
            "scene": "与小说风格相符的空镜",
            "characters": [],
            "action": "空镜",
            "dialogue": "",
            "mood": "静谧",
            "style_notes": notes,
        }]

    sentences = [
        s.strip()
        for s in re.split(r"(?<=[。！？!?\n])", text)
        if s and s.strip()
    ]
    if not sentences:
        sentences = [text[:200]]

    chunk_size = max(1, (len(sentences) + max_panels - 1) // max_panels)
    panels = []
    for i in range(0, len(sentences), max(chunk_size, 1)):
        scene = "".join(sentences[i:i + chunk_size])[:180]
        panels.append({
            "scene": scene,
            "characters": [],
            "action": "叙述场景",
            "dialogue": "",
            "mood": "平静",
            "style_notes": notes,
        })
        if len(panels) >= max_panels:
            break
    return panels or [{
        "scene": text[:180],
        "characters": [],
        "action": "叙述场景",
        "dialogue": "",
        "mood": "平静",
        "style_notes": notes,
    }]


class ComicScriptAgent:
    def __init__(self):
        self._agent = None
        self._agent_style_key = None

    def _ensure_agent(self, system_prompt: str, style_key: str):
        if self._agent is not None and self._agent_style_key == style_key:
            return
        self._agent = Agent(
            name="ComicScript",
            system_prompt=system_prompt,
            model=DashScopeChatModel(
                credential=DashScopeCredential(api_key=settings.DASHSCOPE_API_KEY),
                model=settings.QWEN_MODEL,
            ),
        )
        self._agent_style_key = style_key

    async def generate_script(
        self,
        content: str,
        style: Optional[str] = None,
        title: str = "",
    ) -> List[Dict]:
        """生成分镜脚本。style 为预设 id 或 auto。"""
        resolved = resolve_style_id(style, content, title)
        meta = get_style(resolved)

        if not settings.DASHSCOPE_API_KEY or settings.DASHSCOPE_API_KEY.startswith("your-"):
            return split_script_locally(content, style_id=resolved, title=title)

        system_prompt = style_script_system_prompt(resolved, content, title)
        self._ensure_agent(system_prompt, resolved)

        style_guide = f"""当前风格：{meta['label']}（{resolved}）
{meta['script_zh']}"""

        prompt = f"""请将以下小说章节内容转化为漫画分镜脚本。

{style_guide}

小说标题：{title or '（无）'}

小说内容：
{content}

请返回JSON格式的分镜列表，每个分镜包含scene、characters、action、dialogue、mood、style_notes字段。只返回JSON，不要其他内容。"""

        try:
            import asyncio

            user_msg = UserMsg(name="user", content=prompt)
            reply = await asyncio.wait_for(self._agent.reply(user_msg), timeout=60)
            text = reply.get_text_content()

            start = text.find('[')
            end = text.rfind(']') + 1
            if start != -1 and end != 0:
                panels = json.loads(text[start:end])
                if isinstance(panels, list) and panels:
                    return panels
        except Exception as e:
            print(f"ComicScript AI failed, fallback local split: {e}")

        return split_script_locally(content, style_id=resolved, title=title)
