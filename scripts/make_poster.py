"""Compose README hero poster from generated art + brand typography (Pillow 7 compatible)."""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "banner-bg.png"
OUT = ROOT / "assets" / "banner.png"

W, H = 1600, 480
PINK = (255, 20, 147)
CYAN = (0, 240, 255)
ORANGE = (255, 107, 0)


def find_font(*candidates: str) -> Optional[str]:
    roots = [
        Path("C:/Windows/Fonts"),
        Path.home() / "AppData/Local/Microsoft/Windows/Fonts",
    ]
    for name in candidates:
        for root in roots:
            p = root / name
            if p.exists():
                return str(p)
    return None


def load_font(candidates: List[str], size: int) -> ImageFont.FreeTypeFont:
    path = find_font(*candidates)
    if not path:
        raise SystemExit("font not found: %s" % candidates)
    return ImageFont.truetype(path, size)


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> Tuple[int, int]:
    if hasattr(draw, "textbbox"):
        bbox = draw.textbbox((0, 0), text, font=font)
        return bbox[2] - bbox[0], bbox[3] - bbox[1]
    return draw.textsize(text, font=font)


def main() -> None:
    art = Image.open(SRC).convert("RGBA")
    ratio = W / float(H)
    art_h = int(art.width / ratio)
    if art_h > art.height:
        art_w = int(art.height * ratio)
        left = (art.width - art_w) // 2
        art = art.crop((left, 0, left + art_w, art.height))
    else:
        top = (art.height - art_h) // 2
        art = art.crop((0, top, art.width, top + art_h))
    art = art.resize((W, H), Image.LANCZOS).convert("RGB")

    scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scrim)
    for x in range(W):
        t = x / float(W)
        if t < 0.48:
            a = int(220 * (1 - t / 0.48) ** 0.7)
        elif t < 0.62:
            a = int(70 * (1 - (t - 0.48) / 0.14))
        else:
            a = int(30 * ((t - 0.62) / 0.38))
        sd.line([(x, 0), (x, H)], fill=(8, 6, 22, a))
    for y in range(H):
        a = int(90 * (y / float(H)) ** 1.6)
        sd.line([(0, y), (W, y)], fill=(8, 6, 22, a))

    base = Image.alpha_composite(art.convert("RGBA"), scrim)

    title_font = load_font(
        ["seguisb.ttf", "segoeuib.ttf", "arialbd.ttf", "msyhbd.ttc", "arial.ttf"],
        96,
    )
    cjk = ["msyh.ttc", "msyh.ttf", "msyhl.ttc", "simhei.ttf", "segoeui.ttf", "arial.ttf"]
    sub_font = load_font(cjk, 32)
    tag_font = load_font(cjk, 26)
    meta_font = load_font(["consola.ttf", "segoeui.ttf", "arial.ttf"], 20)

    # Soft plate behind brand text for readability
    plate = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    pd.rectangle([48, 88, 620, 390], fill=(6, 4, 20, 150))
    plate = plate.filter(ImageFilter.GaussianBlur(6))
    base = Image.alpha_composite(base, plate)

    frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rectangle([8, 8, W - 9, H - 9], outline=PINK + (210,), width=3)
    fd.rectangle([16, 16, W - 17, H - 17], outline=CYAN + (90,), width=1)
    base = Image.alpha_composite(base, frame)

    title = "Maneko"
    x, y = 72, 108
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.text((x, y), title, font=title_font, fill=PINK + (160,))
    gd.text((x + 2, y), title, font=title_font, fill=CYAN + (120,))
    glow = glow.filter(ImageFilter.GaussianBlur(8))
    base = Image.alpha_composite(base, glow)
    draw = ImageDraw.Draw(base)
    draw.text((x, y), title, font=title_font, fill=(255, 255, 255, 255))
    draw.text((x + 1, y + 1), title, font=title_font, fill=PINK + (70,))

    draw.text((78, 220), "漫猫 · Novel → Manga Panels", font=sub_font, fill=CYAN + (255,))
    draw.text((78, 268), "把纯文本小说，变成日漫风分镜漫画", font=tag_font, fill=(235, 235, 245, 255))

    chips = [
        ("AgentScope", PINK),
        ("FastAPI", CYAN),
        ("React 19", ORANGE),
        ("MIT", (180, 180, 200)),
    ]
    cx, cy = 78, 330
    for label, color in chips:
        tw, th = text_size(draw, label, meta_font)
        pad_x, pad_y = 14, 10
        box = [cx, cy, cx + tw + pad_x * 2, cy + th + pad_y * 2]
        draw.rectangle(box, fill=(10, 8, 28, 170), outline=color + (230,), width=1)
        draw.text((cx + pad_x, cy + pad_y - 2), label, font=meta_font, fill=color + (255,))
        cx += tw + pad_x * 2 + 12

    caption = "AI Comic Agent Pipeline"
    tw, _ = text_size(draw, caption, meta_font)
    draw.text((W - 72 - tw, 360), caption, font=meta_font, fill=(200, 200, 220, 190))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(str(OUT), "PNG", optimize=True)
    print("wrote %s %s" % (OUT, base.size))


if __name__ == "__main__":
    main()
