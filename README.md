# 申论范文阅读站

基于纯静态文件的申论范文阅读站点，支持自动发现 `articles/` 下的文章、分类目录树、hash 路由、搜索过滤、滚动大纲高亮与移动端响应式。

## 新增文章

把符合规范的 `.html` 文件放入 `articles/` 目录即可，无需改动任何代码。

### Meta 标签规范

每篇文章在 `<head>` 中通过 `<meta>` 标签声明元信息：

| Meta 标签 | 说明 | 是否必需 |
|-----------|------|---------|
| `article-title` | 文章标题（目录树中显示的名称，缺失则回退到 `<title>` 或文件名） | 推荐 |
| `article-category` | **选题板块**（按主题分类，如"基层治理""乡村振兴""高质量发展""文化自信""以人民为中心""数字中国"等） | 推荐 |
| `article-order` | **同一主题板块下**的文章序号，数字越小越靠前（缺失默认 999） | 推荐 |
| `article-date` | 文章日期（如 `2024-03-15`），显示在标题下方 | 可选 |
| `article-author` | 作者，显示在日期旁边 | 可选 |
| `article-description` | 文章摘要 | 可选 |

> `article-category` 按**主题板块**分类，而非按文体（"策论文""政论文"）划分。同一主题下的多篇文章通过 `article-order` 控制排序。

### 文章结构

文章通过 [js/main.js](js/main.js) 中的解析逻辑自动提取，详见 [js/main.js](js/main.js) 中的 `parseArticle` 函数。解析支持两种结构：

**标准结构（推荐）**：使用 `.article-page` > `.article-header` + `.article-content` 容器，主站会自动提取标题、meta 信息和正文，样式统一。可参考现有文章模板。

**非标准结构（兼容）**：直接在 `<body>` 内写内容（如内联样式的 HTML），解析器会自动把首个 `<h1>` 剥离为标题、紧跟的说明行提取为副标题，文章内的 `<style>` 和 `<script>` 也会被保留并执行。文章中的 `<h2>`、`<h3>` 会被自动提取生成右侧 TOC 大纲。

## 本地预览

### 方式一：Python 内置服务器（最简单）

```bash
cd /workspace
python3 -m http.server 8000
```

浏览器打开 http://127.0.0.1:8000/ 。首屏会优先读取 `articles/manifest.json`（见下文「文章清单 manifest」），无需目录浏览也能工作；若 manifest 不存在，才会回退到读取 `articles/` 目录列表。

### 方式二：Nginx

Nginx 默认禁用目录浏览（`autoindex off`），访问 `articles/` 会返回 403。需要为 `articles/` 路径开启 `autoindex`，否则前端脚本无法发现文章。

在站点配置（如 `/etc/nginx/conf.d/shenlun.conf` 或 `/etc/nginx/nginx.conf` 的 `server` 块）中加入：

```nginx
server {
    listen 80;
    server_name localhost;
    root /workspace;          # 指向站点根目录

    location / {
        index index.html;
    }

    # 关键：为 articles 目录开启目录浏览
    location /articles/ {
        autoindex on;             # 允许列出目录内容
        autoindex_exact_size off; # 显示更友好的文件大小
        autoindex_localtime on;   # 使用本地时间
    }
}
```

重载配置使其生效：

```bash
nginx -t && nginx -s reload
```

> 说明：前端脚本 [js/main.js](js/main.js) 首屏优先 `fetch('articles/manifest.json')` 拿到全部文章 meta；若 manifest 不存在，才回退到 `fetch('articles/')` 解析目录列表 HTML 来发现文章文件。开启 `autoindex on` 后 Nginx 会返回该目录列表，作为回退方案可正常工作。

## 文章清单 manifest（首屏加速，推荐）

`articles/manifest.json` 是一份预先提取好的文章 meta 清单（标题/分类/序号/日期/作者/摘要），前端首屏只需一次 `fetch` 即可拿到全部文章信息，无需调用 GitHub Contents API、无需目录浏览、无需逐篇抓取 meta，加载最快且不受 API 限流影响。

### 生成方式

**方式一：浏览器生成（无需 Node 环境）**

打开本仓库根目录的 [generate-manifest.html](generate-manifest.html)（通过本地服务器访问，如 http://127.0.0.1:8000/generate-manifest.html ）：

1. 点击「开始扫描并生成」按钮，页面会自动扫描 `articles/` 下所有 HTML 并提取 meta。
2. 生成完成后点击「下载 manifest.json」，把下载的文件放到 `articles/` 目录覆盖旧文件。
3. 刷新站点首页即可。

> 浏览器生成需要本地服务器开启目录浏览（Nginx 需 `autoindex on`，Python `http.server` 默认支持），用于列出 `articles/` 下的文件。生成 manifest 后，站点首屏读取 manifest 不再依赖目录浏览。

**方式二：Node 脚本生成**

有 Node 环境时，添加或修改文章后运行一次：

```bash
node scripts/generate-manifest.js
```

会扫描 `articles/` 下所有 `.html`（跳过 `_` 开头的模板），提取 meta 写入 `articles/manifest.json`。

**方式三：GitHub Actions 自动生成**

仓库已配置 [.github/workflows/manifest.yml](.github/workflows/manifest.yml)：当 `articles/` 下的文件有变动并推送到 `main` 时，会自动运行上面的脚本生成 `manifest.json` 并提交回仓库。你只管往 `articles/` 丢 HTML，清单自动更新。

### 工作机制

- 前端 [js/file-loader.js](js/file-loader.js) 的 `loadManifest` 优先 `fetch articles/manifest.json`，成功则直接构建目录树。
- 失败/不存在时回退到旧的 `listFiles` + `fetchArticleMeta` 逻辑（GitHub Contents API 或本地目录浏览），保持向后兼容。
- 正文始终按需加载（点击/路由时才 `fetch` 单篇 HTML），并使用 LRU 缓存限制常驻内存的正文数量。

## 部署到 GitHub Pages

GitHub Pages 原生支持静态站点托管。首屏优先读取 `articles/manifest.json`（由 GitHub Actions 自动生成并提交），无需目录浏览、无需调用 GitHub Contents API；若 manifest 缺失会自动回退到 Contents API。

### 步骤

1. **推送代码到 GitHub 仓库**
   - 可以是普通仓库（`your-name/your-repo`），或 `your-name.github.io` 用户主页仓库。

2. **确认 `.nojekyll` 存在**
   - 仓库根目录已有 `.nojekyll` 空文件，用于禁用 Jekyll 处理，确保所有静态资源按原样托管。

3. **开启 Pages 服务**
   - 进入仓库 **Settings → Pages**。
   - **Source** 选择 `Deploy from a branch`。
   - **Branch** 选择 `main`（或你使用的分支），文件夹选 `/ (root)`，点击 **Save**。

4. **访问站点**
   - 普通仓库：`https://<用户名>.github.io/<仓库名>/`
   - 用户主页仓库：`https://<用户名>.github.io/`

### 配置仓库信息（可选）

[js/main.js](js/main.js) 顶部的 `CONFIG` 默认会自动识别 GitHub Pages 域名并推断 `owner`/`repo`。如果你的部署地址特殊（如自定义域名），可手动填写：

```js
const CONFIG = {
  owner: "your-name",   // GitHub 用户名
  repo: "your-repo",    // 仓库名
  articlesPath: "articles",
  branch: "HEAD",
  defaultSlug: "",
};
```

> 线上环境下 `main.js` 会调用 `https://api.github.com/repos/<owner>/<repo>/contents/articles` 获取文章列表，因此**不依赖服务器的目录浏览功能**，无需任何 nginx 配置。
