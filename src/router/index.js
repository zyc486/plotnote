import { createRouter, createWebHistory } from 'vue-router'
import ShowList from '../pages/ShowList.vue'
import EpisodeList from '../pages/EpisodeList.vue'
import EpisodeRecord from '../pages/EpisodeRecord.vue'
import Statistics from '../pages/Statistics.vue'
import Search from '../pages/Search.vue'
import Timeline from '../pages/Timeline.vue'

const routes = [
  { path: '/', name: 'ShowList', component: ShowList },
  { path: '/show/:id', name: 'EpisodeList', component: EpisodeList },
  { path: '/episode/:id', name: 'EpisodeRecord', component: EpisodeRecord },
  { path: '/statistics', name: 'Statistics', component: Statistics },
  { path: '/search', name: 'Search', component: Search },
  { path: '/timeline', name: 'Timeline', component: Timeline },
  { path: '/settings', name: 'Settings', component: () => import('../pages/Settings.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
