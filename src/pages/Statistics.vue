<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useShowsStore } from '../stores/shows'
import { CATEGORIES } from '../constants'
import { categoryLabel } from '../utils/helpers'
import { episodeLabel as epLabel } from '../utils/terminology'

const router = useRouter()
const showsStore = useShowsStore()

const shows = ref([])
const showsStats = ref([])
const selectedShowId = ref(null)
const allRecords = ref([])
const allEpisodes = ref([])
const activeTab = ref('overview')
const selectedYear = ref(new Date().getFullYear())

const selectedShowStats = computed(() => {
  return showsStats.value.find(s => s.showId === selectedShowId.value)
})

const highestEpisode = computed(() => {
  return selectedShowStats.value?.highest || null
})

const lowestEpisode = computed(() => {
  return selectedShowStats.value?.lowest || null
})

const episodeRatingTrend = computed(() => {
  if (!selectedShowStats.value) return []
  const stats = selectedShowStats.value
  const episodes = allEpisodes.value
    .filter(ep => ep.show_id === stats.showId)
    .sort((a, b) => a.season - b.season || a.episode - b.episode)

  return episodes.map(ep => {
    const rec = allRecords.value.find(r => r.episode_id === ep.id && r.rating > 0)
    return {
      label: `${ep.season}x${String(ep.episode).padStart(2, '0')}`,
      rating: rec?.rating || 0,
    }
  }).filter(e => e.rating > 0)
})

function episodeLabel(ep, category) {
  return epLabel(ep, category || 'tv')
}

const categoryStats = computed(() => {
  const counts = {}
  for (const s of shows.value) {
    const cat = s.category || 'tv'
    counts[cat] = (counts[cat] || 0) + 1
  }
  return CATEGORIES.map(c => ({ key: c.key, label: c.label, count: counts[c.key] || 0 })).filter(c => c.count > 0)
})

const totalRated = computed(() => {
  return allRecords.value.filter(r => r.rating > 0).length
})

const globalAvgRating = computed(() => {
  const rated = allRecords.value.filter(r => r.rating > 0)
  if (rated.length === 0) return 0
  return (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1)
})

const ratingDistribution = computed(() => {
  const buckets = Array(10).fill(0)
  for (const r of allRecords.value) {
    if (r.rating > 0) {
      const idx = Math.min(Math.floor(r.rating) - 1, 9)
      if (idx >= 0 && idx < 10) buckets[idx]++
    }
  }
  const max = Math.max(...buckets, 1)
  return buckets.map((count, i) => ({
    label: `${i + 1}`,
    count,
    percent: Math.round((count / max) * 100),
  }))
})

const monthlyTrend = computed(() => {
  const monthMap = {}
  for (const r of allRecords.value) {
    if (!r.watchedDate) continue
    const d = new Date(r.watchedDate)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap[key] = (monthMap[key] || 0) + 1
  }
  const sorted = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
  const max = Math.max(...sorted.map(([, v]) => v), 1)
  return sorted.map(([key, count]) => ({
    label: key.slice(5),
    count,
    percent: Math.round((count / max) * 100),
  }))
})

const availableYears = computed(() => {
  const years = new Set()
  for (const r of allRecords.value) {
    if (!r.watchedDate) continue
    const d = new Date(r.watchedDate)
    if (!isNaN(d)) years.add(d.getFullYear())
  }
  return [...years].sort((a, b) => b - a)
})

