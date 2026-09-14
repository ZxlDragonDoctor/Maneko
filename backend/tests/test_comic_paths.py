from pathlib import Path

from app.utils.comic_paths import (
    chapter_panel_files,
    normalize_paths,
    to_public_comic_path,
)


def test_to_public_comic_path_normalizes_backslash():
    p = to_public_comic_path(r"comics\abc\panel_01.png")
    assert p == "comics/abc/panel_01.png"


def test_to_public_comic_path_from_absolute():
    p = to_public_comic_path(r"D:\proj\comics\abc\panel_02.png")
    assert p == "comics/abc/panel_02.png"


def test_to_public_comic_path_none():
    assert to_public_comic_path(None) is None
    assert to_public_comic_path("") is None


def test_normalize_paths_filters_empty():
    assert normalize_paths([None, "", r"comics\x\panel_01.png"]) == [
        "comics/x/panel_01.png"
    ]


def test_chapter_panel_files(tmp_path):
    ch = tmp_path / "ch1"
    ch.mkdir()
    (ch / "panel_02.png").write_bytes(b"x")
    (ch / "panel_01.png").write_bytes(b"x")
    files = chapter_panel_files("ch1", tmp_path)
    assert files == ["comics/ch1/panel_01.png", "comics/ch1/panel_02.png"]
