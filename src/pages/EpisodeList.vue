<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useShowsStore } from '../stores/shows'
import { useEpisodesStore } from '../stores/episodes'
import { getTerminology } from '../utils/terminology'
import { findShowCredits } from '../utils/tmdb'
import { parseGenres, categoryLabel, statusLabel, statusColor } from '../utils/helpers'
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
const credits = ref({ cast: [], crew: [] })
const creditsExpanded = ref(false)
const loadingCredits = ref(false)

const showsStore = useShowsStore()
const episodesStore = useEpisodesStore()

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

watch(showCoverLightbox, (val) => {
  if (val) {
    document.addEventListener('keydown', onLightboxKeydown)
  } else {
    document.removeEventListener('keydown', onLightboxKeydown)
  }
})

onMounted(async () => {
  const showId = Number(route.params.id)
  show.value = await showsStore.getShow(showId)

  // 异步加载演职员信息
  loadCredits()

  const { episodes: eps, recordsByEpisode } = await episodesStore.fetchEpisodesWithRecords(showId)
  episodes.value = eps

  recordsMap.value = {}
  for (const ep of episodes.value) {
    const epRecords = recordsByEpisode[ep.id] || []
    const activeRecord = epRecords.find(r => r.id === ep.active_record_id)
    if (activeRecord) {
      recordsMap.value[ep.id] = activeRecord
    }
  }

})

onUnmounted(() => {
  document.removeEventListener('keydown', onLightboxKeydown)
})

function getRecord(episodeId) {
  return recordsMap.value[episodeId]
}

function goToEpisode(episodeId) {
  router.push(`/episode/${episodeId}`)
}

async function loadCredits() {
  if (!show.value) return
  const cat = show.value.category || 'tv'
  if (cat === 'book') return // 图书没有演职员
  loadingCredits.value = true
  try {
    const result = await findShowCredits(show.value.name, cat === 'movie' ? 'movie' : 'tv')
    credits.value = result
  } catch {
    credits.value = { cast: [], crew: [] }
  } finally {
    loadingCredits.value = false
  }
}


function onLightboxKeydown(e) {
  if (e.key === 'Escape') showCoverLightbox.value = false
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

    <div v-if="show" class="mb-4">
      <div class="flex flex-row gap-4 items-stretch">
        <div class="relative flex-shrink-0 cursor-pointer hover:opacity-80 transition self-center" @click="showCoverLightbox = true">
          <CoverImage :src="show.coverImage" :name="show.name" size="xl" />
        </div>
        <div class="flex-1 min-w-0 flex flex-col justify-between">
          <h1 class="text-2xl md:text-3xl font-bold leading-tight text-center">{{ show.name }}</h1>
          <div class="flex flex-col items-center">
            <span v-if="filteredAvgRating > 0" class="text-3xl md:text-4xl font-bold text-amber-400">{{ filteredAvgRating }}</span>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap justify-center">
            <span v-if="show.status" class="px-1.5 py-0.5 text-[10px] md:text-xs rounded-full" :class="statusColor(show.status)">{{ statusLabel(show.status) }}</span>
            <span v-if="show.region" class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">{{ show.region }}</span>
            <template v-if="parseGenres(show).length > 0">
              <span v-for="g in parseGenres(show).slice(0, 3)" :key="g" class="px-1.5 py-0.5 text-[10px] md:text-xs rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">{{ g }}</span>
            </template>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 mt-3">
        <span class="text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
          进度: {{ filteredProgressText }}
          <span v-if="activeSeason !== null && needsSeasonPrefix" class="text-gray-400 dark:text-gray-500">(第{{ activeSeason }}季)</span>
        </span>
        <div class="flex items-center gap-1.5 flex-1 min-w-0">
          <div class="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              class="h-full bg-indigo-500 rounded-full transition-all duration-500"
              :style="{ width: filteredProgressPercent + '%' }"
            ></div>
          </div>
          <span class="text-[10px] md:text-xs text-gray-400 dark:text-gray-500">{{ filteredProgressPercent }}%</span>
        </div>
      </div>
    </div>

    <!-- 演职员 -->
    <div v-if="show && show.category !== 'book'" class="mb-6">
      <div class="flex items-center">
        <button
          @click="creditsExpanded = !creditsExpanded"
          class="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
        >
          <span>演职员</span>
          <span v-if="loadingCredits" class="inline-block animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent"></span>
          <span v-else class="text-xs transition-transform duration-200" :class="{ 'rotate-90': creditsExpanded }">▶</span>
        </button>
        <button @click="goToStats" class="ml-auto text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition">查看统计 →</button>
      </div>
      <div v-if="creditsExpanded" class="mt-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 md:p-4 space-y-3">
        <div v-if="credits.crew.length > 0">
          <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">主创</h4>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="p in credits.crew"
              :key="p.name + p.job"
              class="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-700 rounded-full text-xs text-gray-700 dark:text-gray-300 shadow-sm"
            >
              <img v-if="p.profile" :src="p.profile" class="w-4 h-4 rounded-full object-cover" loading="lazy" @error="$event.target.style.display='none'" />
              <span>{{ p.name }}</span>
              <span class="text-gray-400 dark:text-gray-500">· {{ p.job }}</span>
            </span>
          </div>
        </div>
        <div v-if="credits.cast.length > 0">
          <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">演员</h4>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="p in credits.cast"
              :key="p.name + p.character"
              class="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-700 rounded-full text-xs text-gray-700 dark:text-gray-300 shadow-sm"
            >
              <img v-if="p.profile" :src="p.profile" class="w-4 h-4 rounded-full object-cover" loading="lazy" @error="$event.target.style.display='none'" />
              <span>{{ p.name }}</span>
              <span v-if="p.character" class="text-gray-400 dark:text-gray-500">· {{ p.character }}</span>
            </span>
          </div>
        </div>
        <p v-if="!loadingCredits && credits.cast.length === 0 && credits.crew.length === 0" class="text-xs text-gray-400 dark:text-gray-500">未找到演职员信息</p>
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
      <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
        <div
          v-for="ep in episodeGroups[season]"
          :key="ep.id"
          @click="goToEpisode(ep.id)"
          @keydown.enter="goToEpisode(ep.id)"
          tabindex="0"
          role="button"
          :aria-label="`第 ${ep.episode} 集${getRecord(ep.id)?.rating > 0 ? '，评分 ' + Number(getRecord(ep.id).rating).toFixed(1) : ''}`"
          class="flex flex-col items-center justify-center aspect-square rounded-xl cursor-pointer transition border outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:focus-visible:ring-indigo-500"
          :class="getRecord(ep.id)?.rating > 0
            ? 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-700 dark:hover:bg-indigo-900/50'
            : 'bg-gray-100 border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700'"
        >
          <span class="text-sm font-semibold text-gray-600 dark:text-gray-300">{{ String(ep.episode).padStart(2, '0') }}</span>
          <span v-if="getRecord(ep.id)?.rating > 0" class="text-sm font-bold text-amber-400 mt-0.5">{{ Number(getRecord(ep.id).rating).toFixed(1) }}</span>
          <span v-else class="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">—</span>
        </div>
      </div>
    </div>

    <div v-if="showCoverLightbox" @click="showCoverLightbox = false" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 md:p-8 cursor-pointer">
      <img :src="show.coverImage" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl" @click.stop />
    </div>
  </div>
</template>
