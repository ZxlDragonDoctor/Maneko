# Maneko App（移动产品）

生产级移动 Web / PWA / Capacitor 源码。

## 预览

浏览器直接打开 `index.html`，或：

```powershell
cd maneko-app
py -m http.server 8080
# http://127.0.0.1:8080
```

## 功能

- 引导页 / 书架搜索筛选收藏
- 章节阅读（字号调节、进度）
- 生成工作台（画风预设、实时分镜）
- 漫画集汇总
- 演示模式（离线）/ 连接 Maneko 后端
- 导出书架 JSON、重置数据

## 打 APK

```powershell
# 同步到 Capacitor
Copy-Item maneko-app\* mobile-native\www\ -Recurse -Force
# 或使用 scripts
.\scripts\build-apk-www.ps1
```
