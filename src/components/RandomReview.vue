<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useShowsStore } from '../stores/shows'
import { categoryLabel } from '../utils/helpers'

const router = useRouter()
const showsStore = useShowsStore()

const loading = ref(false)
const visible = ref(false)
const review = ref(null)
const notFound = ref(false)

async function pickRandom() {
  loading.value = true
  notFound.value = false
  review.value = null

  try {
    const { shows, episodes, records } = await showsStore.fetchAllData()

    const ratedRecords = (records || []).filter(r => r.rating > 0 && r.review)
    if (ratedRecords.length === 0) {
      notFound.value = true
      visible.value = true
      loading.value = false
      return
    }

    const episodeMap = new Map()
    for (const ep of (episodes || [])) episodeMap.set(ep.id, ep)

    const showMap = new Map()
    for (const s of (shows || [])) showMap.set(s.id, s)

    const pick = ratedRecords[Math.floor(Math.random() * ratedRecords.length)]
    const episode = episodeMap.get(pick.episode_id)
    const show = episode ? showMap.get(episode.show_id) : null

    if (!episode || !show) {
      notFound.value = true
      visible.value = true
      loading.value = false
      return
    }

    review.value = {
      id: pick.id,
      showName: show.name,
      showCategory: show.category,
      showCover: show.cover_image,
      season: episode.season,
      episode: episode.episode,
      rating: pick.rating,
      review: pick.review || '',
      episodeId: episode.id,
    }
    visible.value = true
  } catch (e) {
    console.warn('随机回顾失败:', e)
  } finally {
    loading.value = false
  }
}

function close() {
  visible.value = false
  review.value = null
  notFound.value = false
}

function goToEpisode() {
  if (review.value) {
    router.push(`/episode/${review.value.episodeId}`)
    close()
  }
}

function stripHtml(html) {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || ''
}

function epLabel(r) {
  if (!r) return ''
  const cat = r.showCategory || 'tv'
  const s = String(r.season).padStart(2, '0')
  const e = String(r.episode).padStart(2, '0')
  if (cat === 'movie') return `第 ${r.episode} 部`
  if (cat === 'book') return `第 ${r.episode} 章`
  return `S${s}E${e}`
}

function onKeydown(e) {
  if (e.key === 'Escape') close()
}

defineExpose({ pickRandom })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" @click.self="close" @keydown="onKeydown" role="dialog" aria-modal="true" aria-label="随机回顾">
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md mx-4 border border-gray-200 dark:border-gray-700 shadow-2xl">
        <div v-if="notFound" class="text-center py-8">
          <div class="text-4xl mb-4">📝</div>
          <p class="text-gray-500 dark:text-gray-400">还没有带评论的笔记</p>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">写点感想后再来试试吧</p>
        </div>

        <template v-else-if="review">
          <div class="flex items-start gap-4 mb-4">
            <img v-if="review.showCover" :src="review.showCover" class="w-16 h-22 object-cover rounded-lg flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-lg text-gray-900 dark:text-gray-100 truncate">{{ review.showName }}</h3>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ epLabel(review) }}</span>
                <span v-if="review.showCategory" class="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{{ categoryLabel(review.showCategory) }}</span>
              </div>
              <div v-if="review.rating > 0" class="flex items-center gap-1 mt-2">
                <span class="text-amber-400 text-xl font-bold">{{ Number(review.rating).toFixed(1) }}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500">/ 10</span>
              </div>
            </div>
          </div>

          <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-4 max-h-48 overflow-y-auto">
            <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{{ stripHtml(review.review) }}</p>
          </div>

          <div class="flex gap-3">
            <button @click="pickRandom" :disabled="loading" class="flex-1 py-2.5 rounded-lg text-sm font-medium transition bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">
              {{ loading ? '换一条中...' : '换一条' }}
            </button>
            <button @click="goToEpisode" class="flex-1 py-2.5 rounded-lg text-sm font-medium transition bg-gray-800 hover:bg-gray-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500">
              查看完整记录
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
