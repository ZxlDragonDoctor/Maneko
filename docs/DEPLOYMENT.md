# 部署指南

## 阿里云ECS部署

### 1. 安装Docker

```bash
# 安装Docker
sudo yum install docker -y
sudo systemctl start docker
sudo systemctl enable docker

# 安装docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 2. 克隆项目

```bash
git clone <repository_url>
cd agent-scope-dev
```

### 3. 配置环境变量

```bash
# 创建环境变量文件
cp .env.example .env

# 编辑.env文件，填入API密钥
nano .env
```

`.env` 文件内容:

```env
DASHSCOPE_API_KEY=your_dashscope_api_key_here
```

### 4. 启动服务

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 查看运行状态
docker-compose ps
```

### 5. 验证部署

```bash
# 检查健康状态
curl http://localhost:8000/health

# 测试API
curl http://localhost:8000/api/novels/
```

---

## 配置Nginx反向代理

### 安装Nginx

```bash
sudo yum install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 配置站点

创建 `/etc/nginx/conf.d/novel-comic.conf`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        proxy_pass http://127.0.0.1:80;
        try_files $uri $uri/ /index.html;
    }

    # API代理
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 漫画图片代理
    location /comics {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }

    # 上传文件代理
    location /uploads {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }
}
```

### 重载Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 配置HTTPS (可选)

### 使用Let's Encrypt

```bash
# 安装certbot
sudo yum install epel-release -y
sudo yum install certbot python2-certbot-nginx -y

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo systemctl enable certbot-renew.timer
```

---

## 数据持久化

Docker Compose已配置数据卷挂载:

- `./data/uploads` - 上传文件
- `./data/comics` - 漫画图片
- `./data/novels.db` - SQLite数据库

备份数据:

```bash
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

---

## 常见问题

### 查看日志

```bash
docker-compose logs backend
docker-compose logs frontend
```

### 重启服务

```bash
docker-compose restart
```

### 停止服务

```bash
docker-compose down
```

### 清理重建

```bash
docker-compose down
docker-compose up -d --build
```

---

## 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend | 80 | Nginx前端服务 |
| Backend | 8000 | FastAPI后端服务 |
