# Maneko 产品完整性与上架准备实施计划

## 当前执行状态（2026-10-09）

已落实：Web 与移动 Web 的纸墨主题、真实 API 默认行为、隐私说明、上传/就绪检查、漫画 ZIP 导出、分镜部分失败/中断状态和重生成回滚、持久化部署配置及 Android 签名/发布预检。离线验证：后端 64 项、移动端 4 项、前端 2 项通过；Web lint/build、Compose/Render YAML、Android XML 资源引用和发布脚本语法校验通过。

尚未达到“可公开多人服务/可直接上架”：后端目前没有账号与数据隔离，公开部署会共享同一书库；已向产品负责人确认采用账号隔离还是个人私有 API + 网络访问控制。当前环境仅安装 Android SDK 34，未安装项目要求的 API 36，因此无法构建 Android 包；真实生产 API、模型凭据/额度、签名密钥、公开隐私政策联系信息及真实模型端到端验收也未提供。浏览器自动化依赖不可用，尚无 Playwright 页面截图验收。

开始执行前工作区已存在的 CORS origin、启动器图标及 Playwright/素材文件属于用户现有改动；提交时必须排除，不得覆盖或清理。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Maneko 的 Web、移动 Web 与 Android 正式版本能通过真实后端完成小说导入、书库管理、漫画生成和结果查看，并达到可重复构建与商店审核准备状态。

**Architecture:** 保留 FastAPI + SQLAlchemy、React/Vite 桌面前端、maneko-app 移动 Web 和 Capacitor Android 架构。先用真实链路盘点找出缺失/假成功，再修后端可靠性、前端恢复状态、发布 API 配置和 Android 签名；视觉通过共享语义色彩规则在 React 与移动 Web 两个 UI 中分别落地。

**Tech Stack:** Python 3.11、FastAPI、SQLAlchemy、pytest；React 19、Vite、Zustand、oxlint；Vanilla JS/CSS 移动 Web；Capacitor 6、Gradle、Android SDK；Playwright 可用于真实浏览器验收。

---

## 文件与职责地图

- `backend/app/main.py`：存活/就绪诊断与配置目录静态挂载。
- `backend/app/config.py`、`backend/app/routers/novels.py`：生产设置和上传边界。
- `backend/app/services/novel_service.py`、`comic_service.py`、`library_service.py` 及相应 routers：核对真实业务状态、失败恢复、可读来源与导出。
- `backend/tests/`：对回归链路加隔离测试，不触发真实付费模型。
- `frontend/src/index.css`、`frontend/src/components/*`、`frontend/src/pages/*`：React 站的低刺激主题、状态反馈和隐私入口。
- `maneko-app/js/core.js`、`js/app.js`、`css/*`、`index.html`：移动产品真实 API 默认行为、演示数据隔离、任务反馈和主题。
- `mobile-native/android/app/build.gradle`、manifest、strings、`scripts/build-apk.ps1`：版本号、生产 API 预检、签名 AAB 构建。
- `render.yaml`、`Dockerfile.backend`、`backend/.env.example`：生产运行时和持久化配置。
- `docs/PRIVACY.md`、`docs/STORE_LISTING.md`、`docs/RELEASE.md`、`README.md`：与实现一致的上架披露与发布手册。
- `backend/tests/test_health.py`、`test_upload_limits.py`、端到端验收脚本：新增的发布门槛检查。

## Task 1: 建立真实功能清单与可复现基线

**Files:**
- Inspect: `backend/app/routers/*.py`, `backend/app/services/*.py`, `frontend/src/**`, `maneko-app/**`, `mobile-native/**`
- Modify: `docs/superpowers/specs/2026-10-08-app-store-readiness-design.md`
- Modify: this plan as findings require

- [ ] 列出“上传/粘贴 → 分章 → 阅读 → 选风格 → 生成任务 → 轮询状态 → 查看/导出图片 → 书库搜索/导入/收藏/分类/进度”在每个入口的按钮、请求 URL、响应字段和空/错误状态。
- [ ] 用 `rg` 检查演示分支、假数据、mock provider 和吞异常逻辑；逐一标明只允许开发/预览、正式构建是否错误暴露。
- [ ] 检查后端 API 和各前端参数/返回结构是否一致，列出确定的断链并为每条选择最小回归测试。
- [ ] 运行已有离线测试、React lint/build 和移动端静态检查，记录基线失败；真实模型测试明确排除并记录依赖条件。
- [ ] 不修改尚未确认的行为；发现的完整性缺口反映在本计划具体任务。

## Task 2: 修复后端生产可靠性与持久化边界

**Files:**
- Modify: `backend/app/main.py`, `backend/app/config.py`, `backend/app/routers/novels.py`
- Modify: `render.yaml`, `Dockerfile.backend`, `backend/.env.example`
- Create: `backend/tests/test_health.py`, `backend/tests/test_upload_limits.py`

