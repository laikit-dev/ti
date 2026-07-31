# ti.luogu.me

> Production deployment: see [docs/deploy.md](docs/deploy.md). It uses one root `.env` and `bash scripts/deploy.sh`.

## Current production configuration

Production uses only the root `.env` file. Configure the public port and database connection there:

```env
APP_PORT=8080

# Use `mariadb` for the database container bundled with this project.
# Replace it with an IP address or hostname when using an external MariaDB/MySQL server.
DATABASE_HOST=mariadb
DATABASE_PORT=3306
DATABASE_NAME=luogu_ti
DATABASE_USER=app
DATABASE_PASSWORD=replace-with-a-long-random-password
```

The API reads `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, and `DATABASE_PASSWORD` directly. Redis and the API service use the private Docker network, so their host and ports do not need to be configured for normal deployment.

After the first `.env` setup, deploy or update the server with one command:

```bash
bash scripts/deploy.sh
```

The script pulls the current branch with `git pull --ff-only`, builds the stack once, runs database initialization, and starts the services. See [docs/deploy.md](docs/deploy.md) for the first-clone procedure and external database notes.

在线竞赛题库与套题系统，支持题目浏览、考试 / 练习模式、AI 辅助提示与解析、CPOAuth 统一认证。

> [!IMPORTANT]
> 该文档部分内容由 AI 分析而成。

## 项目结构

| 目录 | 说明 |
| --- | --- |
| `web/` | Vue 3 + Vite 前端 SPA |
| `server/` | Node.js + Express REST API 后端 |
| `docs/` | 补充文档（AI 题目配置提示词等） |
| `docker-compose.yml` | 本地开发用 MariaDB + Redis 基础设施 |
| `docker-compose.prod.yml` | Linux 生产部署编排（含 api / web 容器） |

## 技术栈

### 后端 (`server/`)

| 分类 | 技术 |
| --- | --- |
| 运行时 | Node.js ≥20 |
| 框架 | Express.js 4 + TypeScript 5 |
| 数据库 | MariaDB 11（[`mysql2`](server/package.json) 原生 SQL，无 ORM） |
| 缓存 / 会话 | Redis 7（[`ioredis`](server/package.json)） |
| 认证 | CPOAuth OAuth2 + Admin Token |
| Schema 迁移 | 启动时自动检测并补列（[`ensureUserSchema()`](server/src/db.ts)） |
| 开发运行 | `tsx watch` |

### 前端 (`web/`)

| 分类 | 技术 |
| --- | --- |
| 框架 | Vue 3（Composition API + `<script setup>`） |
| 构建 | Vite 5 |
| 路由 | vue-router 4（history 模式） |
| 国际化 | vue-i18n 9（zh-CN / en-US / ja-JP） |
| 主题 | CSS Variables（auto / dark / light 三模式） |
| 样式 | 原生 CSS（按页面 / 组件拆分） |
| Markdown 渲染 | markdown-it 14 + KaTeX + highlight.js |
| 图标 | Font Awesome Free 6 |

### 数据库

| 表 | 用途 |
| --- | --- |
| `users` | 用户账号，含 OAuth 绑定、偏好设置 |
| `app_settings` | 键值对应用配置（OAuth、AI、站点公告） |
| `system_pages` | CMS 页面（用户协议、隐私政策、自定义页面） |
| `admin_tokens` | 管理员登录令牌 |
| `ai_usage_daily` | 每日 AI 调用量统计 |
| `problemsets` | 题目集（四种类型：官方公开 / 个人精选 / 个人公开 / 个人私有） |
| `questions` | 题目详情（选择题 / 填空题，支持材料组） |
| `submissions` | 用户提交记录与评分结果 |

### 核心功能

- **题目 DSL**：自定义格式（`:::question` / `:::group`），支持选择题（单选 / 多选）和填空题，支持材料组（共享材料的多题组合）
- **AI 辅助**：多模型配置，每日配额，一键生成题目提示 (`hint`) 和解析 (`solution`)
- **认证体系**：CPOAuth OAuth2（洛谷统一认证）为用户入口，Admin Token 为管理员后台登录入口
- **即时判分**：选择题标准化答案比对，填空题精确匹配
- **管理后台**：用户管理、题目集 / 题目编辑、OAuth 配置、系统页面管理、数据备份

## 兼容性说明

当前仓库已经针对 Linux 部署做了几项兼容性处理：

- Docker 构建阶段固定使用 `pnpm@9.15.4`
- 支持通过 `NPM_REGISTRY` 覆盖容器内的 npm registry，避免部分 Linux 服务器拉不到 `registry.npmjs.org`
- 根目录新增 `.nvmrc`，便于 Linux 上直接对齐 Node 20
- 生产环境端口支持通过 `API_BIND_HOST` / `WEB_BIND_HOST` 控制绑定地址，方便只监听 `127.0.0.1`

如果你只是要部署到 Linux，推荐直接看下面的"Linux 详细部署教程"；如果你要本地开发，再看前面的开发章节。

## 本地开发

### 1. 环境要求

- Node.js 20.x
- `pnpm` 9.x
- MariaDB / MySQL
- Redis

如果你本机使用 `nvm`，推荐直接在仓库根目录执行：

```bash
nvm install
nvm use
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

