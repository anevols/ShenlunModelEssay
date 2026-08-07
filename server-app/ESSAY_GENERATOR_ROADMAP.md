# 申论范文生成器 · 分阶段实施计划

> 与当前项目切合：范文生成器作为 `server-app/server` 的子模块实现，复用现有 FastAPI + SQLAlchemy + SQLite 技术栈与十大板块枚举，生成结果直接入库为 `Article`，前端在管理后台增加「AI 生成」入口。

---

## 当前项目现状（切合基线）

| 维度 | 现状 |
|---|---|
| 后端 | FastAPI（`server-app/server/`），SQLite + SQLAlchemy |
| 前端 | Vue 3 + Vite 单 SPA（`server-app/web/`），含阅读站/登录/后台三套布局 |
| 文章模型 | `Article`：slug / title / category / order / date / author / description / content_html |
| 十大板块 | `server/categories.py` + `web/src/shared/constants.js`（前后端权威源） |
| HTML 解析 | `web/src/admin/utils.js` 的 `parseHtmlFile`（meta + .article-page + .article-content） |
| 交互 JS | `web/src/analysis.js` 的 `toggleAnalysis`（window 全局，v-html 内联 onclick 调用） |
| 入库接口 | `POST /api/articles`（需管理员 token，slug 自动生成） |
| 认证 | JWT（`server/auth.py`），管理员守卫 `get_admin_user` |
| 配置存储 | 新增 `LlmConfig` 模型（数据库管理，可在后台修改） |

**核心结论：** 生成器输出必须是「符合 `parseHtmlFile` 规则 + 含 `toggleAnalysis` 交互」的单文件 HTML，并直接写入 `Article.content_html`，无需额外文件存储/归档目录。

---

## 模块定位与目录结构

生成器作为后端子模块，不新建独立项目：

```
server-app/server/
├─ main.py                  ← 新增 /api/admin/generate、/api/admin/llm-config 路由
├─ models.py                ← 新增 LlmConfig 模型（Article/User 不改）
├─ categories.py            ← 十大板块（复用，不改）
├─ auth.py                  ← JWT/管理员守卫（复用，不改）
├─ generator/               ← 新增：范文生成器
│  ├─ __init__.py
│  ├─ config.py             ← LLM 配置加载（从 LlmConfig 表读取，带内存缓存）
│  ├─ topics.py             ← 主题/分论点/案例素材加载（基于 categories.py）
│  ├─ prompts.py            ← 系统 Prompt + 动态 Prompt 组装
│  ├─ llm_client.py         ← OpenAI SDK 封装（同步调用 + JSON 模式，参数来自 config）
│  ├─ renderer.py           ← JSON → HTML 渲染（Python 字符串模板）
│  ├─ validator.py          ← 质量校验（结构/字数/标注/案例/span）
│  ├─ pipeline.py           ← 编排：生成→封装→校验→入库
│  └─ templates/
│     ├─ article.html.tpl   ← HTML 骨架模板（meta + style + article-page + JS）
│     └─ style.css          ← 内联样式片段（arg-type 颜色映射）
└─ ...
```

前端入口：

```
server-app/web/src/
├─ views/
│  ├─ GenerateView.vue      ← 新增：AI 生成页（后台子路由 /admin/generate）
│  └─ LlmConfigView.vue     ← 新增：LLM 配置页（后台子路由 /admin/llm-config）
└─ admin/
   └─ components/
      ├─ GeneratePanel.vue  ← 新增：生成参数表单 + 进度展示
      └─ LlmConfigForm.vue  ← 新增：LLM 配置表单
```

### LlmConfig 数据模型

