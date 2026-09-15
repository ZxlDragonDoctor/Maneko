from PIL import Image, ImageDraw, ImageFilter
import os
import shutil

src = r"D:\idea_java_project\Agent\agent-scope-dev\assets\mascot-neko-clean.png"
im = Image.open(src).convert("RGBA")
W, H = im.size
print("mascot", W, H)

# Face + ears composition (from visual inspection of 1024x1024):
# ears top ~55, chin ~520, face width ~280-720
# Square crop that includes both ears and face with a little shoulder
# Center face ~ (500, 300); want square ~ 560
cx, cy, half = 500, 310, 300
box = (cx - half, cy - half, cx + half, cy + half)
# clamp
box = (max(0, box[0]), max(0, box[1]), min(W, box[2]), min(H, box[3]))
icon = im.crop(box).resize((512, 512), Image.LANCZOS)

# Soft dark vignette / rounded-app mask for store-style icon
size = 512
# Keep full square for android launcher; also make a rounded version for preview
out_dir = r"D:\idea_java_project\Agent\agent-scope-dev\assets\icons"
os.makedirs(out_dir, exist_ok=True)

icon_sq = icon.copy()
icon_sq.save(os.path.join(out_dir, "app-icon-512.png"), "PNG", optimize=True)

# favicon sizes
for s in (16, 32, 48, 64, 128, 256):
    icon_sq.resize((s, s), Image.LANCZOS).save(
        os.path.join(out_dir, f"favicon-{s}.png"), "PNG", optimize=True
    )

# Web favicon: 64 is enough, also write ico-compatible png
icon_sq.resize((64, 64), Image.LANCZOS).save(
    r"D:\idea_java_project\Agent\agent-scope-dev\frontend\public\favicon.png",
    "PNG",
    optimize=True,
)

# maneko-app / android-app: square icon.png
for dest_dir in [
    r"D:\idea_java_project\Agent\agent-scope-dev\maneko-app",
    r"D:\idea_java_project\Agent\agent-scope-dev\android-app",
]:
    icon_sq.save(os.path.join(dest_dir, "icon.png"), "PNG", optimize=True)
    # keep svg as fallback but also drop png next to it
    print("wrote", dest_dir)

# Frontend: also keep a high-res brand icon
icon_sq.save(
    r"D:\idea_java_project\Agent\agent-scope-dev\frontend\public\icon-512.png",
    "PNG",
    optimize=True,
)

print("done crop box", box)
