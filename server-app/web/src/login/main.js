import { createApp } from 'vue'
import App from './App.vue'
// 复用共享样式（管理后台与登录页共用一份 CSS）
import '../shared/styles.css'

createApp(App).mount('#app')
