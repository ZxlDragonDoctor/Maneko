import sqlite3
from pathlib import Path

ch = "308ece7d-4ee6-4e46-8e3c-0190d021bfba"
db = Path(__file__).resolve().parents[1] / "novels.db"
c = sqlite3.connect(db)
c.execute("update chapters set comic_status=?, comic_images=? where id=?", ("pending", "[]", ch))
c.execute("delete from comic_panels where chapter_id=?", (ch,))
c.commit()
print("status", c.execute("select comic_status from chapters where id=?", (ch,)).fetchone())
c.close()
print("files", list((Path(__file__).resolve().parents[1] / "comics" / ch).glob("*.png")))