默认开发环境配置如下：

- API：`http://localhost:3000`
- Web：`http://localhost:5173`
- MariaDB：`127.0.0.1:3306`
- Redis：`127.0.0.1:6379`

如需指定前端请求地址，可额外执行：

```bash
# VITE_API_BASE_URL is loaded automatically from the repository root .env
```

### 4. 启动开发环境

```bash
pnpm dev
```

也可以拆开启动：

```bash
pnpm run dev:api
pnpm run dev:web
```

## 使用 Docker 启动本地数据库 / Redis

如果你的开发机没有本地 MariaDB / Redis，可以直接用仓库根目录的 Compose：

```bash
cp .env.example .env
pnpm run dev:infra
```

默认端口：

- MariaDB：`127.0.0.1:3307`
- Redis：`127.0.0.1:6380`

此时修改根目录 `.env` 中的连接端口：

```env
DB_HOST=127.0.0.1
DB_PORT=3307
REDIS_HOST=127.0.0.1
REDIS_PORT=6380
```

停止基础设施：

```bash
pnpm run dev:infra:down
```

## Linux 详细部署教程

下面这套流程是给 Ubuntu / Debian 服务器准备的，Rocky Linux / AlmaLinux / CentOS 也可以参考同样思路，只是系统包管理命令不同。  
生产环境推荐使用 Docker Compose 部署，不建议把 Node、MariaDB、Redis 全部直接装到宿主机上手工跑服务。

### 1. 部署前先明确两件事

第一件事：你准备怎么暴露站点。

- 方案 A：`ti.luogu.me` 和 `api.ti.luogu.me` 分域部署
- 方案 B：只用一个域名，例如 `ti.luogu.me`，前端走 `/`，后端走 `/api`

第二件事：你准备怎么绑定宿主机端口。

- 如果你前面还有宿主机 Nginx / Caddy，建议把 `API_BIND_HOST` 和 `WEB_BIND_HOST` 设成 `127.0.0.1`
- 如果你只是临时起服务测试，允许外部直接访问，也可以保持默认 `0.0.0.0`

### 2. 服务器建议配置

最低建议：

- 2 vCPU
- 2 GB 内存
- 20 GB 可用磁盘

更稳妥的生产建议：

- 2 到 4 vCPU
- 4 GB 内存
- SSD 磁盘
- 能正常访问 Docker Hub、npm registry 或你自定义的镜像源

### 3. 安装基础环境

先安装 Docker、Git、Curl：

```bash
sudo apt update
sudo apt install -y ca-certificates curl git docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

把当前用户加入 `docker` 组，避免后续每条命令都写 `sudo`：

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

如果你还想在宿主机上做本地构建、调试或排查 Node 问题，再额外安装 `nvm`、Node 和 `pnpm`：

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /path/to/ti.luogu.me
nvm install
nvm use
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

说明：

- 仓库根目录已经提供 `.nvmrc`，`nvm install` 会自动安装 Node 20
- 如果你只用 Docker Compose 部署，其实不装 Node / pnpm 也可以
- 如果服务器访问 `registry.npmjs.org` 很慢或会超时，请提前准备镜像源，后面配置 `NPM_REGISTRY`

### 4. 拉取代码

推荐把项目放在固定目录，例如 `/opt/ti.luogu.me`：

```bash
sudo mkdir -p /opt/ti.luogu.me
sudo chown -R "$USER":"$USER" /opt/ti.luogu.me
git clone <your-repo-url> /opt/ti.luogu.me
cd /opt/ti.luogu.me
```

后续所有命令默认都在仓库根目录执行。

### 5. 复制生产环境变量模板

```bash
cp .env.example .env
```

这一步非常重要。  
`docker-compose.prod.yml` 里的端口、数据库口令、构建镜像源、前端 API 地址都会从根目录 `.env` 里读取。

### 6. 编辑 `.env`

下面先给一个比较通用、适合“前端一个域名、API 一个域名”的示例：

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

如果你准备使用“同域名 + `/api` 反代”的方式，也就是浏览器最终只访问 `https://ti.luogu.me`，那么可以这样配：

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

