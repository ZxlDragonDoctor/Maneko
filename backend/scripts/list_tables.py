import sqlite3
from pathlib import Path

conn = sqlite3.connect(Path(__file__).resolve().parents[1] / "novels.db")
print(conn.execute("select name from sqlite_master where type='table'").fetchall())
for t in ("chapters", "comic_panels", "novels"):
    try:
        print(t, conn.execute(f"select count(*) from {t}").fetchone())
    except Exception as e:
        print(t, e)
conn.close()
