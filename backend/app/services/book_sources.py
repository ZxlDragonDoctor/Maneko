"""Free / open book source adapters for library import.

Legal note: only public-domain catalogs and user-supplied URLs.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional
from urllib.parse import quote

import httpx

TIMEOUT = 30.0
UA = "novel-comic-library/1.0"


@dataclass
class SourceBook:
    source: str
    source_ref: str
    title: str
    author: str = ""
    summary: str = ""
    cover_url: str = ""
    download_url: str = ""  # plain text preferred
    language: str = ""
    extra: Optional[Dict] = None

    def to_dict(self) -> Dict:
        d = asdict(self)
        extra = d.pop("extra", None) or {}
        if isinstance(extra, dict):
            d["copyright"] = bool(extra.get("copyright"))
            d["tags"] = list(extra.get("tags") or [])
        else:
            d["copyright"] = False
            d["tags"] = []
        d["importable"] = bool(self.download_url) and not d["copyright"]
        return d


SOURCE_REGISTRY = [
    {
        "id": "popular",
        "name": "热门小说",
        "name_en": "Popular Novels",
        "description": "龙族 / 斗罗 / 诡秘等网文索引；全文需本地导入正版文件",
        "kind": "catalog",
        "enabled": True,
    },
    {
        "id": "gutenberg",
        "name": "公版小说库",
        "name_en": "Gutenberg Fiction",
        "description": "古登堡计划·小说类公版全文（约数万册英文经典小说，可直接导入）",
        "kind": "search",
        "homepage": "https://www.gutenberg.org/",
        "enabled": True,
    },
    {
        "id": "builtin",
        "name": "公版中文小说",
        "name_en": "Chinese Classics",
        "description": "西游 / 红楼 / 三国 / 水浒 / 聊斋等公版小说节选，离线可导入",
        "kind": "catalog",
        "enabled": True,
    },
    {
        "id": "url",
        "name": "链接导入",
        "name_en": "URL Import",
        "description": "粘贴小说纯文本 / Markdown 直链导入",
        "kind": "manual",
        "enabled": True,
    },
    # 学术文献类，默认关闭（非小说产品定位）
    {
        "id": "wikisource",
        "name": "维基文库",
        "name_en": "Wikisource",
        "description": "公版文献（偏学术，非小说优先）",
        "kind": "search",
        "homepage": "https://zh.wikisource.org/",
        "enabled": False,
    },
]


# Curated public-domain Chinese/English novels (offline, no "test/demo" labels)
BUILTIN_CATALOG: List[SourceBook] = [
    SourceBook(
        source="builtin",
        source_ref="builtin-journey-west",
        title="西游记·大闹天宫",
        author="吴承恩",
        summary="美猴王出世与拜师学艺（公版节选）。",
        language="zh",
        download_url="builtin://journey-west",
        extra={"tags": ["神魔", "冒险"]},
    ),
    SourceBook(
        source="builtin",
        source_ref="builtin-red-chamber",
        title="红楼梦·黛玉进贾府",
        author="曹雪芹",
        summary="黛玉初入荣国府（公版节选）。",
        language="zh",
        download_url="builtin://red-chamber",
        extra={"tags": ["言情", "世情"]},
    ),
    SourceBook(
        source="builtin",
        source_ref="builtin-water-margin",
        title="水浒传·林教头风雪山神庙",
        author="施耐庵",
        summary="林冲雪夜上梁山（公版节选）。",
        language="zh",
        download_url="builtin://water-margin",
        extra={"tags": ["武侠", "历史"]},
    ),
    SourceBook(
        source="builtin",
        source_ref="builtin-three-kingdoms",
        title="三国演义·桃园结义",
        author="罗贯中",
        summary="刘备关羽张飞桃园结义（公版节选）。",
        language="zh",
        download_url="builtin://three-kingdoms",
        extra={"tags": ["历史", "权谋"]},
    ),
    SourceBook(
        source="builtin",
        source_ref="builtin-liaozhai",
        title="聊斋志异·聂小倩",
        author="蒲松龄",
        summary="人鬼情未了的志怪名篇（公版节选）。",
        language="zh",
        download_url="builtin://liaozhai",
        extra={"tags": ["志怪", "悬疑"]},
    ),
    SourceBook(
        source="builtin",
        source_ref="builtin-pride",
        title="傲慢与偏见（开篇）",
        author="Jane Austen",
        summary="经典爱情小说开篇（公版节选）。",
        language="zh",
        download_url="builtin://pride",
        extra={"tags": ["言情"]},
    ),
]


BUILTIN_TEXTS: Dict[str, str] = {
    "builtin://journey-west": """第一回 灵根育孕源流出 心性修持大道生

