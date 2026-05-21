import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../pages/Login.vue') },
  { path: '/', name: 'ShowList', component: () => import('../pages/ShowList.vue'), meta: { requiresAuth: true } },
  { path: '/show/:id', name: 'EpisodeList', component: () => import('../pages/EpisodeList.vue'), meta: { requiresAuth: true } },
  { path: '/episode/:id', name: 'EpisodeRecord', component: () => import('../pages/EpisodeRecord.vue'), meta: { requiresAuth: true } },
  { path: '/statistics', name: 'Statistics', component: () => import('../pages/Statistics.vue'), meta: { requiresAuth: true } },
  { path: '/search', name: 'Search', component: () => import('../pages/Search.vue'), meta: { requiresAuth: true } },
  { path: '/timeline', name: 'Timeline', component: () => import('../pages/Timeline.vue'), meta: { requiresAuth: true } },
  { path: '/tags', name: 'TagCloud', component: () => import('../pages/TagCloud.vue'), meta: { requiresAuth: true } },
  { path: '/settings', name: 'Settings', component: () => import('../pages/Settings.vue'), meta: { requiresAuth: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!authStore.loading && !authStore.isLoggedIn && to.meta.requiresAuth) {
    return { name: 'Login' }
  }
})

export default router
