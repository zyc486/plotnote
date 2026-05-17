<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../utils/supabase'
import { CATEGORIES } from '../db'
import { episodeLabel as epLabel } from '../utils/terminology'

const router = useRouter()

const shows = ref([])
const showsStats = ref([])
const selectedShowId = ref(null)
const allRecords = ref([])
const allEpisodes = ref([])
const activeTab = ref('overview')

const selectedShowStats = computed(() => {
  return showsStats.value.find(s => s.showId === selectedShowId.value)
})

const highestEpisode = computed(() => {
  return selectedShowStats.value?.highest || null
})

const lowestEpisode = computed(() => {
  return selectedShowStats.value?.lowest || null
})

function episodeLabel(ep, category) {
  return epLabel(ep, category || 'tv')
}

function categoryLabel(key) {
  const cat = CATEGORIES.find(c => c.key === key)
  return cat ? cat.label : key
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

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: s } = await supabase.from('shows').select('*').eq('user_id', user.id)
  const { data: e } = await supabase.from('episodes').select('*').eq('user_id', user.id)
  const { data: r } = await supabase.from('records').select('*').eq('user_id', user.id)
  shows.value = s || []
  allEpisodes.value = e || []
  allRecords.value = (r || []).map(rec => ({ ...rec, watchedDate: rec.watched_date }))

  const allStats = []
  for (const show of shows.value) {
    const episodes = allEpisodes.value.filter(e => e.show_id === show.id)
    const episodeIds = episodes.map(e => e.id)
    const records = allRecords.value.filter(r => episodeIds.includes(r.episode_id))

    const activeRecords = records.filter(r => {
      const ep = episodes.find(e => e.id === r.episode_id)
      return ep && ep.active_record_id === r.id && r.rating > 0
    })

    const ratedRecords = [...activeRecords].sort((a, b) => a.rating - b.rating)

    const seasonGroups = {}
    for (const ep of episodes) {
      if (!seasonGroups[ep.season]) seasonGroups[ep.season] = []
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
        episode: episodes.find(e => e.id === ratedRecords[ratedRecords.length - 1].episode_id),
        rating: ratedRecords[ratedRecords.length - 1].rating,
      } : null,
      lowest: ratedRecords.length > 0 ? {
        episode: episodes.find(e => e.id === ratedRecords[0].episode_id),
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
  </div>
</template>