　　诗曰：混沌未分天地乱，茫茫渺渺无人见。自从盘古破鸿蒙，开辟从兹清浊辨。

　　东胜神洲，有一座名山，唤作花果山。那座山正当顶上，有一块仙石。其石有三丈六尺五寸高，有二丈四尺围圆。

　　内育仙胞，一日迸裂，产一石卵，似圆球样大。因见风，化作一个石猴，五官俱备，四肢皆全。便就学爬学走，拜了四方。

第二回 悟彻菩提真妙理 断魔归本合元源

　　美猴王为求长生，渡海寻师。得遇菩提祖师，赐名孙悟空，修习七十二般变化与筋斗云。
""",
    "builtin://red-chamber": """第三回 贾雨村夤缘复旧职 林黛玉抛父进京都

　　黛玉自那日弃舟登岸时，便有荣国府打发了轿子并拉行李的车辆久候了。

　　步步留心，时时在意，不肯轻易多说一句话，多行一步路，惟恐被人耻笑了他去。

　　一时进入正室，早有许多盛妆丽服之姬妾丫鬟迎着。贾母一见，一把搂入怀中，心肝儿肉叫着大哭起来。
""",
    "builtin://water-margin": """第十回 林教头风雪山神庙 陆虞侯火烧草料场

　　林冲自来天王堂，取了包裹，带了尖刀，拿了条花枪，与差拨一同辞了管营，两个取路投草料场来。

　　正是严冬天气，彤云密布，朔风渐起，却早纷纷扬扬卷下一天大雪来。

　　那雪正下得紧。林冲踏着碎琼乱玉，迤逦背着北风而行。
""",
    "builtin://three-kingdoms": """第一回 宴桃园豪杰三结义 斩黄巾英雄首立功

　　话说天下大势，分久必合，合久必分。周末七国分争，并入于秦；及秦灭之后，楚、汉分争，又并入于汉。

　　榜文行到涿县，引出一位英雄。那人不甚好读书，性宽和，寡言语，喜怒不形于色。素有大志，专好结交天下豪杰。姓刘，名备，字玄德。

　　玄德看榜长叹，背后一人厉声曰：“大丈夫不与国家出力，何故长叹？”其人姓张，名飞，字翼德。二人共话，又遇关羽关云长，遂于桃园结义。
""",
    "builtin://liaozhai": """卷三 聂小倩

　　宁采臣，浙人，性慷爽，廉隅自重。每对人言：“生平无二色。”

　　适赴金华，至北郭，解装兰若。寺中殿塔壮丽，然蓬蒿没人，似绝行踪。

　　夜有女郎来，颜色绝丽。采臣正容曰：“卿防物议，我畏人言。略一失足，廉耻道丧。”女退，又遗以金。采臣掷之庭，曰：“非义之物，污我囊橐！”
""",
    "builtin://pride": """Chapter 1

It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.

However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.

