import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import ShowList from '../pages/ShowList.vue'
import EpisodeList from '../pages/EpisodeList.vue'
import EpisodeRecord from '../pages/EpisodeRecord.vue'
import Statistics from '../pages/Statistics.vue'
import Search from '../pages/Search.vue'
import Timeline from '../pages/Timeline.vue'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../pages/Login.vue') },
  { path: '/', name: 'ShowList', component: ShowList, meta: { requiresAuth: true } },
  { path: '/show/:id', name: 'EpisodeList', component: EpisodeList, meta: { requiresAuth: true } },
  { path: '/episode/:id', name: 'EpisodeRecord', component: EpisodeRecord, meta: { requiresAuth: true } },
  { path: '/statistics', name: 'Statistics', component: Statistics, meta: { requiresAuth: true } },
  { path: '/search', name: 'Search', component: Search, meta: { requiresAuth: true } },
  { path: '/timeline', name: 'Timeline', component: Timeline, meta: { requiresAuth: true } },
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
