"""Comic visual styles — genre presets + auto-detect from novel text."""
from __future__ import annotations

import re
from typing import Dict, List, Optional

# id -> display + prompt fragments
STYLE_PRESETS: Dict[str, Dict] = {
    "auto": {
        "label": "自动适配",
        "label_en": "Auto",
        "description": "根据章节内容关键词自动匹配风格",
        "prompt": (
            "Visual style auto-adapted to the novel genre. "
            "Anime manga illustration, bold linework, expressive eyes, "
            "cinematic lighting, high quality, no text, no watermark."
        ),
        "script_zh": "根据小说题材自动选择合适的日漫画风与场景转译，写入 style_notes。",
    },
    "xianxia": {
        "label": "修仙",
        "label_en": "Xianxia",
        "description": "仙侠玄幻、御剑飞升、灵气光效",
        "prompt": (
            "Chinese xianxia / cultivation fantasy manga illustration. "
            "Immortal mountains floating in clouds, jade palaces, flowing hanfu robes, "
            "spiritual energy (qi) glowing cyan-gold auras, flying swords, talismans, "
            "ink-wash mist atmosphere with vibrant magical light. "
            "Elegant Eastern fantasy, NOT sci-fi tech, NOT modern city. "
            "High quality anime-style painting, no text, no watermark."
        ),
        "script_zh": "修仙/仙侠：仙山云海、御剑、灵力光效、古风服饰；避免现代科幻元素。",
        "negative": "cyberpunk, neon signs, modern skyscraper, sci-fi laser gun, text, watermark",
    },
    "wuxia": {
        "label": "武侠",
        "label_en": "Wuxia",
        "description": "江湖侠客、刀光剑影、水墨意境",
        "prompt": (
            "Chinese wuxia martial arts manga illustration. "
            "Jianghu swordsman on tiled rooftops at dusk, bamboo forests, ancient taverns, "
            "flowing robes mid-leap, sword light trails, ink-brush atmosphere, "
            "warm lantern glow and cool moonlight. "
            "NOT fantasy magic spells as primary, NOT cyberpunk. "
            "High quality anime martial arts art, no text, no watermark."
        ),
        "script_zh": "武侠：江湖、刀剑、轻功、客栈与竹林；偏写意水墨与侠气。",
        "negative": "spaceship, robot, neon cyberpunk city, text, watermark",
    },
    "scifi": {
        "label": "科幻",
        "label_en": "Sci-Fi",
        "description": "星际、机甲、赛博都市",
        "prompt": (
            "Sci-fi manga illustration. "
            "Spaceship corridors, holographic UI, mecha silhouettes, alien vistas, "
            "neon cyberpunk city nights, hard-light and volumetric beams, "
            "cool blue-cyan tech palette with orange warning accents. "
            "Futuristic architecture, NOT ancient fantasy robes. "
            "High quality detailed sci-fi anime, no text, no watermark."
        ),
        "script_zh": "科幻：飞船、全息、机甲、赛博都市；冷色科技光与警示橙。",
        "negative": "ancient chinese temple, hanfu, cultivation qi, text, watermark",
    },
    "mystery": {
        "label": "悬疑",
        "label_en": "Mystery",
        "description": "侦探、阴影、冷暖对比",
        "prompt": (
            "Mystery / detective manga illustration. "
            "Film-noir lighting, rain-soaked streets, dim offices, silhouettes in fog, "
            "high-contrast chiaroscuro, muted teal and amber, clue close-ups. "
            "Tense psychological mood, NOT bright cheerful comedy. "
            "High quality noir anime style, no text, no watermark."
        ),
        "script_zh": "悬疑：黑雨街道、剪影、强对比明暗、线索特写；气氛紧张克制。",
        "negative": "bright sunny comedy, chibi pastel, text, watermark",
    },
    "horror": {
        "label": "恐怖",
        "label_en": "Horror",
        "description": "暗夜、压迫感、惊悚氛围",
        "prompt": (
            "Horror manga illustration. "
            "Dark oppressive atmosphere, sickly green-purple shadows, distorted faces, "
            "abandoned corridors, unsettling negative space, blood-red accents used sparingly. "
            "Psychological dread, NOT gore-heavy splatter comedy. "
            "High quality horror anime art, no text, no watermark."
        ),
        "script_zh": "恐怖：压迫暗部、病态绿紫阴影、扭曲表情；心理惊悚为主。",
        "negative": "bright pastel slice of life, chibi cute, text, watermark",
    },
    "fantasy": {
        "label": "奇幻",
        "label_en": "Fantasy",
        "description": "西幻魔法、精灵龙与异世界",
        "prompt": (
            "Western high-fantasy manga illustration. "
            "Magic runes, elves, dragons, enchanted forests, crystal spires, "
            "stained-glass light, rich jewel tones (emerald, gold, violet). "
            "Epic adventure mood. NOT modern city, NOT hard sci-fi. "
            "High quality fantasy anime painting, no text, no watermark."
        ),
        "script_zh": "奇幻：魔法符文、精灵龙、异世界建筑；宝石色史诗感。",
        "negative": "modern office, cyberpunk neon street, text, watermark",
    },
    "romance": {
        "label": "言情",
        "label_en": "Romance",
        "description": "柔光、花雨、情感特写",
        "prompt": (
            "Romance manga illustration. "
            "Soft golden-hour or sakura petal rain, intimate close-ups, "
            "warm pink-peach and cream palette, gentle bokeh lights, "
            "emotional eye highlights, delicate line art. "
            "NOT cold horror, NOT gritty noir. "
            "High quality shoujo/josei anime style, no text, no watermark."
        ),
        "script_zh": "言情：柔光、花瓣雨、情感特写；粉桃暖色与细腻线稿。",
        "negative": "horror blood, dark noir rain only, text, watermark",
    },
    "urban": {
        "label": "都市",
        "label_en": "Urban",
        "description": "现代都市生活、写字楼与街头",
        "prompt": (
            "Modern urban slice-of-drama manga illustration. "
            "City crosswalks, coffee shops, office glass towers at blue hour, "
            "clean contemporary fashion, naturalistic lighting with soft neon accents. "
            "Grounded daily-life realism with anime polish. "
            "High quality modern anime, no text, no watermark."
        ),
        "script_zh": "都市：现代街景、咖啡馆、写字楼蓝调时刻；写实与动漫结合。",
        "negative": "ancient dynasty robes, floating immortal mountains, text, watermark",
    },
    "history": {
        "label": "历史",
        "label_en": "History",
        "description": "古风朝堂、市井与史诗",
        "prompt": (
            "Historical period drama manga illustration. "
            "Ancient dynasty streets, period-accurate costumes, wooden architecture, "
            "battle banners or scholarly courtyards, warm earth tones and ink texture. "
            "Dignified cinematic composition. NOT modern fashion, NOT sci-fi. "
            "High quality historical anime art, no text, no watermark."
        ),
        "script_zh": "历史：朝代街市、考据服饰、木构建筑；土金墨色庄重构图。",
        "negative": "smartphone, skyscraper, cyberpunk, text, watermark",
    },
    "daily": {
        "label": "日常",
        "label_en": "Slice of Life",
        "description": "治愈日常、校园与小确幸",
        "prompt": (
            "Slice-of-life manga illustration. "
            "Cozy classroom or kitchen light, warm afternoon sun, soft pastel accents, "
            "gentle expressions, simple clean backgrounds, healing mood. "
            "NOT intense action, NOT dark horror. "
            "High quality iyashikei anime style, no text, no watermark."
        ),
        "script_zh": "日常：教室/厨房柔光、午后阳光、治愈表情；简洁背景。",
        "negative": "gore, heavy horror, mecha battle, text, watermark",
    },
    "sports": {
        "label": "热血",
        "label_en": "Action / Sports",
        "description": "运动竞技、速度线与爆发力",
        "prompt": (
            "Hot-blooded action / sports manga illustration. "
            "Dynamic speed lines, dramatic low angles, sweat and motion blur, "
            "intense eyes, stadium lights or battle impact frames, high energy orange-red accents. "
            "NOT quiet slice-of-life stillness. "
            "High quality shonen anime action art, no text, no watermark."
        ),
        "script_zh": "热血：速度线、低角度、爆发眼神与冲击帧；橙红高能色。",
        "negative": "static talking heads only, pastel quiet room, text, watermark",
    },
    "neon-tokyo": {
        "label": "霓虹东京",
        "label_en": "Neon Tokyo",
        "description": "UI 主题同款：雨夜都市霓虹",
        "prompt": (
            "Neon Tokyo night city manga illustration. "
            "Deep night blue-black background, wet asphalt reflections after rain. "
            "Multi-color neon glow: hot pink, cyan, warm orange, purple. "
            "Kabukicho street atmosphere, bold anime linework, large eyes. "
            "NOT daytime, NOT pastel, no text, no watermark."
        ),
        "script_zh": "霓虹东京：深夜蓝黑底、雨后湿反射、粉/青/橙多色霓虹。",
        "negative": "daytime bright sun, pastel colors, white background, text, watermark",
    },
}

