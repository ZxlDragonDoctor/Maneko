# API文档

基础URL: `http://localhost:8001`（本地开发）/ `http://localhost:8000`（Docker）

## 健康检查

### GET /

返回API欢迎信息。

**响应:**
```json
{
  "message": "Maneko · 漫猫 API",
  "docs": "/docs"
}
```

### GET /health

健康检查端点。

**响应:**
```json
{
  "status": "healthy"
}
```

---

## 小说管理

### POST /api/novels/upload

上传小说文件。

**请求:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: `.txt`文本文件（最大10MB）

**响应:**
```json
{
  "id": "novel_abc123",
  "title": "我的小说",
  "status": "uploaded",
  "created_at": "2026-09-10T12:00:00"
}
```

**错误:**
- `400`: 文件格式不支持 / 文件超过大小限制 / 编码解析失败

### GET /api/novels/

获取所有小说列表。

**响应:**
```json
[
  {
    "id": "novel_abc123",
    "title": "我的小说",
    "status": "uploaded",
    "created_at": "2026-09-10T12:00:00"
  }
]
```

### GET /api/novels/{novel_id}

获取小说详情，包含完整内容。

**路径参数:**
- `novel_id`: 小说ID

**响应:**
```json
{
  "id": "novel_abc123",
  "title": "我的小说",
  "content": "第一章 开始...",
  "status": "uploaded",
  "created_at": "2026-09-10T12:00:00"
}
```

**错误:**
- `404`: 小说不存在

### DELETE /api/novels/{novel_id}

删除小说。

**路径参数:**
- `novel_id`: 小说ID

**响应:**
```json
{
  "message": "删除成功"
}
```

**错误:**
- `404`: 小说不存在

---

## 章节管理

### GET /api/novels/{novel_id}/chapters

获取小说的所有章节。

**路径参数:**
- `novel_id`: 小说ID

**响应:**
```json
[
  {
    "id": "chapter_001",
    "chapter_number": 1,
    "title": "第一章 开始",
    "content": "故事从这里开始...",
    "comic_status": "pending",
    "comic_images": []
  }
]
```

### GET /api/chapters/{chapter_id}

获取章节详情。

**路径参数:**
- `chapter_id`: 章节ID

**响应:**
```json
{
  "id": "chapter_001",
  "chapter_number": 1,
  "title": "第一章 开始",
  "content": "故事从这里开始...",
  "comic_status": "completed",
  "comic_images": ["comics/chapter_001/panel_1.png"]
}
```

**错误:**
- `404`: 章节不存在

---

## 漫画生成

### POST /api/comics/generate

触发章节漫画生成（异步任务）。

**请求:**
```json
{
  "chapter_id": "chapter_001"
}
```

**响应:**
```json
{
  "message": "漫画生成任务已启动",
  "chapter_id": "chapter_001"
}
```

**错误:**
- `404`: 章节不存在
- `400`: 该章节正在生成中

### GET /api/comics/{chapter_id}/status

查询漫画生成状态。

**路径参数:**
- `chapter_id`: 章节ID

**响应:**
```json
{
  "chapter_id": "chapter_001",
  "status": "completed",
  "images": ["comics/chapter_001/panel_1.png"]
}
```

**错误:**
- `404`: 章节不存在

### GET /api/comics/{chapter_id}/images

获取章节漫画图片列表。

**路径参数:**
- `chapter_id`: 章节ID

**响应:**
```json
[
  {
    "id": "panel_001",
    "panel_index": 1,
    "script": "描述文字",
    "image_path": "comics/chapter_001/panel_1.png"
  }
]
```

---

## 静态文件

- `/uploads/*` - 上传的小说文件
- `/comics/*` - 生成的漫画图片

## 生成状态说明

| 状态 | 说明 |
|------|------|
| `pending` | 待生成 |
| `generating` | 生成中 |
| `completed` | 生成完成 |
| `failed` | 生成失败 |
