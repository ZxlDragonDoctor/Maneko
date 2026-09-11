# AGENTS.md

AI 小说 → 日漫分镜漫画生成器。双仓布局，无 monorepo 工具、无 CI。

## Layout

| Path | Role |
|------|------|
| `backend/` | FastAPI 应用。真实入口是 `backend/app/main.py`（模块名 `app.main:app`） |
| `frontend/` | React 19 + Vite + Tailwind + Zustand；lint 用 **oxlint**，不是 ESLint |
| `docs/` | API / 部署说明；设计文档在 `docs/superpowers/` |
| 根目录 `main.py` | AgentScope **示例脚本**，不是 Web 应用入口。别改它当“后端 main” |
| `start-dev.ps1` | Windows 一键起本地开发（backend **8001** + frontend 5173） |

## Run (local dev)

**后端必须在 `backend/` 目录下启动。** CWD 决定 `.env`、`uploads/`、`comics/`、`./novels.db` 的位置；在仓库根跑 uvicorn 会找错配置和数据。

```powershell
# backend (from backend/)
py -3.11 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# frontend (from frontend/)
npm run dev          # 5173；vite 把 /api 与 /comics 代理到 http://localhost:8001
npm run lint         # oxlint
npm run build
```

或在仓库根：`.\start-dev.ps1`

**端口不要混：**

- 本地开发：backend **8001**，frontend **5173**（`vite.config.js` 写死了 8001）
- Docker：backend **8000**，frontend **80**（`Dockerfile.backend` / `nginx.conf`）
- README 里的 `uvicorn app.main:app --reload` 不带端口，会默认 8000，和前端代理不一致

Docker：`docker-compose up -d --build`（需先设 `DASHSCOPE_API_KEY`）

## Config / env

- 配置在 `backend/app/config.py`（pydantic-settings，`env_file=".env"` → **`backend/.env`**，不是根目录）
- 模板：`backend/.env.example`。必填：`DASHSCOPE_API_KEY`
- 默认 `DATABASE_URL=sqlite:///./novels.db`（相对 CWD → `backend/novels.db`）
- 启动时 `Base.metadata.create_all` 建表；`requirements.txt` 里有 alembic，但**没有** migration 目录/流程
- 图片提供方 `IMAGE_PROVIDER`: `mock`（默认，离线）| `mimo` | `wanx` | `qwen`（DashScope，模型默认 `qwen-image-3.0`）
- Qwen 出图：`QWEN_IMAGE_MODEL` / `QWEN_IMAGE_SIZE` / `QWEN_IMAGE_MODE`（`sdk`|`http`|`openai`）见 `image_providers.QwenImageProvider`
- 出图风格在 `backend/app/agents/comic_style.py`：**按小说类型预设**（修仙/武侠/科幻/悬疑/… + `auto` 关键词识别），前端可选手动分类；API：`/api/comics/styles`、`/detect-style`、`generate` 带 `style_id`
- 个人书库 `/api/library/*`：书源（builtin/popular/gutenberg/wikisource/url）、分类、收藏、进度；`schema_migrate.py` 启动时 ALTER 补列
- **Gutenberg 真库**：官方 `pg_catalog.csv`（约 7.9 万本）缓存到 `backend/data/pg_catalog.json`；启动预热 + `POST /api/library/sources/gutenberg/catalog`；全文 `cache/epub/{id}/pg{id}.txt`
- 热门网文（龙族/斗罗/诡秘等）仅**元数据索引**，无全文；`GET /api/library/search` 聚合检索；版权书请本地上传
- MiMo 出图配置：`MIMO_IMAGE_BASE_URL` / `MIMO_IMAGE_API_KEY` / `MIMO_IMAGE_MODEL`（见 `app/agents/image_providers.py`）
- 本地联调脚本：`backend/scripts/mimo_image_mock_server.py`（OpenAI 兼容 mock）+ `backend/scripts/demo_mimo_http.py`

## Tests

```powershell
# from backend/；pytest / pytest-asyncio 不在 requirements.txt，需另装
python -m pytest tests/ -v
```

- `tests/test_agents.py` 走真实 DashScope（无 mock），没有 key 会失败
- `tests/test_api.py::test_upload_novel` 在请求路径里同步调用解析 agent，同样依赖可用的 key
- 没有 fixture / 测试数据库隔离；会碰本地 `novels.db` 与 `uploads/`、`comics/`

## Architecture (what filenames don't say)

上传链路是同步 AI：

1. `POST /api/novels/upload`（接受 `.txt`/`.md`）→ `NovelService.upload_novel` → `NovelParserAgent`（有有效 key 走 qwen，否则 `split_chapters_locally`）→ 写入 `Chapter`
2. `POST /api/comics/generate` → FastAPI `BackgroundTasks` → `ComicScriptAgent`（同样有本地分镜回退）→ `ComicGeneratorAgent`（经 `IMAGE_PROVIDER` 出图）
3. 图片落到 `comics/<chapter_id>/panel_XX.png`，路径存 DB；静态挂载 `/comics`、`/uploads`

Agent 实现都在 `backend/app/agents/`，用 **AgentScope 新 API**（`agentscope.agent.Agent` + `DashScopeChatModel` + `UserMsg`），不是旧版 `agentscope.message` 风格。

前端 API 客户端：`frontend/src/api/client.js`（axios，baseURL `/api`，response interceptor 已解包 `response.data`）。

## Gotchas

- 没有 CI、pre-commit、typecheck；前端没有独立 test script
- `DASHSCOPE_API_KEY` 为空或仍是 `your-...` 占位符时，分章/分镜走本地正则回退；出图默认 `IMAGE_PROVIDER=mock`
- 生成失败时 agent 会 `print` 后继续，章节/分镜可能 `error` 或部分 `None` 路径——不是硬失败
- NovelReader 仅渲染 `chapters`；无章节时才显示 `novel.content` 全文兜底
- 不要提交 `.env`、`*.db`、`uploads/`、`comics/`（见 `.gitignore`）
- 根目录 `main.py` 里有示例用的明文 key：不要复制到代码/文档，也不要当可运行入口依赖
- 文档优先级：可执行配置（`vite.config.js`、`start-dev.ps1`、Dockerfile）> README/API.md（端口等表述已过时）