- [ ] 先检查上传限制和路径配置现状，再写 `/health` 存活、`/ready` 数据库连接测试，包含数据库失败时 503。
- [ ] 运行新测试确认 readiness 失败，再实现短连接 `SELECT 1`；存活检查不依赖 AI 服务。
- [ ] 添加超限上传测试（超限返回 413、边界文件可被接收、失败后没有残留部分文件），然后实现流式限制，避免一次性读入超大文件。
- [ ] 让 `/uploads` 与 `/comics` 静态目录引用 settings 中路径；测试自定义目录工作。
- [ ] 修正 Render 健康路径和 disk mount：SQLite、uploads、comics 必须落到持久盘；文档明确单实例限制，避免误用临时盘。
- [ ] 用精确 CORS origins 替换无效 `https://*.vercel.app` 示例，校验生产配置不接受通配符。
- [ ] 运行新测试、现有非外部测试和 API 集成测试。

## Task 3: 保证小说与书库链路完整、失败可恢复

**Files:**
- Modify as findings require: `backend/app/routers/novels.py`, `chapters.py`, `library.py`
- Modify as findings require: `backend/app/services/novel_service.py`, `library_service.py`, `book_sources.py`
- Modify as findings require: `frontend/src/components/UploadModal.jsx`, `NovelReader.jsx`, `LibraryPage.jsx`, stores
- Modify as findings require: `maneko-app/js/core.js`, `js/app.js`
- Add regression tests under `backend/tests/` and UI tests only if current harness can run offline

- [ ] 验证 TXT/MD 上传和粘贴两条路径都创建真实 Novel/Chapter 记录；无 AI 凭据时本地切章明确标注本地解析策略且保留内容。
- [ ] 验证章节阅读的空态、加载态和错误态；上传/解析失败时前端不清空用户输入且可重试。
- [ ] 验证 Gutenberg/Wikisource/URL 等实际实现的来源、搜索与导入响应；热门网文元数据不得伪装为有正文。
- [ ] 验证分类、收藏、阅读进度服务端/本地存储边界；Android 与 Web 使用同一 API 功能时不能隐藏后端错误。
- [ ] 确认移动 Web 生产默认真实 API 模式；断网时提供明确离线态，演示数据仅由显式预览开关启用且与真实书架分开。
- [ ] 为每个确认的缺陷先添加失败测试，再作最小修复，按目标测试文件运行红绿验证。

## Task 4: 保证异步漫画生成完整可观察

**Files:**
- Modify as findings require: `backend/app/routers/comics.py`, `backend/app/services/comic_service.py`, `backend/app/agents/comic_generator.py`
- Modify as findings require: `frontend/src/stores/comicStore.js`, `ComicViewer.jsx`, `ComicCollectionPage.jsx`, `NovelPage.jsx`
- Modify as findings require: `maneko-app/js/core.js`, `js/app.js`
- Add/modify: tests under `backend/tests/test_comic_*.py`

- [ ] 用真实响应契约验证生成接口将章节状态置为 queued/generating/completed/error，前端轮询终止条件与后端一致。
- [ ] 检查 provider 调用失败、部分 panel 成功、进程中断重启和图片路径恢复；用户可看到失败原因并触发安全重试，不重复破坏已有 panel。
- [ ] 确认所有风格选择传到真实生成 prompt，结果漫画页和章节阅读页从 API/持久文件读图。
- [ ] 验证漫画查看、长图/图片导出行为；Android WebView 对图片 URL 使用配置 API origin，不依赖桌面代理。
- [ ] 生产构建预检拒绝 `IMAGE_PROVIDER=mock`、空/占位模型 key，或在应用内明确阻断生成并禁止对外宣称完整可用；mock 只供测试。
- [ ] 为状态转换、partial failure 和 retry 添加失败先行测试并运行。

## Task 5: 将霓虹主题改为舒适阅读型视觉系统

**Files:**
- Modify: `frontend/src/index.css` 与 React 页面/组件中硬编码颜色
- Modify: `maneko-app/css/*.css`, `index.html` 与可见主题 token 使用处
- Modify only if active entry requires: `frontend/public/styles/neon-tokyo.css`, `frontend/public/neon.html`
- Create: `docs/superpowers/specs/` 已有规格中的主题 token 说明；无需新增设计稿

- [ ] 从产品语境确定“纸墨阅读底色 + 石板中性色 + 克制珊瑚/青绿强调色”，正文背景与漫画画面保持清晰分区，取消大面积荧光文字、发光阴影和高饱和渐变。
- [ ] 在两套前端分别定义同名语义 token（page/surface/raised/text/muted/border/primary/accent/success/warning/danger/focus），组件不再散落写 HEX。
- [ ] 先为主要状态/文字配色建立可读性检查清单，再替换颜色；确保一般文本对比度 ≥4.5:1，大字和控件边缘 ≥3:1。
- [ ] React 覆盖首页、上传弹窗、书库、阅读页、漫画集、风格选择、加载/错误态；移动 Web 覆盖书架、书源、阅读、工作台、漫画集、我的页。
- [ ] 保留品牌插画/漫画本身色彩，不加全局滤镜；不让主题遮盖或染色生成图像。
- [ ] 加 `prefers-reduced-motion` 支持，修复键盘焦点和窄屏 320px 横向溢出；检查 touch target 至少 44px。
- [ ] 运行 oxlint/build，使用 Playwright 截取主要页面于 320/768/1440px；对比主题前后并做色值对比度计算。

