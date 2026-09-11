# AI小说生成漫画 Web应用 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于AgentScope的Web应用，用户上传纯文本小说，AI智能分章节并为每个章节生成日漫风格的漫画图片，实现小说到漫画的实时转换。

**Architecture:** 采用前后端分离架构。后端使用FastAPI + AgentScope处理小说解析和漫画生成，前端使用React实现左右分栏实时预览界面。通过qwen3.8-max生成漫画脚本，调用通义万相(wanx)生成日漫风格图片。

**Tech Stack:** 
- 后端: Python 3.10+, FastAPI, AgentScope, SQLAlchemy, SQLite
- 前端: React 18+, Vite, Zustand, Axios, Tailwind CSS
- AI模型: qwen3.8-max (文本), wanx (图片生成)
- 部署: Docker, 阿里云ECS

**Spec:** `docs/superpowers/specs/2026-09-09-ai-novel-to-comic-design.md`

## Global Constraints

- Python >= 3.10
- Node.js >= 18
- AgentScope最新版本
- DashScope API密钥配置
- 文件上传大小限制: 10MB
- 图片生成超时: 60秒

---

## File Structure

```
agent-scope-dev/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI应用入口
│   │   ├── config.py            # 配置管理
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── novel.py         # Novel数据模型
│   │   │   ├── chapter.py       # Chapter数据模型
│   │   │   └── comic_panel.py   # ComicPanel数据模型
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   ├── novel_parser.py  # 小说解析Agent
│   │   │   ├── comic_script.py  # 漫画脚本Agent
│   │   │   └── comic_generator.py # 漫画生成Agent
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── novels.py        # 小说相关API
│   │   │   ├── chapters.py      # 章节相关API
│   │   │   └── comics.py        # 漫画相关API
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── novel_service.py # 小说业务逻辑
│   │   │   └── comic_service.py # 漫画业务逻辑
│   │   └── database.py          # 数据库连接
│   ├── uploads/                 # 上传文件存储
│   ├── comics/                  # 生成的漫画存储
│   ├── requirements.txt
│   └── alembic/                 # 数据库迁移
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── NovelList.jsx
│   │   │   ├── NovelReader.jsx
│   │   │   ├── ComicViewer.jsx
│   │   │   └── UploadModal.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── NovelPage.jsx
│   │   │   └── ComicCollectionPage.jsx
│   │   ├── stores/
│   │   │   ├── novelStore.js
│   │   │   └── comicStore.js
│   │   └── api/
│   │       └── client.js
│   ├── package.json
│   └── vite.config.js
└── docker-compose.yml
```

---

## Task 1: 后端项目初始化与数据库配置

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`
- Create: `backend/requirements.txt`

**Interfaces:**
- Consumes: None
- Produces: FastAPI app instance, database session

- [ ] **Step 1: 创建后端目录结构**

```bash
mkdir -p backend/app/models backend/app/agents backend/app/routers backend/app/services
mkdir -p backend/uploads backend/comics
```

- [ ] **Step 2: 创建requirements.txt**

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
alembic==1.13.0
python-multipart==0.0.6
pydantic==2.5.2
pydantic-settings==2.1.0
agentscope>=0.1.0
dashscope>=1.14.0
aiofiles==23.2.1
python-jose[cryptography]==3.3.0
```

- [ ] **Step 3: 创建config.py**

```python
from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    APP_NAME: str = "AI小说漫画生成器"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str = "sqlite:///./novels.db"
    
    # DashScope
    DASHSCOPE_API_KEY: str = ""
    QWEN_MODEL: str = "qwen3.8-max"
    WANX_MODEL: str = "wanx-v1"
    
    # File Storage
    UPLOAD_DIR: Path = Path("uploads")
    COMIC_DIR: Path = Path("comics")
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # CORS
    CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000"]
    
    class Config:
        env_file = ".env"

settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(exist_ok=True)
settings.COMIC_DIR.mkdir(exist_ok=True)
```

- [ ] **Step 4: 创建database.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 5: 创建main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base
from app.routers import novels, chapters, comics

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/comics", StaticFiles(directory="comics"), name="comics")

# Routers
app.include_router(novels.router, prefix="/api/novels", tags=["novels"])
app.include_router(chapters.router, prefix="/api", tags=["chapters"])
app.include_router(comics.router, prefix="/api/comics", tags=["comics"])

