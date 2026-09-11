import json
import re
from typing import List, Dict

from agentscope.agent import Agent
from agentscope.model import DashScopeChatModel
from agentscope.credential import DashScopeCredential
from agentscope.message import UserMsg
from app.config import settings

CHAPTER_PATTERNS = [
    re.compile(r"^\s*第\s*[0-9一二三四五六七八九十百千]+\s*[章回节卷]", re.M),
    re.compile(r"^\s*Chapter\s+\d+", re.I | re.M),
    re.compile(r"^\s*#{1,3}\s+.+$", re.M),
]


def split_chapters_locally(content: str) -> List[Dict[str, str]]:
    """Regex chapter splitter used when AI parse is unavailable."""
    text = (content or "").replace("\r\n", "\n").strip()
    if not text:
        return []

    marks: List[int] = []
    for pattern in CHAPTER_PATTERNS:
        for m in pattern.finditer(text):
            marks.append(m.start())
    marks = sorted(set(marks))

    if not marks or marks[0] > 0:
        marks = [0] + [m for m in marks if m > 0]

    chapters: List[Dict[str, str]] = []
    for i, start in enumerate(marks):
        end = marks[i + 1] if i + 1 < len(marks) else len(text)
        block = text[start:end].strip()
        if not block:
            continue
        first_line = block.split("\n", 1)[0].strip()
        title = first_line[:80] if first_line else f"第{i + 1}章"
        body = block[len(first_line):].strip() if first_line else block
        if not body:
            body = block
        chapters.append({"title": title, "content": body})

    if not chapters:
        chapters = [{"title": "全文", "content": text}]
    return chapters


class NovelParserAgent:
    def __init__(self):
        self._agent = None

    @property
    def agent(self):
        if self._agent is None:
            self._agent = Agent(
                name="NovelParser",
                system_prompt="""你是一个专业的小说结构分析师。你的任务是将用户上传的小说内容智能分割成章节。

规则：
1. 识别章节标题（如"第一章"、"第X章"、"Chapter X"等格式）
2. 如果没有明确的章节标记，根据内容的情节转折点进行分段
3. 每个章节应该有清晰的标题和完整的内容
4. 返回格式为JSON数组，每个元素包含"title"和"content"字段

示例输出格式：
[
  {"title": "第一章 初遇", "content": "章节内容..."},
  {"title": "第二章 离别", "content": "章节内容..."}
]""",
                model=DashScopeChatModel(
                    credential=DashScopeCredential(
                        api_key=settings.DASHSCOPE_API_KEY,
                    ),
                    model=settings.QWEN_MODEL,
                ),
            )
        return self._agent

    async def parse_novel(self, content: str) -> List[Dict[str, str]]:
        """解析小说内容，返回章节列表。AI 失败时本地分章回退。"""
        if not settings.DASHSCOPE_API_KEY or settings.DASHSCOPE_API_KEY.startswith("your-"):
            return split_chapters_locally(content)

        prompt = f"""请分析以下小说内容，将其智能分割成章节。

小说内容：
{content}

请返回JSON格式的章节列表，包含title和content字段。只返回JSON，不要其他内容。"""

        try:
            user_msg = UserMsg(name="user", content=prompt)
            reply = await self.agent.reply(user_msg)
            text = reply.get_text_content()

            start = text.find('[')
            end = text.rfind(']') + 1
            if start != -1 and end != 0:
                chapters = json.loads(text[start:end])
                if isinstance(chapters, list) and chapters:
                    return chapters
        except Exception as e:
            print(f"NovelParser AI failed, fallback local split: {e}")

        return split_chapters_locally(content)