这几项变量的含义建议你看清楚：

| 变量 | 作用 | 建议 |
| --- | --- | --- |
| `MARIADB_ROOT_PASSWORD` | MariaDB root 口令 | 必改，且要足够复杂 |
| `MARIADB_DATABASE` | 业务数据库名 | 一般保持 `luogu_ti` 即可 |
| `MARIADB_USER` | 业务数据库用户 | 一般保持 `app` 即可 |
| `MARIADB_PASSWORD` | 业务数据库口令 | 必改，且不要和 root 口令相同 |
| `API_BIND_HOST` | 宿主机 API 监听地址 | 有反向代理时设 `127.0.0.1` |
| `API_PORT` | 宿主机 API 端口 | 默认 `3000` |
| `WEB_BIND_HOST` | 宿主机前端监听地址 | 有反向代理时设 `127.0.0.1` |
| `WEB_PORT` | 宿主机前端端口 | 默认 `5173` |
| `NPM_REGISTRY` | 容器构建阶段使用的 npm registry | 海外机器可改成 `https://registry.npmjs.org`，网络受限环境保留镜像源 |
| `VITE_API_BASE_URL` | 前端构建时写死的 API 基础地址 | 分域部署时写 `https://api.xxx.com`；同域 `/api` 反代时可留空 |
| `PUBLIC_API_BASE_URL` | 后端对外公开 API 基础地址 | 分域部署时与 API 域名一致；同域 `/api` 反代时可留空 |
| `WEB_BASE_URL` | 站点对外访问域名 | 建议写真实 HTTPS 域名 |
| `CPOAUTH_BASE_URL` | CPOAuth 服务地址 | 默认 `https://auth.luogu.me` |

特别说明：

- `NPM_REGISTRY` 是这次 Linux 兼容处理里的重点之一。很多服务器不是 Docker 装不上，而是构建镜像时拉 `pnpm` 或装依赖超时。
- 如果你服务器能稳定访问官方源，可以把 `NPM_REGISTRY` 改成 `https://registry.npmjs.org`
- 如果你保持 `VITE_API_BASE_URL=` 为空，前端会走同源请求，然后由 `web` 容器内的 Nginx 把 `/api` 转发给 `api` 容器

### 7. 启动生产环境

第一次部署建议直接构建并启动：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

查看容器状态：

```bash
docker compose -f docker-compose.prod.yml ps
```

查看后端日志：

```bash
docker compose -f docker-compose.prod.yml logs -f api
```

查看前端日志：

```bash
docker compose -f docker-compose.prod.yml logs -f web
```

查看数据库日志：

```bash
docker compose -f docker-compose.prod.yml logs -f mariadb
```

说明：

- 第一次启动时，MariaDB 初始化可能需要几十秒
- `api` 服务会等待 `mariadb` 和 `redis` 健康检查通过后再启动
- 如果你改过 `.env` 里的构建相关变量，例如 `NPM_REGISTRY`、`VITE_API_BASE_URL`，记得重新执行 `up -d --build`

### 8. 检查服务是否真的起来了

建议依次检查：

1. `docker compose -f docker-compose.prod.yml ps` 里所有服务都处于 `running`
2. `api` 日志里能看到类似 `listening on :3000`
3. 访问 `http://127.0.0.1:3000/` 能返回 `pong`
4. 访问 `http://127.0.0.1:5173/` 能返回前端页面

如果你把 `API_BIND_HOST` / `WEB_BIND_HOST` 设成 `127.0.0.1`，上面这两条检查建议在服务器本机执行，例如：

```bash
curl http://127.0.0.1:3000/
curl -I http://127.0.0.1:5173/
```

### 9. 配置反向代理

生产环境通常还会在宿主机再放一层 Nginx 或 Caddy，负责：

