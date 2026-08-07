import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 申论阅读站 + 登录页 + 管理后台 单 SPA 配置
// - 单一入口 index.html → /src/main.js
// - 通过 Vue Router 嵌套路由 + 布局组件分离阅读站/登录页/管理后台
// - 构建产物 dist/index.html + dist/assets/*，由后端 catch-all 统一托管
// - dev server proxy: /api → 后端 8000，开发时避免跨域
export default defineConfig({
  plugins: [vue()],
  base: '/',
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
