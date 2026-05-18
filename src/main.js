import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { useAuthStore } from './stores/auth'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// 全局错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('Global error:', err, info)
}

const authStore = useAuthStore()
authStore.init().then(() => {
  app.mount('#app')
}).catch((err) => {
  console.error('Auth init failed:', err)
  // 即使认证初始化失败也挂载应用，让用户看到登录页
  app.mount('#app')
})
