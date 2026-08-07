# 单 SPA 改造计划

> 目标：将现有「阅读站 / 登录页 / 管理后台」三个独立 Vue 应用（三个 HTML 入口）合并为**单一 SPA**，通过 Vue Router 嵌套路由 + 布局组件分离各功能模块，统一构建产物、统一后端托管。

---

## 一、现状分析

### 当前结构（多入口）

```
web/
├─ index.html          → 阅读站，入口 src/main.js
├─ login.html          → 登录页，入口 src/login/main.js
├─ admin.html          → 管理后台，入口 src/admin/main.js
├─ vite.config.js      → rollupOptions.input 配置三个入口
└─ src/
   ├─ main.js          → 阅读站入口
   ├─ App.vue          → 阅读站根组件（含导航栏 + 侧边栏 + router-view）
   ├─ router.js        → 阅读站路由（/, /article/:slug）
   ├─ analysis.js      → 文章交互句解析
   ├─ styles.css       → 阅读站样式
   ├─ components/Sidebar.vue
   ├─ views/ArticleView.vue
   ├─ login/           → 登录页独立应用
   │  ├─ main.js
   │  └─ App.vue
   └─ admin/           → 管理后台独立应用
      ├─ main.js
      ├─ App.vue
      ├─ router.js     → /admin/* 路由，守卫用 window.location 跳 /login
      ├─ auth.js       → 转出口 shared/auth.js
      ├─ utils.js      → HTML 文件解析
      ├─ views/Dashboard.vue
      └─ components/ArticleEditor.vue
```

### 后端（server/main.py）

- `/login`、`/login/` → 返回 `login.html`
- `/admin` → 307 重定向到 `/admin/`
- `/admin/{full_path:path}` → 静态文件优先，否则回退 `admin.html`
- `/{full_path:path}` → 静态文件优先，否则回退 `index.html`

### 现状问题

1. 三个独立 Vue 应用，**状态/登录态无法跨应用共享**，必须靠 `window.location` 整页跳转。
2. 多入口构建产物分散，后端需为 `/login`、`/admin` 维护专用 fallback 路由。
3. 阅读站 `App.vue` 把「导航栏 + 侧边栏」与「路由出口」耦合，无法复用到后台。
4. 后台路由守卫只能用 `window.location.href` 跳转，体验差。
5. 共享样式 `shared/styles.css` 与阅读站 `styles.css` 中 `:root` 变量名重复，存在覆盖风险。

---

## 二、目标结构（单 SPA）

### 文件结构

```
web/
├─ index.html                  ← 唯一 HTML 入口
├─ vite.config.js              ← 单入口构建
└─ src/
   ├─ main.js                  ← 唯一应用入口
   ├─ App.vue                  ← 根组件，仅 <router-view />
   ├─ router.js                ← 统一路由 + 权限守卫
   ├─ analysis.js              ← 文章交互（不变）
   ├─ styles.css               ← 阅读站样式（不变）
   ├─ shared/
   │  ├─ auth.js               ← 认证 & API（不变）
   │  ├─ constants.js          ← 主题板块枚举（不变）
   │  └─ styles.css            ← 后台/登录页样式（作用域隔离）
   ├─ layouts/                 ← 新增：布局组件
   │  ├─ ReaderLayout.vue      ← 阅读站布局（导航栏 + 侧边栏 + outlet）
   │  ├─ AuthLayout.vue        ← 登录页布局（简洁导航 + outlet）
   │  └─ AdminLayout.vue       ← 管理后台布局（导航栏 + 侧边栏 + outlet）
   ├─ components/
   │  └─ Sidebar.vue           ← 文章目录侧边栏（阅读站 + 后台共用）
   ├─ views/
   │  ├─ ArticleView.vue       ← 阅读站文章详情
   │  ├─ LoginView.vue         ← 登录/注册（原 login/App.vue 迁移）
   │  └─ DashboardView.vue     ← 后台文章管理（原 admin/views/Dashboard.vue 迁移）
   └─ admin/
      ├─ components/ArticleEditor.vue   ← 保留
      └─ utils.js                       ← 保留（HTML 解析）
```