Mr. Bennet was among the earliest of those who waited on Mr. Bingley.
""",
}


# 热门商业网文：仅元数据索引，不含正文（版权保护）
# _popular_defs: (ref, title, author, summary, tags, aliases)
_popular_defs = [
    ("longzu", "龙族", "江南", "路明非的卡塞尔学院与龙族史诗。", ["奇幻", "青春"], ["龙族I", "龙族II", "龙族III"]),
    ("douluo", "斗罗大陆", "唐家三少", "唐三在斗罗大陆的魂师修炼之路。", ["玄幻", "热血"], []),
    ("guimi", "诡秘之主", "爱潜水的乌贼", "克莱恩在蒸汽与神秘时代的晋升之路。", ["悬疑", "奇幻"], ["诡秘"]),
    ("fanren", "凡人修仙传", "忘语", "韩立从凡人到仙人的修仙历程。", ["修仙"], ["凡人"]),
    ("qingyun", "诛仙", "萧鼎", "张小凡与青云门的仙侠传奇。", ["仙侠"], []),
    ("santi", "三体", "刘慈欣", "地球文明与三体文明的宇宙博弈。", ["科幻"], ["三体1", "地球往事"]),
    ("yinian", "一念永恒", "耳根", "白小纯的长生之路与一念成魔一念成佛。", ["修仙", "玄幻"], ["一念"]),
    ("xianjie", "仙逆", "耳根", "王林逆仙而行的修真传奇。", ["修仙", "玄幻"], ["仙逆传"]),
    ("qiuqiu", "求魔", "耳根", "苏铭求魔问道的史诗。", ["玄幻"], []),
    ("woyu", "我欲封天", "耳根", "孟浩封天之路。", ["修仙", "玄幻"], ["封天"]),
    ("zhetian", "遮天", "辰东", "九龙拉棺，叶凡的星空古路。", ["玄幻", "仙侠"], []),
    ("wanmei", "完美世界", "辰东", "石昊在完美世界的崛起。", ["玄幻"], []),
    ("shenmu", "神墓", "辰东", "辰南万年后苏醒的玄幻史诗。", ["玄幻"], []),
    ("dazhu", "大主宰", "天蚕土豆", "牧尘的大千世界主宰之路。", ["玄幻"], []),
    ("doupoc", "斗破苍穹", "天蚕土豆", "萧炎异火与斗帝之路。", ["玄幻", "热血"], ["斗破"]),
    ("wudong", "武动乾坤", "天蚕土豆", "林动的武动乾坤。", ["玄幻"], []),
    ("yuanzun", "元尊", "天蚕土豆", "周元的源气修炼。", ["玄幻"], []),
    ("tianmei", "天官赐福", "墨香铜臭", "谢怜与花城的三界传奇。", ["仙侠", "言情"], ["天官"]),
    ("modao", "魔道祖师", "墨香铜臭", "魏无羡与蓝忘机的前世今生。", ["仙侠", "言情"], ["魔道"]),
    ("renwu", "人渣反派自救系统", "墨香铜臭", "沈垣穿书自救。", ["仙侠", "穿书"], ["渣反"]),
    ("quanzhi", "全职高手", "蝴蝶蓝", "叶修重返荣耀巅峰。", ["电竞", "热血"], ["荣耀"]),
    ("tangmen", "斗罗大陆II绝世唐门", "唐家三少", "霍雨浩的绝世唐门。", ["玄幻"], ["绝世唐门"]),
    ("qianqiu", "千秋", "梦溪石", "江湖恩怨与朝堂风云。", ["武侠", "权谋"], []),
    ("langya", "琅琊榜", "海宴", "梅长苏的赤焰雪冤。", ["权谋", "历史"], []),
    ("zanghualu", "藏海花", "南派三叔", "张起灵身世线索。", ["悬疑", "冒险"], []),
    ("daomubi", "盗墓笔记", "南派三叔", "吴邪的盗墓探险。", ["悬疑", "冒险"], ["盗墓"]),
    ("guiqing", "鬼吹灯", "天下霸唱", "胡八一摸金校尉。", ["悬疑", "冒险"], []),
    ("zhuxian", "雪中悍刀行", "烽火戏诸侯", "徐凤年的江湖庙堂。", ["武侠", "历史"], ["雪中"]),
    ("jianlai", "剑来", "烽火戏诸侯", "陈平安的剑道与天下。", ["仙侠", "玄幻"], []),
    ("jiangye", "将夜", "猫腻", "宁缺与桑桑的永夜传说。", ["玄幻", "权谋"], []),
    ("zeitian", "择天记", "猫腻", "陈长生改命逆天。", ["玄幻"], []),
    ("yuren", "余罪", "常书欣", "警察余罪的卧底生涯。", ["都市", "悬疑"], []),
    ("tianya", "天涯明月刀", "古龙", "傅红雪的江湖恩怨。", ["武侠"], ["明月刀"]),
    ("luoxue", "陆小凤传奇", "古龙", "陆小凤灵犀一指破奇案。", ["武侠"], ["陆小凤"]),
    ("chuyi", "楚留香传奇", "古龙", "盗帅楚留香的江湖奇案。", ["武侠"], ["楚留香"]),
]


def _make_popular(ref: str, title: str, author: str, summary: str, tags: list, aliases: list) -> SourceBook:
    alias_txt = " ".join(aliases)
    return SourceBook(
        source="popular",
        source_ref=f"popular-{ref}",
        title=title,
        author=author,
        summary=f"{summary}版权作品，请本地导入正版 txt 后生成漫画。{(' 别名：' + alias_txt) if alias_txt else ''}",
        language="zh",
        download_url="",
        extra={"copyright": True, "tags": tags, "aliases": aliases},
    )


POPULAR_CATALOG: List[SourceBook] = [
    _make_popular(*row) for row in _popular_defs
]


def _match_book(b: SourceBook, q: str) -> bool:
    if not q:
        return True
    extra = (b.extra or {}) if isinstance(b.extra, dict) else {}
    aliases = extra.get("tags") or []
    alias_list = extra.get("aliases") or []
    blob = " ".join(
        [
            b.title or "",
            b.author or "",
            b.summary or "",
            " ".join(aliases),
            " ".join(alias_list),
        ]
    ).lower()
    ql = q.lower()
    return ql in blob


async def search_popular(q: str = "", limit: int = 12) -> List[SourceBook]:
    q = (q or "").strip()
    hits = [b for b in POPULAR_CATALOG if _match_book(b, q)]
    return hits[:limit] if q else list(POPULAR_CATALOG[:limit])


async def search_all_sources(q: str, limit: int = 16) -> List[Dict]:
    """Aggregate fiction-first search. Empty q returns defaults from each source."""
    q = (q or "").strip()
    per = max(4, limit // 3)
    results: List[Dict] = []

    for b in await search_popular(q, per):
        d = b.to_dict()
        d["importable"] = False
        d["reason"] = "版权保护 · 请本地上传正版文件"
        results.append(d)

    for b in await search_builtin(q, per):
        d = b.to_dict()
        d["importable"] = True
        results.append(d)

    try:
        for b in await search_gutenberg(q, per):
            d = b.to_dict()
            d["importable"] = True
            results.append(d)
    except Exception as e:
        print(f"search_all gutenberg: {e}")

    return results[:limit]


def _clean_html(html: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


async def search_builtin(q: str = "", limit: int = 12) -> List[SourceBook]:
    q = (q or "").strip().lower()
    if not q:
        return list(BUILTIN_CATALOG[:limit])
    out = []
    for b in BUILTIN_CATALOG:
        blob = f"{b.title} {b.author} {b.summary}".lower()
        if q in blob:
            out.append(b)
    return out[:limit]


async def fetch_builtin_text(url: str) -> str:
    return BUILTIN_TEXTS.get(url, "")


async def search_gutenberg(q: str, limit: int = 12) -> List[SourceBook]:
    """Search Project Gutenberg fiction via official catalog cache."""
    from app.services import gutenberg_catalog as pg

    if not pg.load_catalog():
        try:
            await pg.download_catalog()
        except Exception as e:
            raise RuntimeError(f"古登堡目录不可用，请检查网络: {e}") from e

    # empty query → first fiction titles (stable catalog order)
    rows = pg.search_catalog(q or "", limit=limit, fiction_only=True)
    if not rows and q:
        # fallback: title/author substring without fiction filter
        rows = pg.search_catalog(q, limit=limit, fiction_only=False)
    books = []
    for it in rows:
        books.append(SourceBook(
            source="gutenberg",
            source_ref=str(it["id"]),
            title=it["title"],
            author=it.get("author", ""),
            summary=it.get("subjects", "")[:240],
            cover_url=it.get("cover_url", ""),
            download_url=it.get("text_url", ""),
            language=it.get("language", ""),
        ))
    return books


async def fetch_gutenberg_text(url: str) -> str:
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True, headers={"User-Agent": UA}) as client:
        r = await client.get(url)
        r.raise_for_status()
        raw = r.text
    if "<html" in raw[:200].lower():
        return _clean_html(raw)[:200000]
    return raw[:200000]


async def search_wikisource(q: str, limit: int = 12) -> List[SourceBook]:
    q = (q or "").strip()
    if not q:
        return []
    # MediaWiki opensearch + extract
    api = (
        "https://zh.wikisource.org/w/api.php?action=query&format=json"
        f"&generator=search&gsrsearch={quote(q)}&gsrlimit={limit}"
        "&prop=extracts|info&exintro=1&explaintext=1&inprop=url"
    )
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        r = await client.get(api, headers={"User-Agent": "novel-comic-library/1.0"})
        r.raise_for_status()
        data = r.json()
    pages = (data.get("query") or {}).get("pages") or {}
    books = []
    for page in pages.values():
        title = page.get("title") or ""
        page_url = page.get("fullurl") or ""
        books.append(SourceBook(
            source="wikisource",
            source_ref=page_url or title,
            title=title,
            author="",
            summary=(page.get("extract") or "")[:240],
            download_url=page_url,
            language="zh",
        ))
    return books


async def fetch_wikisource_text(page_url: str) -> str:
    # Use action=parse raw wikitext-ish extract via REST
    # Prefer action=query&prop=extracts full
    title = page_url.rstrip("/").split("/")[-1]
    api = (
        "https://zh.wikisource.org/w/api.php?action=query&format=json"
        f"&prop=extracts&explaintext=1&titles={quote(title)}"
    )
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        r = await client.get(api, headers={"User-Agent": "novel-comic-library/1.0"})
        r.raise_for_status()
        data = r.json()
    pages = (data.get("query") or {}).get("pages") or {}
    for page in pages.values():
        text = page.get("extract") or ""
        if text:
            return text[:200000]
    # fallback raw html
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        r = await client.get(page_url, headers={"User-Agent": "novel-comic-library/1.0"})
        r.raise_for_status()
        return _clean_html(r.text)[:200000]


async def fetch_url_text(url: str, max_bytes: int = 400_000) -> str:
    if not url.startswith("http"):
        raise ValueError("URL 必须以 http(s):// 开头")
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        r = await client.get(url, headers={"User-Agent": "novel-comic-library/1.0"})
        r.raise_for_status()
        raw = r.text[:max_bytes]
    ctype = r.headers.get("content-type", "")
    if "html" in ctype or raw.lstrip()[:20].lower().startswith("<!doctype"):
        return _clean_html(raw)
    return raw


async def search_source(source_id: str, q: str, limit: int = 12) -> List[SourceBook]:
    sid = (source_id or "").lower()
    limit = max(1, min(int(limit or 12), 30))
    if sid == "builtin":
        return await search_builtin(q, limit)
    if sid == "popular":
        return await search_popular(q, limit)
    if sid == "gutenberg":
        return await search_gutenberg(q, limit)
    if sid == "wikisource":
        books = await search_wikisource(q, limit)
        return books[:limit]
    raise ValueError(f"未知书源: {source_id}")


async def fetch_book_text(source: str, download_url: str, source_ref: str = "") -> str:
    s = (source or "").lower()
    if s == "builtin":
        return await fetch_builtin_text(download_url)
    if s == "gutenberg":
        return await fetch_gutenberg_text(download_url)
    if s == "wikisource":
        return await fetch_wikisource_text(download_url or source_ref)
    if s == "url":
        return await fetch_url_text(download_url)
    # generic
    if download_url.startswith("http"):
        return await fetch_url_text(download_url)
    raise ValueError(f"无法获取文本 source={source}")
