# 申论范文阅读站

申论范文阅读站点，提供两个独立版本：

- **`static-site/`** — 纯静态站点，部署到 GitHub Pages，无需后端
- **`server-app/`** — 前后端分离版（FastAPI + 管理后台），部署到自有服务器，支持登录注册与文章后台管理

两个版本的阅读站前端（`index.html`、`css/`、`js/`、`articles/`）各自独立一份，可分别部署。

## 目录结构

```
/workspace
├── static-site/              # 静态版（GitHub Pages）
│   ├── index.html            # 阅读站首页
│   ├── css/  js/             # 阅读站样式与脚本
│   ├── articles/             # 文章库（数据源）
│   ├── scripts/              # manifest 生成脚本
│   └── .nojekyll             # 禁用 Jekyll
│
├── server-app/               # 前后端分离版（自有服务器）
│   ├── index.html            # 阅读站首页（同源托管）
│   ├── css/  js/             # 阅读站样式与脚本
│   ├── articles/             # 文章库（静态副本）
│   ├── admin/                # 管理后台前端
│   │   ├── login.html        # 登录/注册页
│   │   ├── dashboard.html    # 文章管理页（含上传 HTML 识别）
│   │   └── css/  js/
│   └── server/               # 后端（FastAPI）
│       ├── main.py           # 主应用（API + 静态托管）
│       ├── auth.py           # 密码哈希 + JWT
│       ├── models.py         # ORM 模型
│       ├── schemas.py        # Pydantic 模型
│       ├── database.py       # SQLite 连接
│       └── requirements.txt
│
├── .github/workflows/
│   └── manifest.yml          # 自动生成 static-site 的 manifest.json
└── README.md
```

## 版本一：static-site（纯静态，GitHub Pages）

阅读站基于纯静态文件，支持自动发现 `articles/` 下的文章、分类目录树、hash 路由、搜索过滤、滚动大纲高亮与移动端响应式。无后端、无登录。

### 本地预览

```bash
cd static-site
python3 -m http.server 8000
```

浏览器打开 http://127.0.0.1:8000/ 。首屏优先读取 `articles/manifest.json`，无需目录浏览；若 manifest 不存在，才回退到读取 `articles/` 目录列表。

### 新增文章

把符合规范的 `.html` 文件放入 `static-site/articles/` 目录即可，无需改动任何代码。添加后运行一次 `node scripts/generate-manifest.js`（在 `static-site/` 下）更新清单，或由 GitHub Actions 自动更新。

### Meta 标签规范

每篇文章在 `<head>` 中通过 `<meta>` 标签声明元信息：

| Meta 标签 | 说明 | 是否必需 |
|-----------|------|---------|
| `article-title` | 文章标题（目录树中显示的名称，缺失则回退到 `<title>` 或文件名） | 推荐 |
| `article-category` | **选题板块**（按主题分类，如"基层治理""乡村振兴""高质量发展""文化自信""数字中国"等） | 推荐 |
| `article-order` | **同一主题板块下**的文章序号，数字越小越靠前（缺失默认 999） | 推荐 |
| `article-date` | 文章日期（如 `2024-03-15`） | 可选 |
| `article-author` | 作者 | 可选 |
| `article-description` | 文章摘要 | 可选 |

> `article-category` 按**主题板块**分类，而非按文体划分。同一主题下的多篇文章通过 `article-order` 控制排序。

### 文章结构

文章通过 `js/article-parser.js` 中的 `parseArticle` 函数自动提取，支持两种结构：

**标准结构（推荐）**：使用 `.article-page` > `.article-header` + `.article-content` 容器，主站自动提取标题、meta 信息和正文。

**非标准结构（兼容）**：直接在 `<body>` 内写内容（如内联样式 HTML），解析器自动把首个 `<h1>` 剥离为标题、紧跟的说明行提取为副标题，文章内的 `<style>` 和 `<script>` 也会被保留并执行。`<h2>`、`<h3>` 会被自动提取生成右侧 TOC 大纲。

### 文章清单 manifest（首屏加速）

`articles/manifest.json` 是预先提取好的文章 meta 清单，前端首屏只需一次 `fetch` 即可拿到全部文章信息，无需调用 GitHub Contents API、无需目录浏览、不受 API 限流影响。

**本地生成**：

```bash
cd static-site
node scripts/generate-manifest.js
```

**GitHub Actions 自动生成**：仓库根 `.github/workflows/manifest.yml` 在 `static-site/articles/` 有变动并推送到 `main` 时，自动运行脚本生成 `manifest.json` 并提交回仓库。

### 部署到 GitHub Pages

1. 推送代码到 GitHub 仓库
2. 进入仓库 **Settings → Pages**，**Source** 选 `Deploy from a branch`，**Branch** 选 `main`，文件夹选 `/ (root)`，保存
3. 访问 `https://<用户名>.github.io/<仓库名>/static-site/`

> 若希望站点直接在根路径访问，可将 `static-site/` 内容作为仓库根，或将 Pages 的发布目录指向 `static-site`。

## 版本二：server-app（前后端分离，自有服务器）

FastAPI 同源托管阅读站静态文件、管理后台前端，并提供认证与文章 CRUD API。文章存于 SQLite，通过管理后台增删改查（支持上传 HTML 文件自动识别填充）。

### 启动

```bash
cd server-app/server
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

访问地址：
- 阅读站：http://127.0.0.1:8000/
- 管理后台：http://127.0.0.1:8000/admin/login.html

### 管理员账户

首次访问 `/admin/login.html` 时，若数据库无用户，可直接注册首个管理员账户（注册后该入口关闭）。之后用该账户登录管理文章。

阅读站导航栏的「管理后台」入口仅对已登录管理员可见（检测 localStorage 中的 token），普通访客不可见。

### 路由说明

| 路径 | 说明 |
|------|------|
| `/` | 阅读站首页（静态托管） |
| `/admin/login.html` | 管理后台登录/注册 |
| `/admin/dashboard.html` | 文章管理（需登录） |
| `POST /api/register` | 注册（仅首个用户） |
| `POST /api/login` | 登录，返回 JWT |
| `GET/POST/PUT/DELETE /api/articles` | 文章 CRUD（写操作需登录） |

### 文章管理

在管理后台点击「+ 新建文章」，可：
- **上传 HTML 文件**：自动识别 meta 标签和正文，填充标题、分类、序号、日期、作者、摘要、正文（解析规则与阅读站一致）
- 手动编辑各字段后保存

技术栈：FastAPI + SQLAlchemy + SQLite + JWT + bcrypt。
