<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '../db'
import { useShowsStore } from '../stores/shows'
import { getTerminology } from '../utils/terminology'
import { CATEGORIES } from '../db'
import CoverImage from '../components/CoverImage.vue'

const props = defineProps(['toast'])

const route = useRoute()
const router = useRouter()

const show = ref(null)
const episodes = ref([])
const recordsMap = ref({})

const jumpInput = ref('')
const jumpError = ref('')
const activeSeason = ref(null)
const showCoverLightbox = ref(false)

const showsStore = useShowsStore()

const showCategory = computed(() => show.value?.category || 'tv')
const term = computed(() => getTerminology(showCategory.value))

const needsSeasonPrefix = computed(() => seasonKeys.value.length > 1)

const episodeGroups = computed(() => {
  const groups = {}
  for (const ep of episodes.value) {
    if (!groups[ep.season]) groups[ep.season] = []
    groups[ep.season].push(ep)
  }
  return groups
})

const seasonKeys = computed(() => {
  return Object.keys(episodeGroups.value).map(Number).sort((a, b) => a - b)
})

const filteredSeasonKeys = computed(() => {
  if (activeSeason.value === null) return seasonKeys.value
  return seasonKeys.value.filter(s => s === activeSeason.value)
})

const filteredEpisodes = computed(() => {
  if (activeSeason.value === null) return episodes.value
  return episodes.value.filter(ep => ep.season === activeSeason.value)
})

const filteredProgressText = computed(() => {
  const eps = filteredEpisodes.value
  const rated = eps.filter(ep => {
    const r = recordsMap.value[ep.id]
    return r && r.rating > 0
  }).length
  return `${rated} / ${eps.length}`
})

const filteredProgressPercent = computed(() => {
  const eps = filteredEpisodes.value
  if (!eps.length) return 0
  const rated = eps.filter(ep => {
    const r = recordsMap.value[ep.id]
    return r && r.rating > 0
  }).length
  return Math.round((rated / eps.length) * 100)
})

const filteredAvgRating = computed(() => {
  const eps = filteredEpisodes.value
  let sum = 0
  let count = 0
  for (const ep of eps) {
    const r = recordsMap.value[ep.id]
    if (r && r.rating > 0) {
      sum += r.rating
      count++
    }
  }
  if (count === 0) return 0
  return (sum / count).toFixed(1)
})

onMounted(async () => {
  const showId = Number(route.params.id)
  show.value = await showsStore.getShow(showId)
  episodes.value = await db.episodes.where({ showId }).toArray()
  episodes.value.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season
    return a.episode - b.episode
  })

  const episodeIds = episodes.value.map(e => e.id)
  const records = await db.records.where('episodeId').anyOf(episodeIds).toArray()

  recordsMap.value = {}
  for (const ep of episodes.value) {
    const epRecords = records.filter(r => r.episodeId === ep.id)
    const activeRecord = epRecords.find(r => r.id === ep.activeRecordId)
    if (activeRecord) {
      recordsMap.value[ep.id] = activeRecord
    }
  }

  if (episodes.value.length === 1) {
    router.replace(`/episode/${episodes.value[0].id}`)
  }
})

function getRecord(episodeId) {
  return recordsMap.value[episodeId]
}

function goToEpisode(episodeId) {
  router.push(`/episode/${episodeId}`)
}

function categoryLabel(key) {
  const cat = CATEGORIES.find(c => c.key === key)
  return cat ? cat.label : key
}

function statusLabel(status) {
  return { want: '想看', watching: '在看', finished: '看完', dropped: '弃坑' }[status] || ''
}

function statusColor(status) {
  return {
    want: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    watching: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    finished: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    dropped: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  }[status] || ''
}

function goToStats() {
  router.push('/statistics')
}

function goBack() {
  router.push('/')
}

function toggleSeason(season) {
  activeSeason.value = activeSeason.value === season ? null : season
}

