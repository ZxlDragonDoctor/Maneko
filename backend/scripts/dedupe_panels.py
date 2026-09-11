import json
import sqlite3
from pathlib import Path

ch_id = "308ece7d-4ee6-4e46-8e3c-0190d021bfba"
conn = sqlite3.connect(Path(__file__).resolve().parents[1] / "novels.db")
conn.row_factory = sqlite3.Row
rows = conn.execute(
    "SELECT id, panel_index FROM comic_panels WHERE chapter_id=? ORDER BY panel_index, rowid",
    (ch_id,),
).fetchall()
print("before", len(rows))
seen = set()
delete_ids = []
for r in rows:
    if r["panel_index"] in seen:
        delete_ids.append(r["id"])
    else:
        seen.add(r["panel_index"])
for i in delete_ids:
    conn.execute("DELETE FROM comic_panels WHERE id=?", (i,))
imgs = [f"comics\\{ch_id}\\panel_{i:02d}.png" for i in range(1, 5)]
conn.execute(
    "UPDATE chapters SET comic_status=?, comic_images=? WHERE id=?",
    ("completed", json.dumps(imgs), ch_id),
)
conn.commit()
rows = conn.execute(
    "SELECT panel_index FROM comic_panels WHERE chapter_id=? ORDER BY panel_index",
    (ch_id,),
).fetchall()
print("after panels", [r["panel_index"] for r in rows])
conn.close()