@app.get("/")
async def root():
    return {"message": "AI小说漫画生成器 API"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

- [ ] **Step 6: 创建空的router占位文件**

```python
# backend/app/routers/__init__.py
```

```python
# backend/app/routers/novels.py
from fastapi import APIRouter
router = APIRouter()
```

```python
# backend/app/routers/chapters.py
from fastapi import APIRouter
router = APIRouter()
```

```python
# backend/app/routers/comics.py
from fastapi import APIRouter
router = APIRouter()
```

- [ ] **Step 7: 创建.env文件**

```env
DASHSCOPE_API_KEY=your-dashscope-api-key-here
```

- [ ] **Step 8: 测试后端启动**

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

访问 http://localhost:8000/docs 验证Swagger文档正常显示

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat: 初始化后端项目，配置FastAPI和数据库"
```

---

## Task 2: 数据模型定义

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/novel.py`
- Create: `backend/app/models/chapter.py`
- Create: `backend/app/models/comic_panel.py`

**Interfaces:**
- Consumes: database.py (Base, engine)
- Produces: Novel, Chapter, ComicPanel ORM models

- [ ] **Step 1: 创建novel.py**

```python
from sqlalchemy import Column, String, Text, DateTime, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class Novel(Base):
    __tablename__ = "novels"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(
        Enum("processing", "completed", "error", name="novel_status"),
        default="processing"
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    chapters = relationship("Chapter", back_populates="novel", cascade="all, delete-orphan")
```

- [ ] **Step 2: 创建chapter.py**

```python
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class Chapter(Base):
    __tablename__ = "chapters"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    novel_id = Column(String(36), ForeignKey("novels.id"), nullable=False)
    chapter_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    comic_status = Column(
        Enum("pending", "generating", "completed", "error", name="comic_status"),
        default="pending"
    )
    comic_images = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    novel = relationship("Novel", back_populates="chapters")
    comic_panels = relationship("ComicPanel", back_populates="chapter", cascade="all, delete-orphan")
```

- [ ] **Step 3: 创建comic_panel.py**

```python
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class ComicPanel(Base):
    __tablename__ = "comic_panels"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chapter_id = Column(String(36), ForeignKey("chapters.id"), nullable=False)
    panel_index = Column(Integer, nullable=False)
    script = Column(Text, nullable=False)
    image_path = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    chapter = relationship("Chapter", back_populates="comic_panels")
```

- [ ] **Step 4: 更新models/__init__.py**

```python
from app.models.novel import Novel
from app.models.chapter import Chapter
from app.models.comic_panel import ComicPanel

__all__ = ["Novel", "Chapter", "ComicPanel"]
```

- [ ] **Step 5: 运行数据库迁移**

```bash
cd backend
python -c "from app.database import engine, Base; from app.models import *; Base.metadata.create_all(bind=engine)"
```

- [ ] **Step 6: 验证数据库表创建**

```bash
python -c "import sqlite3; conn = sqlite3.connect('novels.db'); print(conn.execute('SELECT name FROM sqlite_master WHERE type=\"table\"').fetchall())"
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/
git commit -m "feat: 定义Novel、Chapter、ComicPanel数据模型"
```

---

## Task 3: 小说解析Agent实现

**Files:**
- Create: `backend/app/agents/__init__.py`
- Create: `backend/app/agents/novel_parser.py`

**Interfaces:**
- Consumes: qwen3.8-max via DashScope
- Produces: `parse_novel(content: str) -> List[Dict[str, str]]` 返回章节列表

- [ ] **Step 1: 创建novel_parser.py**

```python
import json
from typing import List, Dict
from agentscope.agent import Agent
from agentscope.model import DashScopeChatModel
from agentscope.credential import DashScopeCredential
from agentscope.message import UserMsg
from app.config import settings

class NovelParserAgent:
    def __init__(self):
        self.agent = Agent(
            name="NovelParser",
            system_prompt="""你是一个专业的小说结构分析师。你的任务是将用户上传的小说内容智能分割成章节。

规则：
1. 识别章节标题（如"第一章"、"第X章"、"Chapter X"等格式）
2. 如果没有明确的章节标记，根据内容的情节转折点进行分段
3. 每个章节应该有清晰的标题和完整的内容
4. 返回格式为JSON数组，每个元素包含"title"和"content"字段

示例输出格式：
[
  {"title": "第一章 初遇", "content": "章节内容..."},
  {"title": "第二章 离别", "content": "章节内容..."}
]""",
            model=DashScopeChatModel(
                credential=DashScopeCredential(
                    api_key=settings.DASHSCOPE_API_KEY,
                ),
                model=settings.QWEN_MODEL,
            ),
        )
    
    async def parse_novel(self, content: str) -> List[Dict[str, str]]:
        """解析小说内容，返回章节列表"""
        prompt = f"""请分析以下小说内容，将其智能分割成章节。

小说内容：
{content}

请返回JSON格式的章节列表，包含title和content字段。只返回JSON，不要其他内容。"""
        
        user_msg = UserMsg(name="user", content=prompt)
        reply = await self.agent.reply(user_msg)
        
        # 解析JSON响应
        text = reply.get_text_content()
        
        # 尝试提取JSON
        try:
            # 找到JSON开始和结束的位置
            start = text.find('[')
            end = text.rfind(']') + 1
            if start != -1 and end != 0:
                json_str = text[start:end]
                chapters = json.loads(json_str)
                return chapters
        except json.JSONDecodeError:
            pass
        
        # 如果解析失败，返回单个章节
        return [{"title": "全文", "content": content}]
```

- [ ] **Step 2: 创建agents/__init__.py**

```python
from app.agents.novel_parser import NovelParserAgent
from app.agents.comic_script import ComicScriptAgent
from app.agents.comic_generator import ComicGeneratorAgent

__all__ = ["NovelParserAgent", "ComicScriptAgent", "ComicGeneratorAgent"]
```

- [ ] **Step 3: 测试NovelParserAgent**

```python
# backend/test_parser.py
import asyncio
from app.agents.novel_parser import NovelParserAgent

async def test():
    agent = NovelParserAgent()
    test_content = """第一章 初遇

    春天的阳光照在小镇上，小明第一次遇见了小红。

    "你好，我叫小明。"他鼓起勇气说道。

    小红微微一笑，"你好，我是小红。"

第二章 离别

    夏天来了，小红告诉小明她要搬家了。

    "我会想你的。"小明说。

    "我也是。"小红的眼眶湿润了。"""
    
    chapters = await agent.parse_novel(test_content)
    print(f"解析出 {len(chapters)} 个章节:")
    for ch in chapters:
        print(f"  - {ch['title']}")

asyncio.run(test())
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/agents/
git commit -m "feat: 实现NovelParserAgent，支持小说智能分章"
```

---

## Task 4: 漫画脚本Agent实现

**Files:**
- Create: `backend/app/agents/comic_script.py`

**Interfaces:**
- Consumes: 章节内容 (str)
- Produces: `generate_script(content: str, style: str = "manga") -> List[Dict]` 返回分镜列表

- [ ] **Step 1: 创建comic_script.py**

```python
import json
from typing import List, Dict
from agentscope.agent import Agent
from agentscope.model import DashScopeChatModel
from agentscope.credential import DashScopeCredential
from agentscope.message import UserMsg
from app.config import settings

class ComicScriptAgent:
    def __init__(self):
        self.agent = Agent(
            name="ComicScript",
            system_prompt="""你是一个专业的漫画分镜脚本编写师。你的任务是将小说章节内容转化为漫画分镜描述。

规则：
1. 将章节内容拆分成4-8个关键场景
2. 每个场景需要描述：画面内容、人物表情动作、对话、场景氛围
3. 使用日漫风格描述（大眼睛、夸张表情、速度线等）
4. 每个分镜应该有清晰的视觉描述，便于AI绘图

返回格式为JSON数组，每个元素包含：
- scene: 场景描述
- characters: 出现的人物
- action: 动作描述
- dialogue: 对话内容（如果有）
- mood: 氛围/情绪
- style_notes: 风格提示词"""
        
        self.model = DashScopeChatModel(
            credential=DashScopeCredential(
                api_key=settings.DASHSCOPE_API_KEY,
            ),
            model=settings.QWEN_MODEL,
        )
        self.agent.model = self.model
    
    async def generate_script(self, content: str, style: str = "manga") -> List[Dict]:
        """生成漫画分镜脚本"""
        
        style_guide = ""
        if style == "manga":
            style_guide = """日漫风格特点：
- 大眼睛，富有表现力
- 夸张的表情和动作
- 使用速度线表示动态
- 细腻的背景和光影
- 分镜布局清晰，有层次感"""
        
        prompt = f"""请将以下小说章节内容转化为漫画分镜脚本。

{style_guide}

小说内容：
{content}

请返回JSON格式的分镜列表，每个分镜包含scene、characters、action、dialogue、mood、style_notes字段。只返回JSON，不要其他内容。"""
        
        user_msg = UserMsg(name="user", content=prompt)
        reply = await self.agent.reply(user_msg)
        
        text = reply.get_text_content()
        
        try:
            start = text.find('[')
            end = text.rfind(']') + 1
            if start != -1 and end != 0:
                json_str = text[start:end]
                panels = json.loads(json_str)
                return panels
        except json.JSONDecodeError:
            pass
        
        # 返回默认分镜
        return [{
            "scene": content[:200],
            "characters": [],
            "action": "叙述场景",
            "dialogue": "",
            "mood": "平静",
            "style_notes": "日漫风格"
        }]
```

- [ ] **Step 2: 测试ComicScriptAgent**

```python
# backend/test_script.py
import asyncio
from app.agents.comic_script import ComicScriptAgent

async def test():
    agent = ComicScriptAgent()
    test_content = """小明站在火车站台上，看着即将离去的火车。小红在车窗内向他挥手告别。
    "我会等你回来的！"小明大声喊道。
    小红的眼泪流了下来，她用力点头。火车缓缓启动，带走了她。"""
    
    panels = await agent.generate_script(test_content)
    print(f"生成 {len(panels)} 个分镜:")
    for i, panel in enumerate(panels):
        print(f"  分镜{i+1}: {panel.get('scene', '')[:50]}...")

asyncio.run(test())
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/agents/comic_script.py
git commit -m "feat: 实现ComicScriptAgent，支持章节转漫画分镜"
```

---

## Task 5: 漫画生成Agent实现

**Files:**
- Create: `backend/app/agents/comic_generator.py`

**Interfaces:**
- Consumes: 分镜描述 (List[Dict])
- Produces: `generate_comic(panels: List[Dict], chapter_id: str) -> List[str]` 返回图片路径列表

- [ ] **Step 1: 创建comic_generator.py**

```python
import os
import uuid
import asyncio
from typing import List, Dict
import dashscope
from dashscope import ImageSynthesis
from app.config import settings

class ComicGeneratorAgent:
    def __init__(self):
        dashscope.api_key = settings.DASHSCOPE_API_KEY
    
    def _build_prompt(self, panel: Dict) -> str:
        """构建图片生成提示词"""
        base_prompt = f"Japanese manga style, {panel.get('style_notes', '')}. "
        scene = f"Scene: {panel.get('scene', '')}. "
        characters = f"Characters: {', '.join(panel.get('characters', []))}. " if panel.get('characters') else ""
        action = f"Action: {panel.get('action', '')}. "
        mood = f"Mood: {panel.get('mood', '')}. "
        quality = "High quality, detailed, professional manga illustration."
        
        return base_prompt + scene + characters + action + mood + quality
    
    async def generate_comic(self, panels: List[Dict], chapter_id: str) -> List[str]:
        """为每个分镜生成漫画图片"""
        
        # 创建章节图片目录
        chapter_dir = settings.COMIC_DIR / chapter_id
        chapter_dir.mkdir(exist_ok=True)
        
        image_paths = []
        
        for i, panel in enumerate(panels):
            try:
                prompt = self._build_prompt(panel)
                
                # 调用通义万相API
                rsp = ImageSynthesis.call(
                    model=settings.WANX_MODEL,
                    input={"prompt": prompt},
                    parameters={
                        "style": "<manga>",
                        "size": "1024*1024",
                        "n": 1
                    }
                )
                
                if rsp.status_code == 200:
                    # 下载图片
                    image_url = rsp.output.results[0].url
                    image_path = chapter_dir / f"panel_{i+1:02d}.png"
                    
                    # 下载图片文件
                    import httpx
                    async with httpx.AsyncClient() as client:
                        response = await client.get(image_url)
                        with open(image_path, "wb") as f:
                            f.write(response.content)
                    
                    image_paths.append(str(image_path))
                else:
                    print(f"生成分镜{i+1}失败: {rsp.message}")
                    image_paths.append(None)
                    
            except Exception as e:
                print(f"生成分镜{i+1}异常: {e}")
                image_paths.append(None)
            
            # 避免API限流
            await asyncio.sleep(1)
        
        return image_paths
    
    def save_comic_paths(self, chapter_id: str, image_paths: List[str]) -> str:
        """保存漫画图片路径到章节"""
        import json
        paths_file = settings.COMIC_DIR / chapter_id / "paths.json"
        with open(paths_file, "w") as f:
            json.dump(image_paths, f)
        return str(paths_file)
```

- [ ] **Step 2: 更新agents/__init__.py**

```python
from app.agents.novel_parser import NovelParserAgent
from app.agents.comic_script import ComicScriptAgent
from app.agents.comic_generator import ComicGeneratorAgent

__all__ = ["NovelParserAgent", "ComicScriptAgent", "ComicGeneratorAgent"]
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/agents/comic_generator.py
git commit -m "feat: 实现ComicGeneratorAgent，调用wanx生成漫画图片"
```

---

## Task 6: 小说服务层实现

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/novel_service.py`
- Create: `backend/app/services/comic_service.py`

**Interfaces:**
- Consumes: NovelParserAgent, database models
- Produces: CRUD operations for novels and chapters

- [ ] **Step 1: 创建novel_service.py**

```python
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.novel import Novel
from app.models.chapter import Chapter
from app.agents.novel_parser import NovelParserAgent

class NovelService:
    def __init__(self, db: Session):
        self.db = db
        self.parser_agent = NovelParserAgent()
    
    async def upload_novel(self, title: str, content: str) -> Novel:
        """上传并解析小说"""
        # 创建小说记录
        novel = Novel(title=title, content=content, status="processing")
        self.db.add(novel)
        self.db.commit()
        self.db.refresh(novel)
        
        try:
            # 解析小说章节
            chapters_data = await self.parser_agent.parse_novel(content)
            
            # 创建章节记录
            for i, ch_data in enumerate(chapters_data):
                chapter = Chapter(
                    novel_id=novel.id,
                    chapter_number=i + 1,
                    title=ch_data.get("title", f"第{i+1}章"),
                    content=ch_data.get("content", ""),
                    comic_status="pending"
                )
                self.db.add(chapter)
            
            novel.status = "completed"
            self.db.commit()
            
        except Exception as e:
            novel.status = "error"
            self.db.commit()
            raise e
        
        return novel
    
    def get_novel(self, novel_id: str) -> Optional[Novel]:
        """获取小说详情"""
        return self.db.query(Novel).filter(Novel.id == novel_id).first()
    
    def get_all_novels(self) -> List[Novel]:
        """获取所有小说"""
        return self.db.query(Novel).order_by(Novel.created_at.desc()).all()
    
    def delete_novel(self, novel_id: str) -> bool:
        """删除小说"""
        novel = self.get_novel(novel_id)
        if novel:
            self.db.delete(novel)
            self.db.commit()
            return True
        return False
    
    def get_chapters(self, novel_id: str) -> List[Chapter]:
        """获取小说的所有章节"""
        return self.db.query(Chapter).filter(
            Chapter.novel_id == novel_id
        ).order_by(Chapter.chapter_number).all()
    
    def get_chapter(self, chapter_id: str) -> Optional[Chapter]:
        """获取章节详情"""
        return self.db.query(Chapter).filter(Chapter.id == chapter_id).first()
```

- [ ] **Step 2: 创建comic_service.py**

```python
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.chapter import Chapter
from app.models.comic_panel import ComicPanel
from app.agents.comic_script import ComicScriptAgent
from app.agents.comic_generator import ComicGeneratorAgent

class ComicService:
    def __init__(self, db: Session):
        self.db = db
        self.script_agent = ComicScriptAgent()
        self.generator_agent = ComicGeneratorAgent()
    
    async def generate_chapter_comic(self, chapter_id: str) -> Chapter:
        """为章节生成漫画"""
        chapter = self.db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if not chapter:
            raise ValueError("Chapter not found")
        
        # 更新状态为生成中
        chapter.comic_status = "generating"
        self.db.commit()
        
        try:
            # 生成漫画脚本
            panels_data = await self.script_agent.generate_script(chapter.content)
            
            # 生成漫画图片
            image_paths = await self.generator_agent.generate_comic(
                panels_data, 
                chapter_id
            )
            
            # 保存分镜记录
            for i, (panel, img_path) in enumerate(zip(panels_data, image_paths)):
                if img_path:
                    comic_panel = ComicPanel(
                        chapter_id=chapter_id,
                        panel_index=i + 1,
                        script=panel.get("scene", ""),
                        image_path=img_path
                    )
                    self.db.add(comic_panel)
            
            # 更新章节漫画信息
            chapter.comic_images = [p for p in image_paths if p]
            chapter.comic_status = "completed"
            self.db.commit()
            
        except Exception as e:
            chapter.comic_status = "error"
            self.db.commit()
            raise e
        
        return chapter
    
    def get_chapter_status(self, chapter_id: str) -> dict:
        """获取章节漫画生成状态"""
        chapter = self.db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if not chapter:
            raise ValueError("Chapter not found")
        
        return {
            "chapter_id": chapter.id,
            "status": chapter.comic_status,
            "images": chapter.comic_images
        }
    
    def get_chapter_comics(self, chapter_id: str) -> List[ComicPanel]:
        """获取章节的所有漫画分镜"""
        return self.db.query(ComicPanel).filter(
            ComicPanel.chapter_id == chapter_id
        ).order_by(ComicPanel.panel_index).all()
```

- [ ] **Step 3: 创建services/__init__.py**

```python
from app.services.novel_service import NovelService
from app.services.comic_service import ComicService

__all__ = ["NovelService", "ComicService"]
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/
git commit -m "feat: 实现NovelService和ComicService业务逻辑层"
```

---

## Task 7: API路由实现

**Files:**
- Modify: `backend/app/routers/novels.py`
- Modify: `backend/app/routers/chapters.py`
- Modify: `backend/app/routers/comics.py`

**Interfaces:**
- Consumes: NovelService, ComicService
- Produces: REST API endpoints

- [ ] **Step 1: 实现novels.py**

```python
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from app.database import get_db
from app.services.novel_service import NovelService

router = APIRouter()

class NovelResponse(BaseModel):
    id: str
    title: str
    status: str
    created_at: str
    
    class Config:
        from_attributes = True

class NovelDetailResponse(NovelResponse):
    content: str

@router.post("/upload", response_model=NovelResponse)
async def upload_novel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """上传小说文件"""
    if not file.filename.endswith('.txt'):
        raise HTTPException(status_code=400, detail="只支持.txt文本文件")
    
    content = await file.read()
    
    # 检查文件大小
    if len(content) > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(status_code=400, detail="文件大小不能超过10MB")
    
    # 解析文件内容
    try:
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            text_content = content.decode('gbk')
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="无法解析文件编码")
    
    # 使用文件名作为标题（去掉扩展名）
    title = file.filename.rsplit('.', 1)[0]
    
    service = NovelService(db)
    novel = await service.upload_novel(title, text_content)
    
    return NovelResponse(
        id=novel.id,
        title=novel.title,
        status=novel.status,
        created_at=novel.created_at.isoformat()
    )