function handleJump() {
  jumpError.value = ''
  const raw = jumpInput.value.trim().toUpperCase()
  if (!raw) return

  let target = null

  if (needsSeasonPrefix.value) {
    const patterns = [
      /^S(\d+)E(\d+)$/i,
      /^(\d+)-(\d+)$/,
      /^(\d+)\s+(\d+)$/,
      /^(\d+),(\d+)$/,
    ]
    let season = null
    let episode = null
    for (const p of patterns) {
      const m = raw.match(p)
      if (m) {
        season = Number(m[1])
        episode = Number(m[2])
        break
      }
    }
    if (!season || !episode) {
      jumpError.value = '格式：S5E10 或 5-10'
      return
    }
    target = episodes.value.find(e => e.season === season && e.episode === episode)
    if (!target) {
      jumpError.value = `未找到 S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
      return
    }
  } else {
    const num = Number(raw)
    if (!num || num < 1) {
      jumpError.value = `请输入集数（1-${episodes.value.length}）`
      return
    }
    target = episodes.value.find(e => e.episode === num)
    if (!target) {
      jumpError.value = `未找到第 ${num} ${term.value.episodeLabel}`
      return
    }
  }

  goToEpisode(target.id)
}
</script>

<template>
  <div class="max-w-2xl mx-auto p-4 md:p-6">
    <button
      @click="goBack"
      class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm mb-6 block transition"
    >
      ← 返回
    </button>

    <div v-if="show" class="mb-6">
      <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <CoverImage :src="show.coverImage" :name="show.name" size="lg" clickable @click="showCoverLightbox = true" />
        <div class="flex-1 min-w-0">
          <h1 class="text-xl md:text-2xl font-bold">{{ show.name }}</h1>
          <div class="flex items-center gap-1.5 md:gap-2 mt-1 flex-wrap">
            <span v-if="show.category" class="px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{{ categoryLabel(show.category) }}</span>
            <span v-if="show.status" class="px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded-full" :class="statusColor(show.status)">{{ statusLabel(show.status) }}</span>
            <span v-if="show.region" class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">{{ show.region }}</span>
            <template v-if="show.genres && show.genres.length > 0">
              <span v-for="g in show.genres.slice(0, 3)" :key="g" class="px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 hidden sm:inline">{{ g }}</span>
            </template>
            <button @click="goToStats" class="text-[10px] md:text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition ml-auto">查看统计 →</button>
          </div>
          <div class="flex items-center gap-2 md:gap-4 mt-2 flex-wrap">
            <span class="text-gray-500 dark:text-gray-400 text-xs md:text-sm">
              进度: {{ filteredProgressText }}
              <span v-if="activeSeason !== null && needsSeasonPrefix" class="text-gray-400 dark:text-gray-500">(第{{ activeSeason }}季)</span>
            </span>
            <div class="flex items-center gap-1.5 flex-1 max-w-xs">
              <div class="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  :style="{ width: filteredProgressPercent + '%' }"
                ></div>
              </div>
              <span class="text-[10px] md:text-xs text-gray-400 dark:text-gray-500">{{ filteredProgressPercent }}%</span>
            </div>
            <span v-if="filteredAvgRating > 0" class="text-amber-400 font-bold text-sm md:text-base">
              {{ filteredAvgRating }} 均分
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="needsSeasonPrefix" class="mb-6 space-y-3">
      <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <span class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">筛选：</span>
        <button
          v-for="s in seasonKeys"
          :key="s"
          @click="toggleSeason(s)"
          class="px-3 py-1 text-xs rounded-full transition whitespace-nowrap flex-shrink-0"
          :class="activeSeason === s ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 hover:bg-gray-300 text-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400'"
        >
          S{{ String(s).padStart(2, '0') }}
        </button>
        <button
          v-if="activeSeason !== null"
          @click="activeSeason = null"
          class="px-2 py-1 text-xs rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 transition whitespace-nowrap flex-shrink-0"
        >
          全部
        </button>
      </div>

      <div class="flex items-center gap-2">
        <input
          v-model="jumpInput"
          type="text"
          placeholder="输入集数跳转，如 S5E10 或 5-10"
          class="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 dark:border-gray-700"
          @keyup.enter="handleJump"
        />
        <button
          @click="handleJump"
          class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-lg text-sm font-medium transition"
        >
          跳转
        </button>
      </div>
      <p v-if="jumpError" class="text-xs text-red-500 dark:text-red-400">{{ jumpError }}</p>
    </div>

    <div v-else-if="episodes.length > 1" class="mb-6 space-y-3">
      <div class="flex items-center gap-2">
        <input
          v-model="jumpInput"
          type="text"
          :placeholder="`输入${term.episodeLabel}数跳转（1-${episodes.length}）`"
          class="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 dark:border-gray-700"
          @keyup.enter="handleJump"
        />
        <button
          @click="handleJump"
          class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-lg text-sm font-medium transition"
        >
          跳转
        </button>
      </div>
      <p v-if="jumpError" class="text-xs text-red-500 dark:text-red-400">{{ jumpError }}</p>
    </div>

    <div v-if="episodes.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-12">
      暂无数据
    </div>

    <div v-for="season in filteredSeasonKeys" :key="season" class="mb-8">
      <h2 v-if="needsSeasonPrefix" class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">第 {{ season }} {{ term.seasonLabel }}</h2>
      <div class="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
        <div
          v-for="ep in episodeGroups[season]"
          :key="ep.id"
          @click="goToEpisode(ep.id)"
          class="flex flex-col items-center justify-center aspect-square rounded-xl cursor-pointer transition border"
          :class="getRecord(ep.id)?.rating > 0
            ? 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-700 dark:hover:bg-indigo-900/50'
            : 'bg-gray-100 border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700'"
        >
          <span class="text-sm font-semibold text-gray-600 dark:text-gray-300">{{ String(ep.episode).padStart(2, '0') }}</span>
          <span v-if="getRecord(ep.id)?.rating > 0" class="text-xs font-bold text-amber-400 mt-0.5">{{ Number(getRecord(ep.id).rating).toFixed(1) }}</span>
          <span v-else class="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">—</span>
        </div>
      </div>
    </div>

    <div v-if="showCoverLightbox" @click="showCoverLightbox = false" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 md:p-8 cursor-pointer">
      <img :src="show.coverImage" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl" @click.stop />
    </div>
  </div>
</template>