- 绑定 80 / 443
- 配置 HTTPS 证书
- 处理域名转发

#### 方案 A：前后端分域

建议：

- `ti.luogu.me` -> `http://127.0.0.1:5173`
- `api.ti.luogu.me` -> `http://127.0.0.1:3000`

Nginx 参考配置：

```nginx
server {
  listen 80;
  server_name ti.luogu.me;

  location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name api.ti.luogu.me;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

#### 方案 B：同域名 + `/api`

如果你希望用户只访问一个域名，比如 `https://ti.luogu.me`，那可以让宿主机 Nginx 统一转发：

```nginx
server {
  listen 80;
  server_name ti.luogu.me;

  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

这一模式下建议：

- `VITE_API_BASE_URL=` 留空
- `PUBLIC_API_BASE_URL=` 留空
- `WEB_BASE_URL=https://ti.luogu.me`

### 10. 首次后台登录与 Admin Token

项目当前支持通过数据库插入一条 Admin Token 的方式做首次后台登录。

先进入 MariaDB 容器：

```bash
docker compose -f docker-compose.prod.yml exec mariadb mariadb -uapp -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"
```

插入一条 32 位字母数字 token：

```sql
INSERT INTO admin_tokens (token, created_by_uid)
VALUES ('AbCdEfGhIjKlMnOpQrStUvWxYz123456', 'root');
```

然后访问：

- `https://ti.luogu.me/auth/login`

在登录页下方使用这条 `Admin Token` 登录后台，完成 CPOAuth 相关配置。

### 11. 更新部署

更新代码后重新构建：

```bash
cd /opt/ti.luogu.me
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

如果你只是重启服务，不重新构建：

```bash
docker compose -f docker-compose.prod.yml restart
```

如果要停服：

```bash
docker compose -f docker-compose.prod.yml down
```

注意：

- `down` 不会删除命名卷，数据库和 Redis 数据默认还在
- 如果你执行 `down -v`，命名卷会被删掉，数据库数据也会丢失，生产环境不要随便用

### 12. 常见报错与排查建议

#### 12.1 构建时卡在安装 pnpm 或依赖下载

现象：

- `pnpm install` 超时
- Docker build 里拉 `pnpm@9.15.4` 失败
- 日志里出现访问 `registry.npmjs.org` 超时

排查：

1. 确认服务器能否访问外网
2. 把 `.env` 里的 `NPM_REGISTRY` 改成可达的镜像源
3. 重新执行 `docker compose -f docker-compose.prod.yml up -d --build`

#### 12.2 3000 或 5173 端口被占用

现象：

- Compose 启动时报端口冲突

处理：

1. 用 `ss -lntp | grep -E '3000|5173'` 查占用
2. 改 `.env` 里的 `API_PORT` 或 `WEB_PORT`
3. 如果前面有宿主机 Nginx / Caddy，推荐直接把 `API_BIND_HOST` 和 `WEB_BIND_HOST` 设成 `127.0.0.1`

#### 12.3 页面能打开，但接口 404 / 502 / 请求到错地址

优先检查：

1. 你到底是“分域部署”还是“同域 `/api` 反代”
2. `VITE_API_BASE_URL` 是否配对了当前方案
3. `PUBLIC_API_BASE_URL` / `WEB_BASE_URL` 是否写成了真实对外域名
4. 宿主机反向代理是否正确把请求转给了 `127.0.0.1:3000` 和 `127.0.0.1:5173`

#### 12.4 OAuth 回调地址不对

优先检查：

1. `WEB_BASE_URL` 是否是用户真实访问的 HTTPS 域名
2. `PUBLIC_API_BASE_URL` 是否和 API 对外域名一致
3. 后台里的 CPOAuth callback URL 是否与你最终公网访问地址一致
4. 反向代理是否正确透传了 `Host` 与 `X-Forwarded-Proto`

#### 12.5 数据库一直起不来

优先检查：

1. `docker compose -f docker-compose.prod.yml logs -f mariadb`
2. 宿主机磁盘空间是否够
3. `.env` 中的数据库口令是否写了非法字符或被错误转义
4. 之前是否残留了异常卷数据

## 常用命令

```bash
pnpm build
pnpm -C server run typecheck
pnpm -C web exec vue-tsc --noEmit
docker compose ps
docker compose logs -f mariadb
docker compose logs -f redis
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
```
