<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../db'
import { CATEGORIES } from '../db'
import { episodeLabel as epLabel } from '../utils/terminology'

const router = useRouter()
const timeline = ref([])
const loading = ref(true)

function categoryLabel(key) {
  const cat = CATEGORIES.find(c => c.key === key)
  return cat ? cat.label : ''
}

function categoryIcon(key) {
  switch (key) {
    case 'tv': return '📺'
    case 'movie': return '🎬'
    case 'animation': return '🎌'
    case 'book': return '📖'
    default: return '📺'
  }
}

function formatDateStr(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function formatMonthKey(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

function getEpisodeLabel(ep, category) {
  if (!ep) return ''
  return epLabel(ep, category || 'tv')
}

async function loadTimeline() {
  loading.value = true
  try {
    const records = await db.records.toArray()
    const episodes = await db.episodes.toArray()
    const shows = await db.shows.toArray()

    const showMap = {}
    for (const s of shows) showMap[s.id] = s

    const episodeMap = {}
    for (const ep of episodes) episodeMap[ep.id] = ep

    const items = []
    for (const record of records) {
      const episode = episodeMap[record.episodeId]
      if (!episode) continue
      const show = showMap[episode.showId]
      if (!show) continue

      const dateStr = record.watchedDate || new Date(record.createdAt).toISOString().split('T')[0]
      items.push({
        id: record.id,
        dateStr,
        showName: show.name,
        showCategory: show.category,
        episodeLabel: getEpisodeLabel(episode, show.category),
        rating: record.rating,
        review: record.review || '',
        showId: show.id,
        episodeId: episode.id,
      })
    }

    items.sort((a, b) => {
      if (!a.dateStr && !b.dateStr) return 0
      if (!a.dateStr) return 1
      if (!b.dateStr) return -1
      return b.dateStr.localeCompare(a.dateStr)
    })

    const grouped = {}
    for (const item of items) {
      const monthKey = formatMonthKey(item.dateStr)
      if (!grouped[monthKey]) grouped[monthKey] = []

      const dayKey = item.dateStr
      const monthGroup = grouped[monthKey]
      let dayGroup = monthGroup.find(d => d.date === dayKey)
      if (!dayGroup) {
        dayGroup = { date: dayKey, dateLabel: formatDateStr(dayKey), items: [] }
        monthGroup.push(dayGroup)
      }
      dayGroup.items.push(item)
    }

    timeline.value = Object.entries(grouped).map(([month, days]) => ({
      month,
      days,
    }))
  } catch (e) {
    console.warn('Failed to load timeline:', e)
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/')
}

function goToEpisode(id) {
  router.push(`/episode/${id}`)
}

function stripMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s/gm, '')
    .replace(/^\d+\.\s/gm, '')
    .replace(/^>\s/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 120)
}

onMounted(loadTimeline)
</script>

<template>
  <div class="max-w-2xl mx-auto p-4 md:p-6">
    <header class="flex items-center justify-between mb-8">
      <div class="flex items-center gap-3">
        <button @click="goBack" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm transition">← 返回</button>
        <h1 class="text-2xl font-bold">观看时间线</h1>
      </div>
    </header>

    <div v-if="loading" class="text-center text-gray-400 dark:text-gray-500 py-12">加载中...</div>

    <div v-else-if="timeline.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-12">
      <p class="text-lg mb-2">暂无观看记录</p>
      <p class="text-sm">开始记录你的观影时光吧</p>
    </div>

    <div v-else class="space-y-8">
      <div v-for="group in timeline" :key="group.month">
        <h2 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">{{ group.month }}</h2>

        <div class="space-y-4">
          <div v-for="day in group.days" :key="day.date">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{{ day.dateLabel }}</h3>
            <div class="space-y-2 ml-3 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
              <div
                v-for="item in day.items"
                :key="item.id"
                @click="goToEpisode(item.episodeId)"
                class="bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 rounded-lg p-3 cursor-pointer transition border border-gray-200 dark:border-gray-700"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="flex-shrink-0">{{ categoryIcon(item.showCategory) }}</span>
                    <span class="font-medium text-sm truncate">{{ item.showName }}</span>
                    <span v-if="item.episodeLabel" class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ item.episodeLabel }}</span>
                  </div>
                  <span v-if="item.rating > 0" class="text-sm font-bold text-amber-400 flex-shrink-0 ml-2">★{{ Number(item.rating).toFixed(1) }}</span>
                </div>
                <p v-if="item.review" class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{{ stripMarkdown(item.review) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
