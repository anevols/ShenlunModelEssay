import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { setupToggleAnalysis } from './analysis.js'
// 阅读站样式（全局基础变量）
import './styles.css'
// 后台/登录页样式（作用域内覆盖变量，通过 .app-admin / .app-auth 限定）
import './shared/styles.css'

const app = createApp(App)
app.use(router)
app.mount('#app')

// 暴露 toggleAnalysis 到 window，供文章正文中内联 onclick="toggleAnalysis(...)" 调用
// 文章 content_html 中的交互 <span> 依赖此全局函数
setupToggleAnalysis()
