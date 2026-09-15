from PIL import Image, ImageFilter, ImageDraw
import os
import shutil

src = r"D:\idea_java_project\Agent\agent-scope-dev\assets\mascot-neko-clean.png"
im = Image.open(src).convert("RGBA")

# Final hard cover of any remaining watermark ghost in bottom-right.
# Character's tail ends ~x=820; hoodie right edge ~x=780 at bottom.
# Safe zone to fully replace: x>=780, y>=920 is empty dark bg.
region = (770, 910, 1024, 1024)
rw, rh = region[2] - region[0], region[3] - region[1]

# Sample clean dark from left of that zone
clean = im.crop((520, 910, 520 + rw, 910 + rh)).resize((rw, rh), Image.BICUBIC)
px = clean.load()
for y in range(rh):
    for x in range(rw):
        r, g, b, a = px[x, y]
        px[x, y] = (min(r, 18), min(g, 12), min(b, 40), 255)

mask = Image.new("L", (rw, rh), 255)
d = ImageDraw.Draw(mask)
feather = 50
for i in range(feather):
    v = int(255 * i / feather)
    d.line([(i, 0), (i, rh)], fill=v)
    d.line([(0, i), (rw, i)], fill=v)
mask = mask.filter(ImageFilter.GaussianBlur(6))
im.paste(clean, (region[0], region[1]), mask)

# Absolute opaque safety rectangle over glyph area
opaque = Image.new("RGBA", (260, 100), (14, 8, 34, 255))
om = Image.new("L", (260, 100), 255)
od = ImageDraw.Draw(om)
for i in range(24):
    v = int(255 * i / 24)
    od.line([(i, 0), (i, 100)], fill=v)
    od.line([(0, i), (260, i)], fill=v)
om = om.filter(ImageFilter.GaussianBlur(5))
im.paste(opaque, (780, 930), om)

out = r"D:\idea_java_project\Agent\agent-scope-dev\assets\mascot-neko-clean.png"
im.save(out, "PNG", optimize=True)
print("saved", out)

for t in [
    r"D:\idea_java_project\Agent\agent-scope-dev\frontend\public\mascot-neko.png",
    r"D:\idea_java_project\Agent\agent-scope-dev\mascot-neko.png",
    r"D:\idea_java_project\Agent\agent-scope-dev\maneko-app\assets\mascot-neko.png",
    r"D:\idea_java_project\Agent\agent-scope-dev\android-app\mascot-neko.png",
]:
    shutil.copy2(out, t)
    print("copied", t)