@router.get("/", response_model=List[NovelResponse])
async def list_novels(db: Session = Depends(get_db)):
    """获取小说列表"""
    service = NovelService(db)
    novels = service.get_all_novels()
    return [
        NovelResponse(
            id=n.id,
            title=n.title,
            status=n.status,
            created_at=n.created_at.isoformat()
        ) for n in novels
    ]

@router.get("/{novel_id}", response_model=NovelDetailResponse)
async def get_novel(novel_id: str, db: Session = Depends(get_db)):
    """获取小说详情"""
    service = NovelService(db)
    novel = service.get_novel(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="小说不存在")
    
    return NovelDetailResponse(
        id=novel.id,
        title=novel.title,
        content=novel.content,
        status=novel.status,
        created_at=novel.created_at.isoformat()
    )

@router.delete("/{novel_id}")
async def delete_novel(novel_id: str, db: Session = Depends(get_db)):
    """删除小说"""
    service = NovelService(db)
    if not service.delete_novel(novel_id):
        raise HTTPException(status_code=404, detail="小说不存在")
    return {"message": "删除成功"}
```

- [ ] **Step 2: 实现chapters.py**

```python
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from app.database import get_db
from app.services.novel_service import NovelService

router = APIRouter()

class ChapterResponse(BaseModel):
    id: str
    chapter_number: int
    title: str
    content: str
    comic_status: str
    comic_images: List[str]
    
    class Config:
        from_attributes = True