### 路由设计（嵌套路由 + 守卫）

```
/login                  → AuthLayout
  └─ ''                 → LoginView
/admin                  → AdminLayout  (meta.requiresAdmin)
  └─ ''                 → 重定向 /admin/dashboard
  └─ dashboard          → DashboardView
/                       → ReaderLayout
  ├─ ''                 → ArticleView（首页，自动跳第一篇）
  └─ article/:slug      → ArticleView
*                       → 重定向 /
```

**权限守卫**（`router.beforeEach`）：
- 目标路由 `meta.requiresAdmin` 为真：
  - 无 token → 重定向 `{ name: 'login' }`
  - 已登录但非管理员 → 重定向 `{ name: 'login', query: { forbidden: '1' } }`
- 其余路由直接放行。

登录成功后用 `router.push` 跳转（不再 `location.href`），登录态通过响应式变量 + `storage` 事件跨布局同步。

### 样式作用域隔离

- 阅读站 `styles.css`：作用在 `body`，全局变量 `--bg: #fff` 等。
- 后台/登录 `shared/styles.css`：
  - 将 `:root` 变量声明改为 `.app-admin, .app-auth { --bg: #f6f8fa; ... }` 作用域内覆盖。
  - AdminLayout/AuthLayout 根元素加 `class="app-admin"` / `class="app-auth"`。
  - 避免污染阅读站全局变量。

---

## 三、迁移对照表

| 旧文件 | 处理 | 新位置 / 说明 |
|---|---|---|
| `index.html` | 改 | 唯一入口，引用 `/src/main.js` |
| `login.html` | 删 | 合并到 `index.html` |
| `admin.html` | 删 | 合并到 `index.html` |
| `vite.config.js` | 改 | 移除 `rollupOptions.input`，单入口 |
| `src/main.js` | 改 | 导入统一 router + 两份样式，挂载 setupToggleAnalysis |
| `src/App.vue` | 改 | 精简为 `<router-view />` |
| `src/router.js` | 改 | 整合三套路由 + 守卫 |
| `src/login/main.js` | 删 | - |
| `src/login/App.vue` | 迁 | `src/views/LoginView.vue`，改用 `router.push`、加 `app-auth` 根类 |
| `src/admin/main.js` | 删 | - |
| `src/admin/App.vue` | 删 | - |
| `src/admin/router.js` | 删 | 合并到 `src/router.js` |
| `src/admin/auth.js` | 删 | 直接引用 `shared/auth.js` |
| `src/admin/utils.js` | 保留 | 不动 |
| `src/admin/views/Dashboard.vue` | 迁 | `src/views/DashboardView.vue`，去掉自带顶部栏（由 AdminLayout 提供），改 `router.push` |
| `src/admin/components/ArticleEditor.vue` | 保留 | 不动 |
| `src/components/Sidebar.vue` | 改 | 增加用途区分（reader/admin），支持外部链接模式（后台可复用文章目录导航） |
| 新增 `src/layouts/ReaderLayout.vue` | 新 | 承接原 `App.vue` 的导航栏 + 侧边栏 + outlet |
| 新增 `src/layouts/AuthLayout.vue` | 新 | 简洁顶部栏 + outlet |
| 新增 `src/layouts/AdminLayout.vue` | 新 | 顶部栏 + 侧边栏（沿用阅读站样式） + outlet |
| `server/main.py` | 改 | 移除 `/login`、`/admin` 专用路由，统一 catch-all fallback |

---

## 四、后端改造

`server/main.py`：

- 删除 `login_serve`、`admin_root_redirect`、`admin_serve` 三个路由。
- 保留所有 `/api/*` 路由。
- catch-all 路由 `/{full_path:path}`：
  - 静态文件存在 → 返回文件。
  - 否则回退 `index.html`（SPA history 模式）。
  - 对 `/api/*` 前缀但未匹配的路径返回 404（避免被 SPA fallback 误处理为 200）。

