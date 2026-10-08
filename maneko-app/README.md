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
- 正式默认连接真实后端；未连接时明确显示离线态，不注入演示作品
- 书源检索与导入、收藏/分类/进度、书架完整 JSON 导出
- 漫画集真实状态、失败重试和章节分镜 ZIP 导出
- 隐私说明页与本地数据重置

本地预览数据只允许构建配置显式开启，不属于商店发布包功能。商店构建使用 `npm run apk:release`，详见[发布手册](../docs/RELEASE.md)。

## 打 APK

```powershell
# 同步到 Capacitor
Copy-Item maneko-app\* mobile-native\www\ -Recurse -Force
# 或使用 scripts
.\scripts\build-apk-www.ps1
```
