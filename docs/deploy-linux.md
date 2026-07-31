# Linux 部署说明

> 以下“当前部署流程”是唯一推荐流程。本文后半部分保留的旧多端口、`MARIADB_*`、`API_PORT` 和 `WEB_PORT` 示例仅供历史参考，请不要按那些示例新建 `.env`。

## 当前部署流程

生产环境只使用仓库根目录的一份 `.env`。数据库连接信息可以完全手工配置：

```env
# 对外访问网站的唯一宿主机端口
APP_PORT=8080

# 项目自带数据库时保持 DATABASE_HOST=mariadb。
# 使用外部 MariaDB/MySQL 时，改为该数据库的 IP 或域名。
DATABASE_HOST=mariadb
DATABASE_PORT=3306
DATABASE_NAME=luogu_ti
DATABASE_USER=app
DATABASE_PASSWORD=请替换为长随机密码
```

Redis 和 API 的主机、端口不需要填写：它们始终通过 Docker 内部网络连接。网站与 API 共用 `APP_PORT`，前端的 `/api` 请求会自动代理到 API 容器。

### 首次部署

```bash
git clone <your-repo-url> /opt/ti.luogu.me
cd /opt/ti.luogu.me
cp .env.example .env
# 编辑 .env，至少填写 APP_PORT 和全部 DATABASE_* 配置
bash scripts/deploy.sh
```

`scripts/deploy.sh` 会执行 `git pull --ff-only`，然后只运行一次 `docker compose -f docker-compose.prod.yml up -d --build --remove-orphans`。MariaDB 就绪后 API 会自动执行现有的数据库初始化逻辑并启动。

### 后续更新

在服务器的仓库目录执行同一条命令即可：

```bash
bash scripts/deploy.sh
```

脚本不会覆盖有冲突的本地改动；非快进拉取会直接失败，方便先处理冲突再部署。

这份文档是 Linux 部署的快捷版。
更完整、更详细、包含反向代理与常见报错排查的版本请直接看仓库根目录 [README.md](../README.md) 中的“Linux 详细部署教程”。

## 1. 安装 Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl git docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
newgrp docker
```

## 2. 拉取项目

```bash
git clone <your-repo-url> /opt/ti.luogu.me
cd /opt/ti.luogu.me
```

## 3. 复制并修改 `.env`

```bash
cp .env.example .env
```

分域部署示例：

```env
TZ=Asia/Shanghai

MARIADB_ROOT_PASSWORD=请改成强密码
MARIADB_DATABASE=luogu_ti
MARIADB_USER=app
MARIADB_PASSWORD=请改成强密码

API_BIND_HOST=127.0.0.1
API_PORT=3000
WEB_BIND_HOST=127.0.0.1
WEB_PORT=5173

NPM_REGISTRY=https://registry.npmmirror.com

VITE_API_BASE_URL=https://api.ti.luogu.me
PUBLIC_API_BASE_URL=https://api.ti.luogu.me
WEB_BASE_URL=https://ti.luogu.me
CPOAUTH_BASE_URL=https://auth.luogu.me
```

同域 `/api` 反代示例：

```env
TZ=Asia/Shanghai

MARIADB_ROOT_PASSWORD=请改成强密码
MARIADB_DATABASE=luogu_ti
MARIADB_USER=app
MARIADB_PASSWORD=请改成强密码

API_BIND_HOST=127.0.0.1
API_PORT=3000
WEB_BIND_HOST=127.0.0.1
WEB_PORT=5173

NPM_REGISTRY=https://registry.npmmirror.com

VITE_API_BASE_URL=
PUBLIC_API_BASE_URL=
WEB_BASE_URL=https://ti.luogu.me
CPOAUTH_BASE_URL=https://auth.luogu.me
```

说明：

- 如果服务器能稳定访问官方源，可把 `NPM_REGISTRY` 改成 `https://registry.npmjs.org`
- 如果前面有 Nginx / Caddy，建议 `API_BIND_HOST=127.0.0.1`、`WEB_BIND_HOST=127.0.0.1`
- 若 `VITE_API_BASE_URL` 留空，前端会使用同源 `/api`，由 `web` 容器内 Nginx 转发到 `api`

## 4. 启动

```bash
bash scripts/deploy.sh
```

查看日志：

```bash
docker compose -f docker-compose.prod.yml logs -f mariadb
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
```

## 5. 初始化后台 Admin Token

```bash
docker compose -f docker-compose.prod.yml exec mariadb mariadb -u"$DATABASE_USER" -p"$DATABASE_PASSWORD" "$DATABASE_NAME"
```

```sql
INSERT INTO admin_tokens (token, created_by_uid)
VALUES ('AbCdEfGhIjKlMnOpQrStUvWxYz123456', 'root');
```

登录地址：

- `https://ti.luogu.me/auth/login`

## 6. CDN 加速（可选）

如果希望静态资源通过 S3 兼容存储加速，执行以下步骤：

### 6.1 后台配置 S3 凭证（推荐）

登录管理后台 → CP OAuth 配置页面 → S3 CDN 配置区域，填写 S3 存储桶信息并保存。

### 6.2 配置 `.env` 的 CDN URL 和 API 访问

编辑 `.env`，设置以下变量：

```env
S3_UPLOAD_ENABLED=true

# 推荐：从后台 API 拉取 S3 凭证（只需填写 API 地址和 admin token）
S3_API_BASE_URL=https://api.ti.luogu.me
S3_API_ADMIN_TOKEN=<登录页生成的 admin token>

# 构建时使用 CDN 域名
VITE_CDN_BASE_URL=https://你的CDN域名
```

> 如果不希望走 API，也可以直接在 `.env` 中填写 `S3_REGION`、`S3_BUCKET` 等变量，脚本会自动降级。

### 6.3 触发上传

方式一（Docker）：

```bash
docker compose -f docker-compose.prod.yml --profile s3-upload run --rm s3-upload
```

方式二（本地）：

```bash
pnpm run s3-upload
```

上传脚本优先通过 `S3_API_BASE_URL` + `S3_API_ADMIN_TOKEN` 调用后台 API 获取 S3 凭证；若未配置则降级使用 `.env` 中的环境变量。

后台管理界面中的 S3 配置存储在数据库中，同时支持备份导出/恢复。

## 7. 更新部署

```bash
cd /opt/ti.luogu.me
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
