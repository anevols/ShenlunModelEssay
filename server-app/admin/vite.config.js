import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 申论阅读站 · 管理后台 Vite 配置
// - base: '/admin/' 保证构建后静态资源路径与 FastAPI 托管路径一致
// - build.outDir: 'dist'，FastAPI 挂载 admin/dist 作为 /admin
// - dev server proxy: /api → 后端 8000，开发时避免跨域
export default defineConfig({
  plugins: [vue()],
  base: '/admin/',
  server: {
    port: 5173,
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
