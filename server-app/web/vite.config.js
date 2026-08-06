import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 申论阅读站（前台）Vite 配置
// - base: '/' 阅读站部署在根路径
// - build.outDir: 'dist'，FastAPI 挂载 web/dist 作为根路径
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
      '/admin': {
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
