import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// 申论阅读站 + 登录页 + 管理后台 统一 Vite 配置（多入口）
// - index.html → 阅读站，部署在根路径 /
// - login.html → 登录/注册页，部署在 /login
// - admin.html → 管理后台，部署在 /admin/
// - 同一份依赖、一次构建，输出到 dist/
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
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
})