## Task 6: 统一 API 错误反馈并提供真实隐私说明

**Files:**
- Modify: `frontend/src/api/client.js`, `frontend/src/App.jsx`, navigation/footer
- Create: `frontend/src/pages/PrivacyPage.jsx`, `docs/PRIVACY.md`
- Modify: `maneko-app/js/core.js`, `js/app.js`, view templates as needed

- [ ] 增加共用 API 错误格式化：网络离线、413、后端 4xx detail、5xx、生成任务失败分别给用户动作提示，不输出堆栈。
- [ ] 隐私说明从上传前入口可达，真实描述文本、prompt、图片去向、第三方模型供应商、部署者存储/保留策略、用户删除路径、无账号/无 analytics 的事实（经代码核实后再写）。
- [ ] 移动端真实模式下设置 API 地址、连接状态和测试连接；不得把离线演示误显示为生产已连接。
- [ ] 对关键状态使用语义 HTML、aria-live/alert、可见 focus；检查现有上传表单 label 与错误关联。
- [ ] 运行 lint/build 与相关浏览器冒烟流程。

## Task 7: 建立 Android 真实服务发布构建

**Files:**
- Modify: `mobile-native/android/app/build.gradle`, manifest, strings, app resources
- Modify: `scripts/build-apk.ps1`, `scripts/build-apk-www.ps1`
- Modify: `mobile-native/package.json`, `.gitignore`
- Create: `mobile-native/android/keystore.properties.example`

- [ ] 检查 Capacitor config、同步脚本和构建产物来源，确保商店 APK/AAB 从当前 `maneko-app` 真实 API 产品生成，不误打包开发用 React demo。
- [ ] 版本号与 applicationId 稳定；签名从 gitignored 本机属性或环境变量取，release 无签名信息时给清楚失败原因。
- [ ] 发布构建要求 HTTPS 生产 API Base URL 并验证不是 localhost/占位地址；显式设置移动端非 demo 配置。
- [ ] 增加签名 AAB 命令，保留 debug APK 命令；不生成或提交密钥文件。
- [ ] 检查应用标签、启动 activity、target SDK、图标/自适应图标、Android cleartext traffic；修正测试域配置泄漏到 release 的情况。
- [ ] 在可用的 Android SDK/JDK 环境中构建 debug APK；若用户没有 keystore，不伪称签名 AAB 已验证，改验证预检失败信息。

## Task 8: 完善生产配置、隐私披露和商店材料

**Files:**
- Modify: `docs/RELEASE.md`, `README.md`, `render.yaml`, `Dockerfile.backend`, `frontend/vercel.json` as findings require
- Create: `docs/PRIVACY.md`, `docs/STORE_LISTING.md`

- [ ] 校正 Python runtime、数据库和持久 disk 位置、CORS、Render/Vercel API 地址、AI provider 生产要求。
- [ ] 为商店起草短/长描述、截图清单、内容分级核对、数据安全问卷映射、支持/隐私 URL 待发布字段；只写代码可证实的数据行为。
- [ ] 标注删除路径确实存在的范围；没有账号则说明无账号系统，不虚构账户删除流程。
- [ ] 将外部前置项单列：开发者账号、公开政策 URL、生产域名/模型 key、签名密钥备份、地区法规检查、商店审核。
- [ ] 搜索并处理文档中 `/tmp` 持久化错误、无效 wildcard CORS、默认 mock、演示模式上架指令等过期表述。

## Task 9: 发布验收、审查与推送

**Files:** all scoped implementation files.

- [ ] 跑完整后端离线测试；准确列出因真实模型凭据而跳过的用例。
- [ ] 跑 `frontend` 的 `npm run lint` 和 `npm run build`；跑 Android debug 构建和 release preflight。
- [ ] 若有可用生产 API 凭据与持久化环境，跑端到端上传 → 分章 → 生成 → 阅读/导出；若没有，此项标记为外部阻断，不得声称完整验收通过。
- [ ] 用 Playwright 检查桌面 React 与移动 Web 的主要页面、真实/离线模式区别、关键动作错误态、320px 和 1440px 布局；记录截图位置。
- [ ] 重新读规格并逐条打勾；跑 `git diff --check`、检查完整 diff、密钥与生成文件。
- [ ] 只暂存本轮 scoped 文件；开始前的配置/图标/素材/Playwright 用户文件保持原状且不进入 commit。
- [ ] 核实当前分支、远端上游和 ahead/behind；提交经验证改动并推送 `origin/maneko-app`，不强推、不覆盖远端提交。
- [ ] 汇报提交/推送结果、测试证据及未满足的生产凭据/商店外部前置条件。