@router.get("/novels/{novel_id}/chapters", response_model=List[ChapterResponse])
async def get_novel_chapters(novel_id: str, db: Session = Depends(get_db)):
    """获取小说的所有章节"""
    service = NovelService(db)
    chapters = service.get_chapters(novel_id)
    return [
        ChapterResponse(
            id=ch.id,
            chapter_number=ch.chapter_number,
            title=ch.title,
            content=ch.content,
            comic_status=ch.comic_status,
            comic_images=ch.comic_images or []
        ) for ch in chapters
    ]

@router.get("/chapters/{chapter_id}", response_model=ChapterResponse)
async def get_chapter(chapter_id: str, db: Session = Depends(get_db)):
    """获取章节详情"""
    service = NovelService(db)
    chapter = service.get_chapter(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="章节不存在")
    
    return ChapterResponse(
        id=chapter.id,
        chapter_number=chapter.chapter_number,
        title=chapter.title,
        content=chapter.content,
        comic_status=chapter.comic_status,
        comic_images=chapter.comic_images or []
    )
```

- [ ] **Step 3: 实现comics.py**

```python
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.services.comic_service import ComicService
from app.services.novel_service import NovelService

router = APIRouter()

class GenerateRequest(BaseModel):
    chapter_id: str

class ComicStatusResponse(BaseModel):
    chapter_id: str
    status: str
    images: List[str]

class ComicPanelResponse(BaseModel):
    id: str
    panel_index: int
    script: str
    image_path: str

async def generate_comic_task(chapter_id: str, db_url: str):
    """后台任务：生成漫画"""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        service = ComicService(db)
        await service.generate_chapter_comic(chapter_id)
    finally:
        db.close()