const yearReview = computed(() => {
  const year = selectedYear.value
  const yearRecords = allRecords.value.filter(r => {
    if (!r.watchedDate) return false
    const d = new Date(r.watchedDate)
    return !isNaN(d) && d.getFullYear() === year
  })

  const ratedRecords = yearRecords.filter(r => r.rating > 0)
  const avgRating = ratedRecords.length > 0
    ? (ratedRecords.reduce((s, r) => s + r.rating, 0) / ratedRecords.length).toFixed(1)
    : 0

  // 最高分作品
  const showRatings = {}
  for (const r of ratedRecords) {
    const ep = allEpisodes.value.find(e => e.id === r.episode_id)
    if (!ep) continue
    const show = shows.value.find(s => s.id === ep.show_id)
    if (!show) continue
    if (!showRatings[show.id]) showRatings[show.id] = { show, ratings: [] }
    showRatings[show.id].ratings.push(r.rating)
  }
  const topShows = Object.values(showRatings)
    .map(({ show, ratings }) => ({
      name: show.name,
      category: show.category,
      avgRating: (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1),
      count: ratings.length,
    }))
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 5)

  // 最常看的类型
  const catCounts = {}
  for (const r of yearRecords) {
    const ep = allEpisodes.value.find(e => e.id === r.episode_id)
    if (!ep) continue
    const show = shows.value.find(s => s.id === ep.show_id)
    if (!show) continue
    const cat = show.category || 'tv'
    catCounts[cat] = (catCounts[cat] || 0) + 1
  }
  const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]

  // 月度热力图
  const monthCounts = Array(12).fill(0)
  for (const r of yearRecords) {
    const d = new Date(r.watchedDate)
    if (!isNaN(d)) monthCounts[d.getMonth()]++
  }
  const maxMonth = Math.max(...monthCounts, 1)

  // 已看作品数
  const watchedShows = new Set()
  for (const r of yearRecords) {
    const ep = allEpisodes.value.find(e => e.id === r.episode_id)
    if (ep) watchedShows.add(ep.show_id)
  }

  return {
    totalEpisodes: yearRecords.length,
    totalShows: watchedShows.size,
    avgRating,
    topShows,
    topCategory: topCategory ? { label: categoryLabel(topCategory[0]), count: topCategory[1] } : null,
    monthCounts,
    maxMonth,
  }
})

