# tests/test_agents.py
import pytest
import asyncio
from app.agents.novel_parser import NovelParserAgent
from app.agents.comic_script import ComicScriptAgent

@pytest.mark.asyncio
async def test_novel_parser():
    agent = NovelParserAgent()
    content = """第一章 测试
    
    这是测试内容。

第二章 验证
    
    验证通过。"""
    
    chapters = await agent.parse_novel(content)
    assert len(chapters) >= 1
    assert "title" in chapters[0]
    assert "content" in chapters[0]

@pytest.mark.asyncio
async def test_comic_script():
    agent = ComicScriptAgent()
    content = "小明站在山顶，眺望远方的城市。"
    
    panels = await agent.generate_script(content)
    assert len(panels) >= 1
    assert "scene" in panels[0]