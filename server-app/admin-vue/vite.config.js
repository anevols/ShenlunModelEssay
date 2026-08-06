import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// Vite 配置：
// - 开发时 dev server 跑在 5173，/api 请求代理到 FastAPI(8000)，避免跨域
// - 构建产物输出到 ../admin，由 FastAPI 同源托管
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
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
    // 输出到 server-app/admin，替换原静态版
    outDir: path.resolve(__dirname, '../admin'),
    emptyOutDir: true,
  },
  // 阅读站由 FastAPI 托管在根路径，admin 构建产物也由 FastAPI 托管在 /admin
  // 同源部署，base 用相对路径，避免资源路径错位
  base: '/admin/',
})
