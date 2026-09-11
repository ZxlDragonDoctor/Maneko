from app.agents.novel_parser import split_chapters_locally
from app.agents.comic_script import split_script_locally


def test_split_chapters_by_chinese_headers():
    content = """第一章 初遇

小明遇见了小红。

第二章 离别

小红离开了。"""
    chapters = split_chapters_locally(content)
    assert len(chapters) == 2
    assert "初遇" in chapters[0]["title"]
    assert "小明" in chapters[0]["content"]
    assert "离别" in chapters[1]["title"]


def test_split_chapters_markdown_and_no_headers():
    md = "# 标题\n\n正文A。\n\n## 小节\n\n正文B。"
    chapters = split_chapters_locally(md)
    assert len(chapters) >= 1
    assert any("正文" in ch["content"] for ch in chapters)

    plain = "只有正文，没有章节标记。"
    single = split_chapters_locally(plain)
    assert len(single) == 1
    assert "只有正文" in single[0]["content"]


def test_split_script_locally():
    content = "小明站在山顶。眺望远方城市。风吹过发梢。他决定出发。"
    panels = split_script_locally(content, max_panels=3)
    assert 1 <= len(panels) <= 3
    assert "scene" in panels[0]
    assert panels[0]["scene"]