@router.post("/generate")
async def generate_comic(
    request: GenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """触发章节漫画生成（异步）"""
    # 验证章节存在
    novel_service = NovelService(db)
    chapter = novel_service.get_chapter(request.chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="章节不存在")
    
    if chapter.comic_status == "generating":
        raise HTTPException(status_code=400, detail="该章节正在生成中")
    
    # 启动后台任务
    background_tasks.add_task(
        generate_comic_task,
        request.chapter_id,
        str(db.get_bind().url)
    )
    
    return {"message": "漫画生成任务已启动", "chapter_id": request.chapter_id}

@router.get("/{chapter_id}/status", response_model=ComicStatusResponse)
async def get_comic_status(chapter_id: str, db: Session = Depends(get_db)):
    """查询漫画生成状态"""
    service = ComicService(db)
    try:
        status = service.get_chapter_status(chapter_id)
        return ComicStatusResponse(**status)
    except ValueError:
        raise HTTPException(status_code=404, detail="章节不存在")

@router.get("/{chapter_id}/images", response_model=List[ComicPanelResponse])
async def get_comic_images(chapter_id: str, db: Session = Depends(get_db)):
    """获取章节漫画图片"""
    service = ComicService(db)
    panels = service.get_chapter_comics(chapter_id)
    return [
        ComicPanelResponse(
            id=p.id,
            panel_index=p.panel_index,
            script=p.script,
            image_path=p.image_path
        ) for p in panels
    ]
```

- [ ] **Step 4: 测试API启动**

```bash
cd backend
uvicorn app.main:app --reload
```

访问 http://localhost:8000/docs 验证所有API端点

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/
git commit -m "feat: 实现小说、章节、漫画完整API路由"
```

---

## Task 8: 前端项目初始化

**Files:**
- Create: `frontend/` directory
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: None
- Produces: React应用基础结构

- [ ] **Step 1: 创建前端项目**

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
```

- [ ] **Step 2: 安装依赖**

```bash
npm install axios zustand react-router-dom
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 3: 配置tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 4: 配置vite.config.js**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/comics': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

- [ ] **Step 5: 更新src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 6: 更新App.jsx**

```jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import NovelPage from './pages/NovelPage'
import ComicCollectionPage from './pages/ComicCollectionPage'
import Header from './components/Header'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/novel/:id" element={<NovelPage />} />
            <Route path="/comics/:id" element={<ComicCollectionPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
```

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: 初始化React前端项目，配置Tailwind CSS"
```

---

## Task 9: 前端状态管理和API客户端

**Files:**
- Create: `frontend/src/api/client.js`
- Create: `frontend/src/stores/novelStore.js`
- Create: `frontend/src/stores/comicStore.js`

**Interfaces:**
- Consumes: None
- Produces: API客户端和状态管理store

- [ ] **Step 1: 创建API客户端**

```javascript
// frontend/src/api/client.js
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// 小说相关API
export const novelApi = {
  upload: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/novels/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  getList: () => api.get('/novels/'),
  getDetail: (id) => api.get(`/novels/${id}`),
  delete: (id) => api.delete(`/novels/${id}`),
}

// 章节相关API
export const chapterApi = {
  getByNovel: (novelId) => api.get(`/novels/${novelId}/chapters`),
  getDetail: (id) => api.get(`/chapters/${id}`),
}

// 漫画相关API
export const comicApi = {
  generate: (chapterId) => api.post('/comics/generate', { chapter_id: chapterId }),
  getStatus: (chapterId) => api.get(`/comics/${chapterId}/status`),
  getImages: (chapterId) => api.get(`/comics/${chapterId}/images`),
}

export default api
```

- [ ] **Step 2: 创建novelStore.js**

```javascript
// frontend/src/stores/novelStore.js
import { create } from 'zustand'
import { novelApi, chapterApi } from '../api/client'

const useNovelStore = create((set, get) => ({
  novels: [],
  currentNovel: null,
  chapters: [],
  currentChapter: null,
  loading: false,
  error: null,

  // 获取小说列表
  fetchNovels: async () => {
    set({ loading: true, error: null })
    try {
      const novels = await novelApi.getList()
      set({ novels, loading: false })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },

  // 上传小说
  uploadNovel: async (file) => {
    set({ loading: true, error: null })
    try {
      const novel = await novelApi.upload(file)
      set((state) => ({
        novels: [novel, ...state.novels],
        loading: false
      }))
      return novel
    } catch (error) {
      set({ error: error.message, loading: false })
      throw error
    }
  },

  // 获取小说详情
  fetchNovelDetail: async (id) => {
    set({ loading: true, error: null })
    try {
      const novel = await novelApi.getDetail(id)
      set({ currentNovel: novel, loading: false })
      
      // 同时获取章节列表
      const chapters = await chapterApi.getByNovel(id)
      set({ chapters })
      
      return novel
    } catch (error) {
      set({ error: error.message, loading: false })
      throw error
    }
  },

  // 选择章节
  selectChapter: (chapter) => {
    set({ currentChapter: chapter })
  },

  // 删除小说
  deleteNovel: async (id) => {
    try {
      await novelApi.delete(id)
      set((state) => ({
        novels: state.novels.filter(n => n.id !== id)
      }))
    } catch (error) {
      set({ error: error.message })
      throw error
    }
  },
}))

export default useNovelStore
```

- [ ] **Step 3: 创建comicStore.js**

```javascript
// frontend/src/stores/comicStore.js
import { create } from 'zustand'
import { comicApi } from '../api/client'

const useComicStore = create((set, get) => ({
  // 章节漫画状态 { chapterId: { status, images } }
  chapterComics: {},
  generatingChapters: new Set(),

  // 生成漫画
  generateComic: async (chapterId) => {
    const state = get()
    if (state.generatingChapters.has(chapterId)) {
      return // 已经在生成中
    }

    set((state) => ({
      generatingChapters: new Set([...state.generatingChapters, chapterId]),
      chapterComics: {
        ...state.chapterComics,
        [chapterId]: { status: 'generating', images: [] }
      }
    }))

    try {
      await comicApi.generate(chapterId)
      
      // 开始轮询状态
      const pollStatus = async () => {
        const status = await comicApi.getStatus(chapterId)
        
        set((state) => ({
          chapterComics: {
            ...state.chapterComics,
            [chapterId]: { status: status.status, images: status.images }
          }
        }))

        if (status.status === 'generating') {
          setTimeout(pollStatus, 2000) // 2秒后再次查询
        } else {
          // 完成或失败，从生成中列表移除
          set((state) => {
            const newSet = new Set(state.generatingChapters)
            newSet.delete(chapterId)
            return { generatingChapters: newSet }
          })
          
          // 如果成功，获取详细图片列表
          if (status.status === 'completed') {
            const images = await comicApi.getImages(chapterId)
            set((state) => ({
              chapterComics: {
                ...state.chapterComics,
                [chapterId]: { status: 'completed', images }
              }
            }))
          }
        }
      }
      
      setTimeout(pollStatus, 1000) // 1秒后开始轮询
      
    } catch (error) {
      set((state) => ({
        generatingChapters: new Set([...state.generatingChapters].filter(id => id !== chapterId)),
        chapterComics: {
          ...state.chapterComics,
          [chapterId]: { status: 'error', images: [] }
        }
      }))
      throw error
    }
  },

  // 获取章节漫画状态
  fetchChapterStatus: async (chapterId) => {
    try {
      const status = await comicApi.getStatus(chapterId)
      set((state) => ({
        chapterComics: {
          ...state.chapterComics,
          [chapterId]: { status: status.status, images: status.images }
        }
      }))
    } catch (error) {
      console.error('获取漫画状态失败:', error)
    }
  },

  // 获取章节漫画图片
  fetchChapterImages: async (chapterId) => {
    try {
      const images = await comicApi.getImages(chapterId)
      set((state) => ({
        chapterComics: {
          ...state.chapterComics,
          [chapterId]: { ...state.chapterComics[chapterId], images }
        }
      }))
      return images
    } catch (error) {
      console.error('获取漫画图片失败:', error)
      return []
    }
  },
}))

export default useComicStore
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/ frontend/src/stores/
git commit -m "feat: 实现API客户端和Zustand状态管理"
```

---

## Task 10: 前端组件实现

**Files:**
- Create: `frontend/src/components/Header.jsx`
- Create: `frontend/src/components/NovelList.jsx`
- Create: `frontend/src/components/UploadModal.jsx`
- Create: `frontend/src/components/NovelReader.jsx`
- Create: `frontend/src/components/ComicViewer.jsx`

**Interfaces:**
- Consumes: useNovelStore, useComicStore
- Produces: 完整的UI组件

- [ ] **Step 1: 创建Header.jsx**

```jsx
// frontend/src/components/Header.jsx
import { Link } from 'react-router-dom'

function Header() {
  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-gray-800">
            🎨 AI漫画生成器
          </Link>
          <nav className="flex items-center space-x-6">
            <Link to="/" className="text-gray-600 hover:text-gray-900">
              小说列表
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}

export default Header
```

- [ ] **Step 2: 创建NovelList.jsx**

```jsx
// frontend/src/components/NovelList.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useNovelStore from '../stores/novelStore'
import UploadModal from './UploadModal'

function NovelList() {
  const { novels, loading, fetchNovels, deleteNovel } = useNovelStore()
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    fetchNovels()
  }, [fetchNovels])

  const handleDelete = async (id, title) => {
    if (window.confirm(`确定要删除《${title}》吗？`)) {
      await deleteNovel(id)
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">我的小说</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          上传小说
        </button>
      </div>

      {novels.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">还没有上传任何小说</p>
          <p className="mt-2">点击上方按钮上传您的第一部作品</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {novels.map((novel) => (
            <div
              key={novel.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                {novel.title}
              </h2>
              <div className="flex items-center text-sm text-gray-500 mb-4">
                <span className={`px-2 py-1 rounded ${
                  novel.status === 'completed' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {novel.status === 'completed' ? '已解析' : '处理中'}
                </span>
              </div>
              <div className="flex space-x-2">
                <Link
                  to={`/novel/${novel.id}`}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded text-center hover:bg-gray-200"
                >
                  阅读
                </Link>
                <Link
                  to={`/comics/${novel.id}`}
                  className="flex-1 bg-purple-500 text-white px-4 py-2 rounded text-center hover:bg-purple-600"
                >
                  漫画集
                </Link>
                <button
                  onClick={() => handleDelete(novel.id, novel.title)}
                  className="bg-red-100 text-red-600 px-4 py-2 rounded hover:bg-red-200"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} />
      )}
    </div>
  )
}

export default NovelList
```

- [ ] **Step 3: 创建UploadModal.jsx**

```jsx
// frontend/src/components/UploadModal.jsx
import { useState } from 'react'
import useNovelStore from '../stores/novelStore'

function UploadModal({ onClose }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const { uploadNovel } = useNovelStore()

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      if (!selected.name.endsWith('.txt')) {
        setError('只支持.txt文本文件')
        return
      }
      if (selected.size > 10 * 1024 * 1024) {
        setError('文件大小不能超过10MB')
        return
      }
      setFile(selected)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('请选择文件')
      return
    }

    setUploading(true)
    setError(null)

    try {
      await uploadNovel(file)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">上传小说</h2>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".txt"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer text-gray-600 hover:text-gray-800"
          >
            {file ? (
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <div>
                <p>点击选择.txt文件</p>
                <p className="text-sm text-gray-500">最大10MB</p>
              </div>
            )}
          </label>
        </div>

        {error && (
          <p className="text-red-500 text-sm mt-2">{error}</p>
        )}

        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            取消
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
          >
            {uploading ? '上传中...' : '上传'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UploadModal
```

- [ ] **Step 4: 创建NovelReader.jsx**

```jsx
// frontend/src/components/NovelReader.jsx
import { useEffect, useRef, useCallback } from 'react'
import useComicStore from '../stores/comicStore'

function NovelReader({ chapters, currentChapter, onChapterChange }) {
  const observerRef = useRef(null)
  const chapterRefs = useRef({})
  const { chapterComics, generateComic } = useComicStore()

  // 设置Intersection Observer监听章节
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const chapterId = entry.target.dataset.chapterId
            const chapter = chapters.find(ch => ch.id === chapterId)
            if (chapter) {
              onChapterChange(chapter)
              
              // 如果该章节还没有漫画，自动触发生成
              const comicStatus = chapterComics[chapterId]
              if (!comicStatus || comicStatus.status === 'pending') {
                generateComic(chapterId)
              }
            }
          }
        })
      },
      {
        root: null,
        rootMargin: '-50% 0px -50% 0px', // 章节进入视口中间时触发
        threshold: 0
      }
    )

    // 观察所有章节
    Object.values(chapterRefs.current).forEach((ref) => {
      if (ref) {
        observerRef.current.observe(ref)
      }
    })

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [chapters, chapterComics, generateComic, onChapterChange])

  const setChapterRef = useCallback((el, chapterId) => {
    chapterRefs.current[chapterId] = el
  }, [])

  return (
    <div className="h-full overflow-y-auto pr-4">
      <h2 className="text-xl font-bold mb-4 sticky top-0 bg-white py-2">
        小说内容
      </h2>
      
      {chapters.map((chapter) => (
        <div
          key={chapter.id}
          ref={(el) => setChapterRef(el, chapter.id)}
          data-chapter-id={chapter.id}
          className={`mb-8 p-4 rounded-lg transition-colors ${
            currentChapter?.id === chapter.id
              ? 'bg-blue-50 border-l-4 border-blue-500'
              : 'bg-gray-50 hover:bg-gray-100'
          }`}
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            {chapter.title}
          </h3>
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {chapter.content}
          </div>
          <div className="mt-3 text-sm text-gray-500">
            第 {chapter.chapter_number} 章
          </div>
        </div>
      ))}
    </div>
  )
}

export default NovelReader
```

- [ ] **Step 5: 创建ComicViewer.jsx**

```jsx
// frontend/src/components/ComicViewer.jsx
import { useEffect } from 'react'
import useComicStore from '../stores/comicStore'

function ComicViewer({ currentChapter }) {
  const { chapterComics, fetchChapterStatus, generateComic } = useComicStore()
  
  const comicData = currentChapter ? chapterComics[currentChapter.id] : null

  useEffect(() => {
    if (currentChapter) {
      fetchChapterStatus(currentChapter.id)
    }
  }, [currentChapter, fetchChapterStatus])

  if (!currentChapter) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg">请在左侧选择一个章节</p>
          <p className="text-sm mt-2">漫画将在此处显示</p>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    if (!comicData || comicData.status === 'pending') {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">该章节尚未生成漫画</p>
          <button
            onClick={() => generateComic(currentChapter.id)}
            className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600"
          >
            生成漫画
          </button>
        </div>
      )
    }

    if (comicData.status === 'generating') {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">正在生成漫画中...</p>
          <p className="text-sm text-gray-500 mt-2">请稍候，这可能需要一些时间</p>
        </div>
      )
    }

    if (comicData.status === 'error') {
      return (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">生成失败</p>
          <button
            onClick={() => generateComic(currentChapter.id)}
            className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600"
          >
            重试
          </button>
        </div>
      )
    }

    if (comicData.status === 'completed') {
      const images = comicData.images || []
      if (images.length === 0) {
        return (
          <div className="text-center py-12 text-gray-500">
            暂无漫画图片
          </div>
        )
      }

      return (
        <div className="grid grid-cols-1 gap-4">
          {images.map((image, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
              <img
                src={`/comics/${currentChapter.id}/panel_${(index + 1).toString().padStart(2, '0')}.png`}
                alt={`分镜 ${index + 1}`}
                className="w-full h-auto"
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            </div>
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <div className="h-full overflow-y-auto pl-4">
      <div className="sticky top-0 bg-white py-2 mb-4">
        <h2 className="text-xl font-bold text-gray-800">
          {currentChapter.title} - 漫画
        </h2>
        <div className="text-sm text-gray-500">
          状态: {comicData?.status || '未知'}
        </div>
      </div>
      
      {renderContent()}
    </div>
  )
}

export default ComicViewer
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: 实现Header、NovelList、UploadModal、NovelReader、ComicViewer组件"
```

---

## Task 11: 页面组件实现

**Files:**
- Create: `frontend/src/pages/HomePage.jsx`
- Create: `frontend/src/pages/NovelPage.jsx`
- Create: `frontend/src/pages/ComicCollectionPage.jsx`

**Interfaces:**
- Consumes: 组件和store
- Produces: 完整的页面

- [ ] **Step 1: 创建HomePage.jsx**

```jsx
// frontend/src/pages/HomePage.jsx
import NovelList from '../components/NovelList'

function HomePage() {
  return (
    <div>
      <NovelList />
    </div>
  )
}

export default HomePage
```

- [ ] **Step 2: 创建NovelPage.jsx**

```jsx
// frontend/src/pages/NovelPage.jsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import useNovelStore from '../stores/novelStore'
import NovelReader from '../components/NovelReader'
import ComicViewer from '../components/ComicViewer'

function NovelPage() {
  const { id } = useParams()
  const { currentNovel, chapters, loading, fetchNovelDetail, selectChapter, currentChapter } = useNovelStore()
  const [activeTab, setActiveTab] = useState('split')

  useEffect(() => {
    fetchNovelDetail(id)
  }, [id, fetchNovelDetail])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!currentNovel) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">小说不存在</p>
        <Link to="/" className="text-blue-500 hover:underline mt-4 block">
          返回首页
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="text-blue-500 hover:underline">
          ← 返回列表
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mt-2">
          {currentNovel.title}
        </h1>
      </div>

      <div className="flex justify-center mb-4 space-x-2">
        <button
          onClick={() => setActiveTab('split')}
          className={`px-4 py-2 rounded ${
            activeTab === 'split'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          分屏模式
        </button>
        <button
          onClick={() => setActiveTab('novel')}
          className={`px-4 py-2 rounded ${
            activeTab === 'novel'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          仅小说
        </button>
        <button
          onClick={() => setActiveTab('comic')}
          className={`px-4 py-2 rounded ${
            activeTab === 'comic'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          仅漫画
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md" style={{ height: 'calc(100vh - 250px)' }}>
        {activeTab === 'split' && (
          <div className="grid grid-cols-2 h-full divide-x">
            <div className="h-full overflow-hidden">
              <NovelReader
                chapters={chapters}
                currentChapter={currentChapter}
                onChapterChange={selectChapter}
              />
            </div>
            <div className="h-full overflow-hidden">
              <ComicViewer currentChapter={currentChapter} />
            </div>
          </div>
        )}
        
        {activeTab === 'novel' && (
          <div className="h-full overflow-hidden">
            <NovelReader
              chapters={chapters}
              currentChapter={currentChapter}
              onChapterChange={selectChapter}
            />
          </div>
        )}
        
        {activeTab === 'comic' && (
          <div className="h-full overflow-hidden">
            <ComicViewer currentChapter={currentChapter} />
          </div>
        )}
      </div>
    </div>
  )
}

export default NovelPage
```

- [ ] **Step 3: 创建ComicCollectionPage.jsx**

```jsx
// frontend/src/pages/ComicCollectionPage.jsx
import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import useNovelStore from '../stores/novelStore'
import useComicStore from '../stores/comicStore'

function ComicCollectionPage() {
  const { id } = useParams()
  const { currentNovel, chapters, fetchNovelDetail } = useNovelStore()
  const { chapterComics, fetchChapterStatus } = useComicStore()

  useEffect(() => {
    fetchNovelDetail(id)
  }, [id, fetchNovelDetail])

  useEffect(() => {
    // 获取所有章节的漫画状态
    chapters.forEach((chapter) => {
      fetchChapterStatus(chapter.id)
    })
  }, [chapters, fetchChapterStatus])

  if (!currentNovel) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }

  const completedChapters = chapters.filter((ch) => {
    const comic = chapterComics[ch.id]
    return comic && comic.status === 'completed' && comic.images?.length > 0
  })

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="text-blue-500 hover:underline">
          ← 返回列表
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mt-2">
          {currentNovel.title} - 漫画集
        </h1>
        <p className="text-gray-500 mt-1">
          已完成 {completedChapters.length} / {chapters.length} 章
        </p>
      </div>

      {completedChapters.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-500 mb-4">还没有生成任何漫画</p>
          <Link
            to={`/novel/${id}`}
            className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 inline-block"
          >
            去生成漫画
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {completedChapters.map((chapter) => {
            const comic = chapterComics[chapter.id]
            return (
              <div key={chapter.id} className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  {chapter.title}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {comic.images.map((panel, index) => (
                    <div key={panel.id || index} className="bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={`/comics/${chapter.id}/panel_${(panel.panel_index || index + 1).toString().padStart(2, '0')}.png`}
                        alt={`${chapter.title} - 分镜 ${panel.panel_index || index + 1}`}
                        className="w-full h-auto"
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                      <div className="p-2 text-sm text-gray-600">
                        第 {panel.panel_index || index + 1} 幕
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ComicCollectionPage
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/
git commit -m "feat: 实现HomePage、NovelPage、ComicCollectionPage页面组件"
```

---

## Task 12: Docker配置与部署

**Files:**
- Create: `Dockerfile.backend`
- Create: `Dockerfile.frontend`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: 前后端项目
- Produces: Docker容器化部署配置

- [ ] **Step 1: 创建Dockerfile.backend**

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# 安装依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY backend/ .

# 创建必要目录
RUN mkdir -p uploads comics

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: 创建Dockerfile.frontend**

```dockerfile
FROM node:18-alpine as builder

WORKDIR /app

# 安装依赖
COPY frontend/package*.json ./
RUN npm ci

# 复制代码并构建
COPY frontend/ .
RUN npm run build

# 生产环境
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 3: 创建nginx.conf**

```nginx
server {
    listen 80;
    server_name localhost;
    
    # 前端静态文件
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # API代理
    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # 漫画图片代理
    location /comics {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
    }
    
    # 上传文件代理
    location /uploads {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
    }
}
```

- [ ] **Step 4: 创建docker-compose.yml**

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: novel-comic-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY}
    volumes:
      - ./data/uploads:/app/uploads
      - ./data/comics:/app/comics
      - ./data/novels.db:/app/novels.db
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: novel-comic-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  uploads:
  comics:
```

- [ ] **Step 5: 创建.dockerignore**

```
node_modules
.git
.env
__pycache__
*.pyc
.DS_Store
```

- [ ] **Step 6: 创建.env.production**

```env
DASHSCOPE_API_KEY=your_api_key_here
```

- [ ] **Step 7: 构建并启动容器**

```bash
docker-compose up -d --build
```

- [ ] **Step 8: 验证服务运行**

```bash
docker-compose ps
curl http://localhost:8000/health
```

- [ ] **Step 9: Commit**

```bash
git add Dockerfile.* docker-compose.yml nginx.conf .dockerignore
git commit -m "feat: 添加Docker容器化配置，支持一键部署"
```

---

## Task 13: 集成测试与调试

**Files:**
- Create: `tests/test_api.py`
- Create: `tests/test_agents.py`

**Interfaces:**
- Consumes: 完整的后端API
- Produces: 测试验证

- [ ] **Step 1: 创建test_api.py**

```python
# tests/test_api.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_upload_novel():
    # 创建测试文件
    content = """第一章 初遇
    
    小明遇见了小红。

第二章 离别
    
    小红离开了。"""
    
    files = {"file": ("test.txt", content.encode('utf-8'), "text/plain")}
    response = client.post("/api/novels/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["status"] == "completed"

def test_list_novels():
    response = client.get("/api/novels/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

- [ ] **Step 2: 创建test_agents.py**

```python
# tests/test_agents.py
import pytest
import asyncio
from app.agents.novel_parser import NovelParserAgent
from app.agents.comic_script import ComicScriptAgent

@pytest.mark.asyncio
async def test_novel_parser():
    agent = NovelParserAgent()
    content = """第一章 测试
    
    这是测试内容。

第二章 验证
    
    验证通过。"""
    
    chapters = await agent.parse_novel(content)
    assert len(chapters) >= 1
    assert "title" in chapters[0]
    assert "content" in chapters[0]

@pytest.mark.asyncio
async def test_comic_script():
    agent = ComicScriptAgent()
    content = "小明站在山顶，眺望远方的城市。"
    
    panels = await agent.generate_script(content)
    assert len(panels) >= 1
    assert "scene" in panels[0]
```

- [ ] **Step 3: 运行测试**

```bash
cd backend
pytest tests/ -v
```

- [ ] **Step 4: 修复发现的问题**

根据测试结果修复任何bug。

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "feat: 添加API和Agent单元测试"
```

---

## Task 14: 文档与README

**Files:**
- Create: `README.md`
- Create: `docs/API.md`
- Create: `docs/DEPLOYMENT.md`

**Interfaces:**
- Consumes: 项目代码
- Produces: 项目文档

- [ ] **Step 1: 创建README.md**

```markdown
# AI小说生成漫画

基于AgentScope的Web应用，将纯文本小说智能转换为日漫风格漫画。

## 功能特性

- 上传纯文本小说，AI智能分章
- 为每个章节生成日漫风格漫画
- 实时预览：左侧小说内容，右侧漫画展示
- 漫画集管理与导出

## 技术栈

- 后端: Python, FastAPI, AgentScope
- 前端: React, Vite, Tailwind CSS
- AI模型: qwen3.8-max (文本), 通义万相 (图片)

## 快速开始

### 开发环境

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# 前端
cd frontend
npm install
npm run dev
```

### Docker部署

```bash
docker-compose up -d --build
```

## 环境变量

在项目根目录创建 `.env` 文件:

```env
DASHSCOPE_API_KEY=your_api_key_here
```

## API文档

启动后端后访问: http://localhost:8000/docs

## 许可证

MIT License
```

- [ ] **Step 2: 创建API文档**

```markdown
# API文档

## 小说管理

### POST /api/novels/upload
上传小说文件

### GET /api/novels/
获取小说列表

### GET /api/novels/{id}
获取小说详情

### DELETE /api/novels/{id}
删除小说

## 章节管理

### GET /api/novels/{novel_id}/chapters
获取小说的所有章节

### GET /api/chapters/{id}
获取章节详情

## 漫画生成

### POST /api/comics/generate
触发章节漫画生成

### GET /api/comics/{chapter_id}/status
查询生成状态

### GET /api/comics/{chapter_id}/images
获取章节漫画图片
```

- [ ] **Step 3: 创建部署文档**

```markdown
# 部署指南

## 阿里云ECS部署

### 1. 安装Docker

```bash
sudo yum install docker
sudo systemctl start docker
sudo systemctl enable docker

# 安装docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 克隆项目

```bash
git clone <repository_url>
cd agent-scope-dev
```

### 3. 配置环境变量

```bash
cp .env.production .env
# 编辑.env文件，填入API密钥
```

### 4. 启动服务

```bash
docker-compose up -d --build
```

### 5. 配置域名和HTTPS

使用Nginx反向代理并配置SSL证书。
```

- [ ] **Step 4: Commit**

```bash
git add README.md docs/
git commit -m "feat: 添加项目文档和部署指南"
```

---

## 完成

所有任务完成后，项目将具备：

1. 完整的后端API，支持小说上传、解析、漫画生成
2. 响应式前端界面，支持分屏实时预览
3. Docker容器化部署配置
4. 单元测试和文档

运行方式：

```bash
# 开发环境
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev

# 生产环境
docker-compose up -d
```

访问 http://localhost:5173 (开发) 或 http://localhost (生产) 开始使用。
