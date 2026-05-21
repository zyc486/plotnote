<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useShowsStore } from '../stores/shows'
import { categoryLabel } from '../utils/helpers'
import { episodeLabel as epLabel } from '../utils/terminology'

const router = useRouter()
const showsStore = useShowsStore()

const loading = ref(true)
const allTags = ref([])
const selectedTag = ref(null)
const tagRecords = ref([])

function parseJsonSafe(str) {
  try { return JSON.parse(str) } catch { return [] }
}

function epLabelStr(ep, category) {
  return epLabel(ep, category || 'tv')
}

onMounted(async () => {
  try {
    const { shows, episodes, records } = await showsStore.fetchAllData()

    const showMap = new Map()
    for (const s of (shows || [])) showMap.set(s.id, s)

    const episodeMap = new Map()
    for (const ep of (episodes || [])) episodeMap.set(ep.id, ep)

    const tagCounts = {}
    for (const rec of (records || [])) {
      const tags = parseJsonSafe(rec.tags)
      for (const tag of tags) {
        if (!tag) continue
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }
    }

    const sorted = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))

    allTags.value = sorted
  } catch (e) {
    console.warn('加载标签失败:', e)
  } finally {
    loading.value = false
  }
})

const maxCount = computed(() => {
  if (allTags.value.length === 0) return 1
  return allTags.value[0].count
})

function tagSize(count) {
  const ratio = count / maxCount.value
  if (ratio >= 0.8) return 'text-2xl font-bold'
  if (ratio >= 0.5) return 'text-xl font-semibold'
  if (ratio >= 0.3) return 'text-lg font-medium'
  if (ratio >= 0.15) return 'text-base'
  return 'text-sm'
}

function tagColor(count) {
  const ratio = count / maxCount.value
  if (ratio >= 0.8) return 'text-indigo-600 dark:text-indigo-400'
  if (ratio >= 0.5) return 'text-indigo-500 dark:text-indigo-400'
  if (ratio >= 0.3) return 'text-gray-700 dark:text-gray-300'
  return 'text-gray-500 dark:text-gray-400'
}

async function selectTag(tagName) {
  selectedTag.value = tagName
  try {
    const { shows, episodes, records } = await showsStore.fetchAllData()

    const showMap = new Map()
    for (const s of (shows || [])) showMap.set(s.id, s)

    const episodeMap = new Map()
    for (const ep of (episodes || [])) episodeMap.set(ep.id, ep)

    const matched = []
    for (const rec of (records || [])) {
      const tags = parseJsonSafe(rec.tags)
      if (!tags.includes(tagName)) continue

      const episode = episodeMap.get(rec.episode_id)
      if (!episode) continue
      const show = showMap.get(episode.show_id)
      if (!show) continue

      matched.push({
        id: rec.id,
        showName: show.name,
        showCategory: show.category,
        episodeId: episode.id,
        season: episode.season,
        episode: episode.episode,
        rating: rec.rating || 0,
        review: (rec.review || '').replace(/<[^>]*>/g, '').slice(0, 100),
        watchedDate: rec.watched_date,
      })
    }

    matched.sort((a, b) => {
      if (!a.watchedDate && !b.watchedDate) return 0
      if (!a.watchedDate) return 1
      if (!b.watchedDate) return -1
      return b.watchedDate.localeCompare(a.watchedDate)
    })

    tagRecords.value = matched
  } catch (e) {
    console.warn('加载标签记录失败:', e)
    tagRecords.value = []
  }
}

function clearSelection() {
  selectedTag.value = null
  tagRecords.value = []
}

function goToEpisode(id) {
  router.push(`/episode/${id}`)
}

function goBack() {
  if (selectedTag.value) {
    clearSelection()
  } else if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<template>
  <div class="max-w-2xl mx-auto p-4 md:p-6">
    <header class="flex items-center justify-between mb-8">
      <div class="flex items-center gap-3">
        <button @click="goBack" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm transition">← 返回</button>
        <h1 class="text-2xl font-bold">{{ selectedTag ? `#${selectedTag}` : '标签云' }}</h1>
      </div>
      <span v-if="!selectedTag && allTags.length > 0" class="text-xs text-gray-400 dark:text-gray-500">{{ allTags.length }} 个标签</span>
    </header>

    <div v-if="loading" class="text-center text-gray-400 dark:text-gray-500 py-12">加载中...</div>

    <div v-else-if="allTags.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-12">
      <p class="text-lg mb-2">暂无标签</p>
      <p class="text-sm">在记录中添加标签后会出现在这里</p>
    </div>

    <template v-else-if="!selectedTag">
      <div class="flex flex-wrap gap-3 justify-center py-4">
        <button
          v-for="tag in allTags"
          :key="tag.name"
          @click="selectTag(tag.name)"
          class="px-3 py-1.5 rounded-full transition hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          :class="[tagSize(tag.count), tagColor(tag.count)]"
        >
          {{ tag.name }}
          <span class="text-[10px] text-gray-400 dark:text-gray-500 ml-0.5">{{ tag.count }}</span>
        </button>
      </div>

      <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">热门标签</h3>
        <div class="space-y-2">
          <div
            v-for="tag in allTags.slice(0, 10)"
            :key="tag.name"
            @click="selectTag(tag.name)"
            class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition border border-gray-200 dark:border-gray-700"
          >
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">{{ tag.name }}</span>
            <div class="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-indigo-500 rounded-full transition-all duration-500" :style="{ width: (tag.count / maxCount * 100) + '%' }"></div>
            </div>
            <span class="text-xs text-gray-400 dark:text-gray-500 w-8 text-right">{{ tag.count }}</span>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="mb-4 flex items-center justify-between">
        <p class="text-sm text-gray-500 dark:text-gray-400">共 {{ tagRecords.length }} 条记录</p>
        <button @click="clearSelection" class="text-xs text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 dark:hover:text-indigo-300 transition">← 返回标签云</button>
      </div>

      <div v-if="tagRecords.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-8">
        该标签下暂无记录
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="rec in tagRecords"
          :key="rec.id"
          @click="goToEpisode(rec.episodeId)"
          class="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition"
        >
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{{ rec.showName }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ epLabelStr({ season: rec.season, episode: rec.episode }, rec.showCategory) }}</span>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span v-if="rec.rating > 0" class="text-sm font-bold text-amber-400">★{{ Number(rec.rating).toFixed(1) }}</span>
              <span v-if="rec.watchedDate" class="text-xs text-gray-400 dark:text-gray-500">{{ formatDate(rec.watchedDate) }}</span>
            </div>
          </div>
          <p v-if="rec.review" class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{{ rec.review }}</p>
        </div>
      </div>
    </template>
  </div>
</template>