```python
# models.py 新增
class LlmConfig(Base):
    __tablename__ = "llm_config"

    id = Column(Integer, primary_key=True, index=True)
    # 单行配置表：固定 id=1，便于 upsert
    provider = Column(String(50), default="openai")       # openai | claude | local
    api_base = Column(String(255), default="https://api.openai.com/v1")
    api_key = Column(String(255), default="")              # 明文存储（内网部署）
    model = Column(String(100), default="gpt-4o-mini")
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=4096)
    timeout = Column(Integer, default=60)                  # 单次调用超时（秒）
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

- **单行配置**：表内固定 `id=1`，通过 upsert 更新，避免多行配置歧义。
- **明文存储**：内网部署场景，简化实现；如需对外，可后续加密。
- **API key 不回显**：`GET /api/admin/llm-config` 返回时 mask（如 `sk-****1234`），仅 `PUT` 时写入明文。

---

## Phase 1：基础框架（Week 1–2）

- [ ] 搭建 `server/generator/` 子模块目录与 `__init__.py`
- [ ] `models.py` 新增 `LlmConfig` 模型（单行配置表，id=1）
- [ ] 实现 `generator/config.py`：从 `LlmConfig` 表读取配置，带模块级内存缓存，更新时失效
- [ ] 新增后端路由：
  - `GET /api/admin/llm-config`（管理员，api_key mask 返回）
  - `PUT /api/admin/llm-config`（管理员，写入明文，触发缓存失效）
- [ ] 实现 `topics.py`：基于 `categories.CATEGORIES` 加载主题，附分论点方向与案例素材（内置素材池，JSON 常量）
- [ ] 实现 `llm_client.py`：OpenAI SDK 封装（参数来自 `config.load()`，`response_format: json_object`）
- [ ] 编写 `prompts.py`：系统 Prompt（申论写作方法论 + 五段三分式 + JSON Schema）+ 动态 Prompt（主题/分论点/案例注入）
- [ ] 实现 `renderer.py`：Python 字符串模板渲染 HTML（meta + 内联 style + .article-page + toggleAnalysis JS）
- [ ] 新增前端路由 `/admin/llm-config` + `LlmConfigView.vue` + `LlmConfigForm.vue`（表单含 provider/api_base/api_key/model/temperature/max_tokens/timeout，保存调用 PUT）
- [ ] **最小闭环验证**：后台配置 LLM → CLI 脚本 `python -m generator` 指定主题 → 调 LLM → 打印 HTML

**交付目标：** 跑通「后台配置 LLM → 指定主题 → LLM → HTML 字符串」，HTML 能被 `parseHtmlFile` 正确解析。

---

## Phase 2：生成引擎与入库（Week 3–4）

- [ ] 定义 LLM 输出 JSON Schema：`{ title, category, meta_description, sections: [{ type, sentences: [{ text, arg_type }] }] }`
- [ ] 实现 `renderer.py` 句子级标注：按 `arg_type` 包裹 `<span class="arg-{type}" data-text="{释义}" onclick="toggleAnalysis(this,'{type}')">`
- [ ] 实现 meta 自动注入：title / article-title / article-category / article-order / article-date / article-author / article-description
- [ ] 实现 `pipeline.py` 编排：LLM 生成 → renderer 封装 → 校验 → 写入 `Article` 表（复用 `get_db` + `Article` 模型 + `generate_slug`）
- [ ] 新增后端路由 `POST /api/admin/generate`（管理员守卫）：入参 `{ theme?, count, auto_publish }`，返回生成结果列表
- [ ] slug 去重：复用 `main.generate_slug` 逻辑，冲突时追加序号
- [ ] 生成日志：写入 `Article` 即为日志（含 created_at），无需独立索引文件

**交付目标：** 管理员调用 API → 范文自动入库 → 阅读站侧边栏立即可见。

---

## Phase 3：质量校验（Week 5）

- [ ] 实现 `validator.py` 结构校验：五段三分式（1 开头 + 3 分论点 + 1 结尾）
- [ ] 字数校验：正文 1000–1200 字（不含 meta/HTML 标签）
- [ ] 论证标注覆盖率：`arg_type` 种类 ≥ 5（point/case/quote/cause/contrast/...）
- [ ] 案例数量校验：`case` 类标注 ≤ 3
- [ ] span 完整性：每个 span 含 `class`、`onclick`、`data-text` 且非空
- [ ] 元数据校验：title/category/order/date 非空，category 属于十大板块（`is_valid_category`）
- [ ] 校验失败自动重生：硬错误（结构/字数）重试最多 3 次，软警告保留并标记
- [ ] 校验结果随 API 响应返回：`{ status, issues, article_id }`

**交付目标：** 生成后自检，不达标自动重生，API 响应含校验状态。

---

## Phase 4：前端集成与高级功能（Week 6–7）

- [ ] 新增前端路由 `/admin/generate`（AdminLayout 子路由，需管理员）
- [ ] 实现 `GenerateView.vue`：主题选择（十大板块下拉，复用 `shared/constants.js`）+ 篇数 + 生成按钮
- [ ] 实现 `GeneratePanel.vue`：调用 `POST /api/admin/generate`，展示生成进度与结果列表
- [ ] 生成结果支持「预览」（跳转阅读站 `/article/{slug}`）+「编辑」（跳转文章编辑器）
- [ ] 主题轮换策略：未指定主题时按板块顺序轮询（复用 `categories.CATEGORIES` 顺序）
- [ ] 案例素材库管理：后台增加素材库 CRUD 页面（新增 `Case` 表，与 `LlmConfig` 同样的数据库管理方式）
- [ ] 生成历史去重：基于标题相似度（简单字符串匹配，避免完全重复入库）
- [ ] 自定义样式主题：内联 style 支持白色简洁/纸质/深色三套（生成时选择）

**交付目标：** 管理员在后台可视化生成范文，生成后可直接预览/编辑，阅读站侧边栏实时刷新。

---

## 与现有系统的集成点（核对清单）

| 集成点 | 切合方式 |
|---|---|
| 十大板块 | `generator/topics.py` 直接 `from categories import CATEGORIES, is_valid_category` |
| 文章入库 | `pipeline.py` 复用 `database.get_db` + `Article` 模型，slug 复用 `main.generate_slug` |
| API 鉴权 | 新路由 `/api/admin/generate`、`/api/admin/llm-config` 均用 `Depends(get_admin_user)` |
| LLM 配置 | 新增 `LlmConfig` 表（单行 id=1），`generator/config.py` 读取，后台 `/admin/llm-config` 页面修改 |
| HTML 解析 | `renderer.py` 输出必须含 `<meta name="article-*">` + `.article-page > .article-content` 结构 |
| 交互 JS | `renderer.py` 内联的 `toggleAnalysis` 与 `web/src/analysis.js` 完全一致 |
| 前端分类 | `GenerateView.vue` 复用 `shared/constants.js` 的 `CATEGORIES` 渲染下拉 |
| 前端路由 | `/admin/generate`、`/admin/llm-config` 作为 `AdminLayout` 子路由，复用后台侧边栏与权限守卫 |
| 字段对齐 | 生成的 meta 字段与 `Article` 模型字段一一对应（title/category/order/date/author/description/content_html） |

---

## 依赖新增

仅新增 OpenAI SDK，其余全部复用现有依赖：

```
openai>=1.0.0   # requirements.txt 追加
```

无 Jinja2，HTML 渲染用 Python f-string / `string.Template`。
无独立文件存储，生成结果直接入 SQLite（`Article` 表）。