onMounted(async () => {
  const { shows: s, episodes: e, records: r } = await showsStore.fetchAllData()

  shows.value = s || []
  allEpisodes.value = e || []
  allRecords.value = (r || []).map(rec => ({ ...rec, watchedDate: rec.watched_date }))

  // 构建索引 Map，避免 O(n²) 的 filter/find 操作
  const episodesByShow = new Map()
  for (const ep of allEpisodes.value) {
    if (!episodesByShow.has(ep.show_id)) episodesByShow.set(ep.show_id, [])
    episodesByShow.get(ep.show_id).push(ep)
  }

  const recordsByEpisode = new Map()
  for (const rec of allRecords.value) {
    if (!recordsByEpisode.has(rec.episode_id)) recordsByEpisode.set(rec.episode_id, [])
    recordsByEpisode.get(rec.episode_id).push(rec)
  }

  const episodeById = new Map()
  for (const ep of allEpisodes.value) {
    episodeById.set(ep.id, ep)
  }

  const allStats = []
  for (const show of shows.value) {
    const episodes = episodesByShow.get(show.id) || []

    // 收集该 show 的所有记录
    const allShowRecords = []
    for (const ep of episodes) {
      const epRecords = recordsByEpisode.get(ep.id) || []
      allShowRecords.push(...epRecords)
    }

    const activeRecords = allShowRecords.filter(r => {
      const ep = episodeById.get(r.episode_id)
      return ep && ep.active_record_id === r.id && r.rating > 0
    })

    const ratedRecords = [...activeRecords].sort((a, b) => a.rating - b.rating)

    const seasonGroups = {}
    for (const ep of episodes) {
      if (!seasonGroups[ep.season]) seasonGroups[ep.season] = []
      // 用 Map 查找而不是 Array.find
      const record = ratedRecords.find(r => r.episode_id === ep.id)
      if (record) seasonGroups[ep.season].push({ ...ep, rating: record.rating })
    }

    const seasonStats = Object.keys(seasonGroups).map(s => {
      const eps = seasonGroups[s]
      const avgRating = eps.length > 0
        ? eps.reduce((sum, e) => sum + e.rating, 0) / eps.length
        : 0
      return { season: Number(s), avgRating: Math.round(avgRating * 10) / 10, count: eps.length }
    })

    allStats.push({
      showId: show.id,
      name: show.name,
      category: show.category || 'tv',
      totalEpisodes: episodes.length,
      ratedCount: ratedRecords.length,
      avgRating: show.avg_rating || 0,
      highest: ratedRecords.length > 0 ? {
        episode: episodeById.get(ratedRecords[ratedRecords.length - 1].episode_id),
        rating: ratedRecords[ratedRecords.length - 1].rating,
      } : null,
      lowest: ratedRecords.length > 0 ? {
        episode: episodeById.get(ratedRecords[0].episode_id),
        rating: ratedRecords[0].rating,
      } : null,
      seasonStats,
    })
  }

  showsStats.value = allStats
  if (allStats.length > 0) {
    selectedShowId.value = allStats[0].showId
  }
})

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="max-w-2xl mx-auto p-4 md:p-6">
    <button @click="goBack" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm mb-6 block transition">
      ← 返回首页
    </button>

    <h1 class="text-2xl font-bold mb-4">数据统计</h1>

    <div class="flex items-center gap-2 mb-6">
      <button @click="activeTab = 'overview'" class="px-4 py-1.5 text-sm rounded-full transition" :class="activeTab === 'overview' ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'">总览</button>
      <button @click="activeTab = 'detail'" class="px-4 py-1.5 text-sm rounded-full transition" :class="activeTab === 'detail' ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'">作品详情</button>
      <button @click="activeTab = 'year'" class="px-4 py-1.5 text-sm rounded-full transition" :class="activeTab === 'year' ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'">年度回顾</button>
    </div>

    <div v-if="shows.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-12">
      暂无统计数据，请先添加内容并记录评分
    </div>

    <div v-else-if="activeTab === 'overview'" class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
          <div class="text-3xl font-bold text-indigo-500 dark:text-indigo-400">{{ shows.length }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">作品总数</div>
        </div>
        <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
          <div class="text-3xl font-bold text-emerald-500 dark:text-emerald-400">{{ allEpisodes.length }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">集数总数</div>
        </div>
        <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
          <div class="text-3xl font-bold text-amber-400">{{ globalAvgRating || '--' }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">全局均分</div>
        </div>
        <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
          <div class="text-3xl font-bold text-rose-500 dark:text-rose-400">{{ totalRated }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">已评集数</div>
        </div>
      </div>

      <div v-if="categoryStats.length > 0" class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h3 class="text-sm text-gray-500 dark:text-gray-400 mb-3">分类分布</h3>
        <div class="space-y-2">
          <div v-for="cat in categoryStats" :key="cat.key" class="flex items-center gap-3">
            <span class="text-sm text-gray-600 dark:text-gray-300 w-12">{{ cat.label }}</span>
            <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-indigo-500 rounded-full transition-all duration-500" :style="{ width: (cat.count / shows.length * 100) + '%' }"></div>
            </div>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{{ cat.count }}</span>
          </div>
        </div>
      </div>

      <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h3 class="text-sm text-gray-500 dark:text-gray-400 mb-3">评分分布</h3>
        <div class="space-y-1.5">
          <div v-for="b in ratingDistribution" :key="b.label" class="flex items-center gap-2">
            <span class="text-xs text-gray-500 dark:text-gray-400 w-4 text-right">{{ b.label }}</span>
            <div class="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500" :class="{ 'bg-emerald-500': Number(b.label) >= 8, 'bg-indigo-500': Number(b.label) >= 6 && Number(b.label) < 8, 'bg-amber-500': Number(b.label) >= 4 && Number(b.label) < 6, 'bg-red-500': Number(b.label) < 4 }" :style="{ width: b.percent + '%' }"></div>
            </div>
            <span class="text-xs text-gray-400 dark:text-gray-500 w-6 text-right">{{ b.count }}</span>
          </div>
        </div>
      </div>

      <div v-if="monthlyTrend.length > 0" class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h3 class="text-sm text-gray-500 dark:text-gray-400 mb-3">月度观看趋势（近12月）</h3>
        <div class="flex items-end gap-1 h-28">
          <div v-for="m in monthlyTrend" :key="m.label" class="flex-1 flex flex-col items-center justify-end h-full">
            <span class="text-[10px] text-gray-400 dark:text-gray-500 mb-1">{{ m.count }}</span>
            <div class="w-full rounded-t transition-all duration-500 bg-indigo-500" :style="{ height: m.percent + '%' }"></div>
            <span class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{{ m.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'detail'" class="space-y-6">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="s in showsStats"
          :key="s.showId"
          @click="selectedShowId = s.showId"
          class="px-4 py-2 rounded-lg text-sm transition"
          :class="selectedShowId === s.showId ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'"
        >
          {{ s.name }}
        </button>
      </div>

      <div v-if="selectedShowStats" class="space-y-4">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
            <div class="text-3xl font-bold text-amber-400">
              {{ selectedShowStats.avgRating || '--' }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">全剧均分</div>
          </div>
          <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
            <div class="text-3xl font-bold text-indigo-500 dark:text-indigo-400">
              {{ selectedShowStats.ratedCount }} / {{ selectedShowStats.totalEpisodes }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">已评 / 总数</div>
          </div>
          <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
            <div class="text-3xl font-bold text-emerald-500 dark:text-emerald-400">
              {{ selectedShowStats.seasonStats.length }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">季数</div>
          </div>
        </div>

        <div v-if="highestEpisode" class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-sm text-gray-500 dark:text-gray-400">最高分 ⭐</span>
              <div class="text-lg font-medium mt-1">
                {{ episodeLabel(highestEpisode.episode, selectedShowStats.category) }}
              </div>
            </div>
            <div class="text-3xl font-bold text-amber-400">
              {{ Number(highestEpisode.rating).toFixed(1) }}
            </div>
          </div>
        </div>

        <div v-if="lowestEpisode" class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-sm text-gray-500 dark:text-gray-400">最低分</span>
              <div class="text-lg font-medium mt-1">
                {{ episodeLabel(lowestEpisode.episode, selectedShowStats.category) }}
              </div>
            </div>
            <div class="text-3xl font-bold text-gray-500 dark:text-gray-400">
              {{ Number(lowestEpisode.rating).toFixed(1) }}
            </div>
          </div>
        </div>

        <div v-if="episodeRatingTrend.length > 1" class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h3 class="text-sm text-gray-500 dark:text-gray-400 mb-3">逐集评分趋势</h3>
          <div class="relative h-32">
            <svg class="w-full h-full" :viewBox="`0 0 ${episodeRatingTrend.length * 20} 100`" preserveAspectRatio="none">
              <!-- Grid lines -->
              <line v-for="n in [2,4,6,8]" :key="n" :x1="0" :y1="100 - n * 10" :x2="episodeRatingTrend.length * 20" :y2="100 - n * 10" class="stroke-gray-300 dark:stroke-gray-600" stroke-width="0.5" stroke-dasharray="4" />
              <!-- Line path -->
              <polyline
                :points="episodeRatingTrend.map((p, i) => `${i * 20 + 10},${100 - p.rating * 10}`).join(' ')"
                fill="none"
                class="stroke-indigo-500"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
              <!-- Dots -->
              <circle
                v-for="(p, i) in episodeRatingTrend" :key="i"
                :cx="i * 20 + 10"
                :cy="100 - p.rating * 10"
                r="2"
                class="fill-indigo-500"
              />
            </svg>
            <!-- Y axis labels -->
            <div class="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-gray-400 dark:text-gray-500 -ml-1">
              <span>10</span><span>8</span><span>6</span><span>4</span><span>2</span><span>0</span>
            </div>
          </div>
          <div class="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-2">
            <span>{{ episodeRatingTrend[0]?.label }}</span>
            <span>{{ episodeRatingTrend[episodeRatingTrend.length - 1]?.label }}</span>
          </div>
        </div>

        <div v-if="selectedShowStats.seasonStats.length > 0" class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h3 class="text-sm text-gray-500 dark:text-gray-400 mb-3">各季平均分</h3>
          <div class="space-y-2">
            <div
              v-for="season in selectedShowStats.seasonStats"
              :key="season.season"
              class="flex items-center gap-3"
            >
              <span class="text-sm text-gray-500 dark:text-gray-400 w-16">第 {{ season.season }} 季</span>
              <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="{
                    'bg-emerald-500': season.avgRating >= 8,
                    'bg-indigo-500': season.avgRating >= 6 && season.avgRating < 8,
                    'bg-amber-500': season.avgRating >= 4 && season.avgRating < 6,
                    'bg-red-500': season.avgRating < 4 && season.avgRating > 0,
                  }"
                  :style="{ width: (season.avgRating / 10 * 100) + '%' }"
                ></div>
              </div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-12 text-right">
                {{ season.avgRating || '--' }}
              </span>
              <span class="text-xs text-gray-400 dark:text-gray-500 w-8">({{ season.count }})</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'year'" class="space-y-4">
      <div v-if="availableYears.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-8">
        暂无观看记录
      </div>

      <template v-else>
        <!-- 年份选择 -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            v-for="y in availableYears" :key="y"
            @click="selectedYear = y"
            class="px-4 py-1.5 text-sm rounded-full transition whitespace-nowrap"
            :class="selectedYear === y ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'"
          >{{ y }}</button>
        </div>

        <!-- 年度统计卡片 -->
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
            <div class="text-3xl font-bold text-indigo-500 dark:text-indigo-400">{{ yearReview.totalEpisodes }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">观看集数</div>
          </div>
          <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
            <div class="text-3xl font-bold text-emerald-500 dark:text-emerald-400">{{ yearReview.totalShows }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">观看作品</div>
          </div>
          <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
            <div class="text-3xl font-bold text-amber-400">{{ yearReview.avgRating || '--' }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">年度均分</div>
          </div>
        </div>

        <!-- 月度热力图 -->
        <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h3 class="text-sm text-gray-500 dark:text-gray-400 mb-3">月度观看热力图</h3>
          <div class="grid grid-cols-6 sm:grid-cols-12 gap-2">
            <div v-for="(count, i) in yearReview.monthCounts" :key="i" class="flex flex-col items-center gap-1">
              <div
                class="w-full aspect-square rounded-lg transition-all duration-300"
                :class="count > 0
                  ? count >= yearReview.maxMonth * 0.8
                    ? 'bg-indigo-500 dark:bg-indigo-400'
                    : count >= yearReview.maxMonth * 0.4
                      ? 'bg-indigo-300 dark:bg-indigo-600'
                      : 'bg-indigo-100 dark:bg-indigo-900/30'
                  : 'bg-gray-200 dark:bg-gray-700'"
              ></div>
              <span class="text-[10px] text-gray-400 dark:text-gray-500">{{ i + 1 }}月</span>
            </div>
          </div>
        </div>

        <!-- TOP 作品 -->
        <div v-if="yearReview.topShows.length > 0" class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h3 class="text-sm text-gray-500 dark:text-gray-400 mb-3">年度最佳作品</h3>
          <div class="space-y-2">
            <div v-for="(s, i) in yearReview.topShows" :key="i" class="flex items-center gap-3">
              <span class="text-sm font-bold w-6 text-center" :class="i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-400 dark:text-gray-500'">
                {{ i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1 }}
              </span>
              <span class="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{{ s.name }}</span>
              <span class="text-xs text-gray-400 dark:text-gray-500 px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700">{{ categoryLabel(s.category) }}</span>
              <span class="text-sm font-bold text-amber-400">{{ s.avgRating }}</span>
              <span class="text-xs text-gray-400 dark:text-gray-500">({{ s.count }}集)</span>
            </div>
          </div>
        </div>

        <!-- 最常看类型 -->
        <div v-if="yearReview.topCategory" class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h3 class="text-sm text-gray-500 dark:text-gray-400 mb-2">最常看类型</h3>
          <div class="flex items-center gap-3">
            <span class="text-2xl font-bold text-indigo-500 dark:text-indigo-400">{{ yearReview.topCategory.label }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ yearReview.topCategory.count }} 集</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