# Keyword → style_id (order matters: first match wins by score)
_GENRE_KEYWORDS: List[tuple] = [
    ("xianxia", ["修仙", "仙尊", "金丹", "元婴", "飞升", "灵根", "渡劫", "御剑", "仙侠", "宗门", "灵气"]),
    ("wuxia", ["江湖", "武林", "侠客", "剑客", "内力", "轻功", "门派", "客栈", "刀光", "武侠"]),
    ("scifi", ["星舰", "星际", "机甲", "赛博", "人工智能", "太空", "飞船", "外星", "科幻", "超光速", "机器人"]),
    ("mystery", ["侦探", "悬疑", "推理", "凶手", "密室", "线索", "刑警", "谜团", "失踪"]),
    ("horror", ["鬼", "灵异", "恐怖", "惊悚", "怨灵", "尸", "阴森", "诅咒"]),
    ("fantasy", ["魔法", "精灵", "龙族", "异世界", "神祇", "咒语", "奇幻", "勇者", "魔王"]),
    ("romance", ["恋爱", "心动", "告白", "言情", "甜宠", "虐恋", "婚礼", "表白"]),
    ("history", ["王朝", "皇帝", "古代", "大唐", "大明", "清宫", "江湖朝廷", "史书", "民国"]),
    ("sports", ["篮球", "足球", "比赛", "冠军", "热血", "竞技", "田径", "格斗"]),
    ("daily", ["日常", "校园", "青春", "治愈", "小确幸", "咖啡", "厨房", "放学"]),
    ("urban", ["都市", "职场", "写字楼", "公寓", "地铁", "创业", "总裁"]),
]


