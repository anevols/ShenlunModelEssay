import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { setupToggleAnalysis } from './analysis.js'
import './styles.css'

const app = createApp(App)
app.use(router)
app.mount('#app')

// 暴露 toggleAnalysis 到 window，供文章正文中内联 onclick="toggleAnalysis(...)" 调用
// 文章 content_html 中的交互 <span> 依赖此全局函数
setupToggleAnalysis()
