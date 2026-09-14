# Maneko Android 风客户端

单文件移动应用：`index.html`（可安装 PWA）。

视觉与 Web 版共用 **Neon Tokyo** 体系（与 `frontend/public/styles/neon-tokyo.css` 同源）：

- 色板：`#0a0a1a` / `#ff1493` / `#00f0ff` / `#ff6b00` / `#bc13fe`
- 直角 `2px` 半径、霓虹描边与发光阴影
- 顶栏：猫娘看板娘 + `Maneko · 漫猫 · ノベル漫画 · ねこ`
- 底栏：首页 / 書庫 / 生成 / ねこ（大写字距）
- 生成中使用与 Web 相同的猫娘 NeonLoader

## 打开方式

- 桌面：浏览器打开 `android-app/index.html`，开发者工具切到手机视口
- 手机：把整个 `android-app/` 放到可访问的静态服务，或用电脑局域网 IP 打开
- 添加到主屏幕后可全屏运行（`display: standalone`）

## 模式

| 模式 | 说明 |
|------|------|
| 演示模式（默认） | 无需后端，内置书架与分镜演示 |
| 在线模式 | 「ねこ」里填后端地址，例如 `http://192.168.x.x:8001` |

## 功能

- 书架 / 章节阅读 / 分镜预览
- 风格预设选择
- TXT 导入（在线模式调用 `/api/novels/upload`）
- 生成漫画并轮询状态（在线模式）
