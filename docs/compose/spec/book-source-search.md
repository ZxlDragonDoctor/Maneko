---
feature: book-source-search
status: delivered
updated: 2026-09-12
branch: master
commits: pending
---

# Book Source Search Reliability

## Report

**What was built** — 书源页切源即加载；空搜索返回各源默认前 N 本小说；Gutenberg 自动暖目录并只出小说；去掉「刷新古登堡」按钮；导入按书隔离 loading；书目去掉测试/演示字样。

**Verification** — `pytest tests/test_source_search_defaults.py tests/test_fiction_sources.py tests/test_popular_sources.py` → 11 passed；live：popular 空搜 6 本、builtin 空搜 6 本、gutenberg sherlock 5 本、`/library/search?q=` 12 本。

**Journey log** — 先写 worktree 被会话策略拦截，改在当前 master 工作区实现；古登堡必须走官方 catalog.csv 而非 gutendex（本机 IPv6 不可达）。

## [S1] Problem
书源页搜索不可靠：切换书源后不自动加载；空搜索不返回默认书目；导入一本时全局按钮禁用；残留「刷新古登堡目录」；书目含「测试/演示」。

## [S2] Design
### Backend
- `GET /api/library/sources/{id}/search?q=&limit=`：空 q 返回默认前 N 本。
- Gutenberg：目录空则自动 download；失败抛错不再静默空。
- `/api/library/search` 空 q 允许，返回聚合默认。
- 书目禁止测试/演示措辞。

### Frontend
- 切换任意书源立即加载空查询列表。
- `importingId` 按 `source:source_ref` 隔离。
- 移除刷新古登堡按钮。

## [S3] Out of Scope
版权全文抓取、新书源、漫画生成链路。

## Tasks
- [x] T1: 后端空搜索默认 + Gutenberg 暖目录
- [x] T2: 前端自动加载 + 按书导入态 + 去掉刷新按钮
- [x] T3: 去掉测试/演示字样
- [x] T4: 回归测试 11 passed
