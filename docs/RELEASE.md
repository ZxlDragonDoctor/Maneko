# Maneko 发布手册

此仓库可以构建 Web 与 Android 发布候选；商店提交前仍需真实生产 API、持久存储、模型额度、签名密钥、公开隐私政策和发布者/法律审核。Android release 构建会先请求 API `/ready`，确认服务端不是 mock 且数据库、分章模型与图像提供方均已配置。

## 1. 部署生产 API

### Render Blueprint

仓库根目录的 `render.yaml` 使用 Docker、`/ready`、`/var/data` 持久盘以及单实例 SQLite。Blueprint 中 `DASHSCOPE_API_KEY` 需要在 Render 控制台设置；`IMAGE_PROVIDER` 使用真实提供方，默认配置为 Qwen。此方案采用付费 Starter 实例，因为临时盘不能承载书籍、数据库和生成图片；扩容多实例前须迁移到共享数据库与对象存储。

在 Render 设置精确的 `CORS_ORIGINS` JSON 数组，只写真实 Web origin，不支持通配符。例如：

```text
["https://你的前端域名","capacitor://localhost","https://localhost"]
```

发布前检查：

1. `GET https://你的 API/health` 返回进程存活。
2. `GET https://你的 API/ready` 返回 `{"status":"ready"}`。503 会指出数据库、DashScope 分章模型、模拟图像提供方或图像凭据配置缺失；不会泄露密钥。
3. 确认 `DATABASE_URL`、`UPLOAD_DIR`、`COMIC_DIR` 都落在持久化位置，并建立备份/保留策略。
4. 验证 upload → 分章 → 阅读 → 生成 → 轮询 → 预览 → ZIP 导出。正式验收必须用真实模型和独立测试书籍，不能用 mock 结果替代。

### 自行部署

后端应用入口是 `app.main:app`，必须从 `backend/` 工作目录启动，默认本地端口 8001。容器使用 Python 3.11，端口 8000。环境变量模板见 `backend/.env.example`。正式环境至少需要真实 DashScope key、非 `mock` 图像提供方和足够的模型额度。当前 API 没有用户账号/授权隔离，公开多人服务前必须另行加网络访问控制；本版本按个人或受控实例定位。

## 2. 发布 Web

桌面 React 站在 `frontend/`，移动 Web/PWA 在 `maneko-app/`。Vercel 项目根目录选 `frontend`，运行 `npm run build`，将 `frontend/vercel.json` 的 API origin 指向部署的真实后端。后端 CORS 需显式允许实际站点 origin。上线验证书库、书源检索、上传、阅读、生成和导出，以及 `/privacy` 页面。

## 3. Android 调试构建

要求 Node.js、JDK 17、Android SDK 36 和 Android Build Tools。项目使用 Capacitor 6；Android Gradle Plugin 8.13.2 / Gradle 8.13；compile/target SDK 为 36。

```powershell
cd mobile-native
npm install
npm run apk:debug
```

调试版本默认不会捆绑 API 地址，可在应用“我的”页填写开发服务（仓库本地脚本启动在 8001）。请勿用 mock 后端结果验收正式功能。

## 4. 构建 GitHub 自托管安装包

GitHub 安装包是完整功能的签名 release APK，不内置共享 API 或模型密钥，也不启用演示数据。用户首次打开后，在 App 的 API 设置中填入自己部署的 HTTPS 后端地址；后端必须配置真实分章模型、图像提供方和持久存储。此方案适合个人或受控自托管，不能把无用户隔离的 API 直接公开给多用户。

需要 Android SDK 36 / Build Tools 36.0.0、Node.js、JDK 17，以及已有的长期签名 keystore。不要用 Android 默认 debug 密钥作为长期正式签名密钥。签名配置参考 `mobile-native/android/app/keystore.properties.example`，或通过 `MANEKO_KEYSTORE_PATH`、`MANEKO_KEYSTORE_PASSWORD`、`MANEKO_KEY_ALIAS`、`MANEKO_KEY_PASSWORD` 环境变量传入。

```powershell
cd mobile-native
npm run apk:release:self-hosted
```

脚本不访问云端 `/ready`，生成前会检查 API 留空、演示关闭且设置可编辑；完成后验证签名、应用 id、版本和 target SDK。APK 输出到 `mobile-native/android/app/build/outputs/apk/release/app-release.apk`，并打印 SHA-256。构建过程会暂存并恢复已有的 `mobile-native/www/`，避免覆盖本地生成内容。

发布 GitHub Release 前，将 Android `versionCode` 递增、更新 `versionName`，并确认签名证书兼容此前安装包；换用新私钥时，旧版 debug 安装必须先卸载，可能清除本机应用数据。不要提交 keystore 或密码。

## 5. 签名 Android App Bundle

首次发布生成自己的签名密钥并安全备份，不要提交 keystore 或密码。复制 `mobile-native/android/app/keystore.properties.example` 为同目录 `keystore.properties`，填写 `storeFile`、`storePassword`、`keyAlias`、`keyPassword`；该文件和 `.jks` 已被 gitignore。也可通过 `MANEKO_KEYSTORE_PATH`、`MANEKO_KEYSTORE_PASSWORD`、`MANEKO_KEY_ALIAS`、`MANEKO_KEY_PASSWORD` 环境变量提供。

先将生产 API origin 设置为 `MANEKO_API_BASE`，确保它为 HTTPS 且 `/ready` 返回 ready，再执行：

```powershell
cd mobile-native
$env:MANEKO_API_BASE = 'https://你的真实 API 域名'
npm run apk:release
```

签名 AAB 输出到 `mobile-native/android/app/build/outputs/bundle/release/app-release.aab`。预检阻止空/占位/本机 HTTP 地址、未就绪服务和缺失签名；生成配置只写入忽略的 `mobile-native/www` 构建产物，源代码不保存生产域名。每次向商店发布更新都必须递增 `versionCode`。

Google Play 从 2026-08-31 起要求新应用与更新 target Android 16 / API 36；提交前再次核对[官方目标 API 政策](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)及[Android 构建工具兼容表](https://developer.android.com/build/releases/about-agp)。

## 5. 发布阻断项

- 发布者的 Google Play / Apple Developer 账号与开发者身份验证。
- 可公开访问并与真实运营者/联系方式一致的隐私政策 URL；模板位置见 `docs/PRIVACY.md`。
- 生产 API 域名、持久存储/备份策略、CORS 和实际模型密钥/额度。
- 签名密钥离线备份与访问控制；不要把私钥/密码发给协作者或放进 CI 日志。
- 商店截图、内容分级、数据安全问卷、版权/用户内容政策、支持渠道和各地区法规确认。
- Android 真实设备安装/前后台/弱网/无网/文件选择与保存体验验证。
- 商店审核与分阶段发布。仓库构建通过不代表已获商店批准。
