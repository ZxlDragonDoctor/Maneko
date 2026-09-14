# Maneko 发布指南：Vercel（前端/移动壳） + Render（后端 API） + APK

## 架构（免费可跑）

```
┌─────────────────────┐     ┌──────────────────────┐
│  Vercel (Free)      │     │  Render Free Web     │
│  · React 前端       │────▶│  FastAPI + SQLite    │
│  · android-app 壳   │ API │  DashScope 出图      │
└─────────────────────┘     └──────────────────────┘
         │
         ▼ 打包进
┌─────────────────────┐
│  Android APK        │
│  Capacitor 6        │
│  mobile-native/     │
└─────────────────────┘
```

说明：Vercel 只适合静态/Serverless，**不能**长期跑 uvicorn + 写本地漫画文件。  
后端请用 **Render / Railway / Fly.io / Zeabur** 等免费 Web Service。

---

## 一、后端 → Render（免费）

1. 打开 [render.com](https://render.com) → New → **Web Service**
2. 连接 GitHub 仓库 `ZxlDragonDoctor/Maneko`
3. 设置：
   - Runtime: **Docker**
   - Dockerfile: `Dockerfile.backend`
   - Health Check: `/health`
4. 环境变量：

| Key | 示例 |
|-----|------|
| `DASHSCOPE_API_KEY` | `sk-xxx` |
| `IMAGE_PROVIDER` | `qwen` 或 `mock` |
| `DATABASE_URL` | `sqlite:////tmp/novels.db` |
| `UPLOAD_DIR` | `/tmp/uploads` |
| `COMIC_DIR` | `/tmp/comics` |
| `CORS_ORIGINS` | `https://maneko.vercel.app,https://*.vercel.app` |

5. 部署后得到：`https://maneko-api.onrender.com`  
6. 打开 `https://maneko-api.onrender.com/docs` 验证

仓库根已有 `render.yaml`，也可 Blueprint 一键建服务。

> Free 实例会休眠，首次请求可能 30s+；生产可换付费或 Fly。

---

## 二、前端 → Vercel（免费）

### 方案 A：React 全功能站（推荐）

1. [vercel.com](https://vercel.com) → Import Git Repo  
2. Root Directory 选 **`frontend`**  
3. Build：`npm run build`，Output：`dist`  
4. 环境变量（可选，用于本机直连）：
   - 一般用 `frontend/vercel.json` 的 rewrite 到后端即可  
5. 把 `frontend/vercel.json` 里的  
   `https://maneko-api.onrender.com`  
   改成你的 Render 域名  

部署成功后访问：`https://<project>.vercel.app`

### 方案 B：只部署安卓壳（演示 PWA）

1. Root Directory 选 **`android-app`**  
2. Framework: Other，无构建  
3. 得到可「添加到主屏幕」的移动 Web  

生产请用方案 A。

---

## 三、真 APK（Capacitor）

### 本机要求

- Node 18+
- **Android Studio** + Android SDK（API 34+）
- JDK 17（你本机已有）

### 步骤

```powershell
cd mobile-native
npm install
# 首次生成原生工程
npx cap add android

# 把 android-app 拷进 www 并同步
powershell -File ..\scripts\build-apk-www.ps1
npx cap sync android

# 调试包
cd android
.\gradlew assembleDebug
# 输出：android\app\build\outputs\apk\debug\app-debug.apk
```

或一键：

```powershell
.\scripts\build-apk.ps1
```

### 连生产后端

编辑 `android-app/index.html`（或打包前改 `www/index.html`）中默认 API：

```js
// 在「我的」页粘贴，或改 localStorage 默认值
// 推荐打包前写入生产默认：
localStorage.setItem('maneko_api_base', 'https://maneko-api.onrender.com');
localStorage.setItem('maneko_mobile_demo', '0');
```

更干净的做法：在 `index.html` 的 `state` 初始化里改成你的生产域名。

### 正式签名 release APK

```powershell
# 生成 keystore（只需一次）
keytool -genkey -v -keystore maneko.keystore -alias maneko -keyalg RSA -keysize 2048 -validity 10000

# 在 android/app/build.gradle 配置 signingConfigs 后
cd android
.\gradlew assembleRelease
# 输出：app-release.apk
```

上架 Google Play 还需：开发者账号 $25、隐私政策页、数据安全表单。

---

## 四、上线检查清单

- [ ] Render `/health` 返回 healthy  
- [ ] Vercel 站点能打开 React UI  
- [ ] Vercel `/api/novels/` 经 rewrite 到 Render 成功  
- [ ] 上传小说 → 生成漫画（`IMAGE_PROVIDER=qwen`）  
- [ ] CORS 已加 Vercel 域名  
- [ ] APK 安装后可连 Render API  
- [ ] **已轮换**曾出现在代码里的 DashScope Key  

---

## 五、常见问题

| 问题 | 处理 |
|------|------|
| Vercel 404 API | 检查 `vercel.json` rewrite 目标域名 |
| CORS 报错 | Render 环境变量 `CORS_ORIGINS` 加 Vercel 域名 |
| APK 网络失败 | HTTPS API；Android 9+ 需 HTTPS 或 `usesCleartextTraffic` |
| 生成无图 | 看 Render Logs；确认 `DASHSCOPE_API_KEY` 与 `IMAGE_PROVIDER` |
| 免费休眠 | 首次冷启动等待；或换付费实例 |