---

## 五、构建与部署

### Vite 配置（单入口）

```js
export default defineConfig({
  plugins: [vue()],
  base: '/',
  server: { port: 5174, proxy: { '/api': 'http://127.0.0.1:8000' } },
  build: { outDir: 'dist', emptyOutDir: true },
  // 不再需要 rollupOptions.input
})
```

构建产物：`dist/index.html` + `dist/assets/*`，由后端 catch-all 统一托管。

### 启动流程

```bash
# 1. 前端构建
cd web && npm run build

# 2. 后端启动（同时托管前端）
cd ../server && uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 六、实施步骤（执行顺序）

1. **新建布局组件**：`ReaderLayout.vue`、`AuthLayout.vue`、`AdminLayout.vue`。
   - `ReaderLayout` 承接原 `App.vue` 全部布局逻辑（导航栏、侧边栏、搜索、登录态显示、移动端开关）。
   - `AuthLayout` 承接原 `login/App.vue` 顶部栏。
   - `AdminLayout` 沿用阅读站侧边栏样式，顶部栏含品牌、用户名、退出，侧边栏可放后台功能导航（当前仅「文章管理」）。

2. **迁移视图**：
   - `login/App.vue` → `views/LoginView.vue`：根元素加 `app-auth` 类；登录成功改 `router.push`；已登录访问改 `router.replace`。
   - `admin/views/Dashboard.vue` → `views/DashboardView.vue`：去掉自带顶部栏（由 AdminLayout 提供）；退出改 `router.push('/login')`；未登录兜底改 `router.push`。

3. **整合路由** `src/router.js`：按上文「路由设计」实现嵌套路由 + 守卫。

4. **精简根组件** `src/App.vue` 为 `<router-view />`；`src/main.js` 导入统一 router 与两份样式。

5. **样式作用域**：`shared/styles.css` 把 `:root` 变量收敛到 `.app-admin, .app-auth`。

6. **清理多入口**：删除 `login.html`、`admin.html`、`src/login/`、`src/admin/main.js`、`src/admin/App.vue`、`src/admin/router.js`、`src/admin/auth.js`。

7. **Vite 配置**：改为单入口。

8. **后端改造** `server/main.py`：删除 `/login`、`/admin` 路由，catch-all 增加 `/api/*` 404 检查。

9. **构建 + 启动 + 预览验证**。

---

## 七、验证清单

- [ ] `npm run build` 无报错，产物仅 `dist/index.html` + `assets/`。
- [ ] 访问 `/` 进入阅读站，文章列表、文章详情、上下篇、TOC、交互句解析框正常。
- [ ] 访问 `/login` 进入登录页，登录成功后按角色跳转（管理员 → `/admin/dashboard`，普通用户 → `/`）。
- [ ] 未登录访问 `/admin/dashboard` → 重定向 `/login`。
- [ ] 普通用户访问 `/admin/dashboard` → 重定向 `/login?forbidden=1` 并显示无权限提示。
- [ ] 管理员后台可新建/编辑/删除文章，保存后列表刷新。
- [ ] 后台侧边栏沿用阅读站样式，窄屏下侧边栏常驻可见（后台无折叠开关）。
- [ ] 阅读站导航栏右侧不显示账户图标，登录态以文字链接呈现（登录 / 用户名 + 退出 / 管理后台入口）。
- [ ] 阅读站侧边栏展开/关闭图标正常工作。
- [ ] 直接刷新 `/article/xxx`、`/admin/dashboard`、`/login` 均 200 且渲染正确（SPA history fallback）。
- [ ] 未匹配的 `/api/xxx` 返回 404，不被 SPA fallback 处理为 200。
- [ ] 阅读站与后台 CSS 变量互不污染（`--bg` 等不串值）。