def list_styles() -> List[Dict]:
    """Public style catalog for API/UI."""
    items = []
    for sid, meta in STYLE_PRESETS.items():
        items.append({
            "id": sid,
            "label": meta["label"],
            "label_en": meta["label_en"],
            "description": meta["description"],
        })
    return items


def get_style(style_id: Optional[str]) -> Dict:
    sid = (style_id or "auto").strip().lower()
    if sid not in STYLE_PRESETS:
        sid = "auto"
    return STYLE_PRESETS[sid]


def detect_genre_id(content: str, title: str = "") -> str:
    """Heuristic genre detection from novel text. Returns preset id (not 'auto')."""
    text = f"{title}\n{content or ''}"
    scores: Dict[str, int] = {}
    for sid, words in _GENRE_KEYWORDS:
        score = 0
        for w in words:
            score += text.count(w)
        if score:
            scores[sid] = score
    if not scores:
        return "daily"
    return max(scores.items(), key=lambda kv: kv[1])[0]


def resolve_style_id(style_id: Optional[str], content: str = "", title: str = "") -> str:
    """Map request style to a concrete preset id."""
    sid = (style_id or "auto").strip().lower()
    if sid in ("", "auto", "detect"):
        return detect_genre_id(content, title)
    if sid in STYLE_PRESETS:
        return sid
    return detect_genre_id(content, title)


def _prompt_core(style_id: Optional[str], content: str = "", title: str = "") -> tuple:
    resolved = resolve_style_id(style_id, content, title)
    meta = STYLE_PRESETS[resolved]
    return resolved, meta["prompt"], meta.get("script_zh", ""), meta.get("negative", "")


def build_panel_prompt(
    panel: dict,
    style_id: Optional[str] = None,
    novel_content: str = "",
    novel_title: str = "",
) -> str:
    """Compose image prompt: genre style + panel content."""
    _, base_prompt, default_notes, _ = _prompt_core(style_id, novel_content, novel_title)

    def _s(v) -> str:
        if v is None:
            return ""
        if isinstance(v, (list, tuple)):
            return " ".join(_s(x) for x in v)
        return str(v).strip()

    scene = _s(panel.get("scene"))
    raw_chars = panel.get("characters") or []
    if isinstance(raw_chars, str):
        characters = [c.strip() for c in raw_chars.split(",") if c.strip()]
    elif isinstance(raw_chars, (list, tuple)):
        characters = [_s(c) for c in raw_chars if _s(c)]
    else:
        characters = []
    action = _s(panel.get("action"))
    mood = _s(panel.get("mood"))
    style_notes = _s(panel.get("style_notes")) or default_notes

    parts = [
        base_prompt,
        f"Scene: {scene}." if scene else "",
        f"Characters: {', '.join(characters)}." if characters else "",
        f"Action: {action}." if action else "",
        f"Mood: {mood}." if mood else "",
        f"Style notes: {style_notes}.",
        "Single manga panel, high quality detailed illustration, no text, no watermark.",
    ]
    return " ".join(p for p in parts if p)


def build_negative_prompt(style_id: Optional[str], fallback: str = "") -> str:
    _, _, _, neg = _prompt_core(style_id)
    if neg:
        return neg
    return fallback or "text, watermark, logo, lowres, blurry"


def style_script_system_prompt(style_id: Optional[str] = None, content: str = "", title: str = "") -> str:
    """System prompt for ComicScriptAgent using resolved genre style."""
    resolved, _, script_zh, _ = _prompt_core(style_id, content, title)
    label = STYLE_PRESETS[resolved]["label"]
    return f"""你是一个专业的漫画分镜脚本编写师。将小说章节转化为漫画分镜。

当前选定风格：{label}（id={resolved}）
风格要求（写入每个分镜 style_notes）：
{script_zh}

规则：
- 拆成 4-8 个关键场景
- 场景/服装/光影须符合上述风格，同时忠于原著情节
- 每个场景：画面、人物表情动作、对话、氛围

返回 JSON 数组，元素字段：
scene, characters, action, dialogue, mood, style_notes
只返回 JSON。"""


# Back-compat aliases
DEFAULT_STYLE_NOTES = STYLE_PRESETS["auto"]["script_zh"]
NEON_TOKYO_STYLE = STYLE_PRESETS["neon-tokyo"]["prompt"]
