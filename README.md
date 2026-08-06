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

浏览器打开 http://127.0.0.1:8000/ 。Python 的 `http.server` 默认允许目录浏览，`main.js` 可正常读取 `articles/` 列表。

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

> 说明：前端脚本 [js/main.js](js/main.js) 在非 GitHub Pages 环境下会 `fetch('articles/')` 并解析返回的目录列表 HTML 来发现文章文件。开启 `autoindex on` 后 Nginx 会返回该目录列表，脚本即可正常工作。

## 部署到 GitHub Pages

GitHub Pages 原生支持静态站点托管，无需额外配置目录浏览——线上环境会通过 GitHub Contents API 自动发现文章。

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
