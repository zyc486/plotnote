<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../utils/supabase'
import { CATEGORIES } from '../constants'
import { episodeLabel as epLabel } from '../utils/terminology'
import { parseGenres, categoryLabel, getUserId } from '../utils/helpers'
import { debounce } from '../utils/debounce'
import { useTagsStore } from '../stores/tags'

const router = useRouter()
const tagsStore = useTagsStore()

const query = ref('')
const minRating = ref(0)
const selectedTag = ref('')
const selectedCategory = ref('')
const allTags = ref([])
const results = ref([])
const searching = ref(false)

function episodeLabel(ep, category) {
  return epLabel(ep, category || 'tv')
}

onMounted(async () => {
  await tagsStore.fetchTags()
  allTags.value = tagsStore.tags.map(t => t.name)
})

const debouncedSearch = debounce(doSearch, 300)

async function doSearch() {
  const q = query.value.trim()
  const qLower = q.toLowerCase()
  const ratedOnly = minRating.value > 0
  const tagFilter = selectedTag.value
  const categoryFilter = selectedCategory.value

  if (!q && !ratedOnly && !tagFilter && !categoryFilter) {
    results.value = []
    return
  }

  searching.value = true

  const userId = await getUserId()
  if (!userId) return

  const matches = []

  // Server-side: search shows by name/region/genres
  if (q) {
    let showsQuery = supabase.from('shows').select('*').eq('user_id', userId).limit(50)
    if (categoryFilter) showsQuery = showsQuery.eq('category', categoryFilter)

    const { data: nameMatches } = await showsQuery.ilike('name', `%${q}%`)
    for (const show of (nameMatches || [])) {
      const showGenres = parseGenres(show)
      matches.push({
        type: 'show',
        showId: show.id,
        showName: show.name,
        score: 3,
        category: show.category,
        region: show.region,
        genres: showGenres,
      })
    }

    // Also search by region if query doesn't match names well
    if (!categoryFilter) {
      const { data: regionMatches } = await supabase
        .from('shows').select('*').eq('user_id', userId)
        .ilike('region', `%${q}%`).limit(20)
      for (const show of (regionMatches || [])) {
        if (!matches.find(m => m.type === 'show' && m.showId === show.id)) {
          matches.push({
            type: 'show',
            showId: show.id,
            showName: show.name,
            score: 2,
            category: show.category,
            region: show.region,
            genres: parseGenres(show),
          })
        }
      }
    }
  }

  // Server-side: search records by review content
  if (q || tagFilter || ratedOnly) {
    let recordsQuery = supabase
      .from('records')
      .select('*, episodes!inner(id, show_id, season, episode, active_record_id, shows!inner(id, name, category, region, genres))')
      .eq('user_id', userId)
      .limit(50)

    if (q) {
      recordsQuery = recordsQuery.ilike('review', `%${q}%`)
    }

    const { data: recordMatches } = await recordsQuery

    for (const rec of (recordMatches || [])) {
      const ep = rec.episodes
      const show = ep?.shows
      if (!ep || !show) continue
      if (categoryFilter && show.category !== categoryFilter) continue

      const epTags = (() => { try { return JSON.parse(rec.tags) } catch { return [] } })()

      // Tag filter (client-side, since tags is JSON)
      if (tagFilter && !epTags.includes(tagFilter)) continue

      // Rating filter (client-side)
      if (ratedOnly && (rec.rating || 0) < minRating.value) continue

      // Tag text match (client-side)
      const tagMatch = q && epTags.some(t => t.toLowerCase().includes(qLower))

      matches.push({
        type: 'episode',
        episodeId: ep.id,
        showId: ep.show_id,
        showName: show.name,
        episode: ep,
        rating: rec.rating,
        review: (rec.review || '').replace(/<[^>]*>/g, '').slice(0, 100),
        tags: epTags,
        score: tagMatch ? 2 : 1,
        category: show.category,
      })
    }
  }

  // If we only have filters (no text query), fetch all data for client-side filtering
  if (!q && (tagFilter || ratedOnly)) {
    const { data: allRecords } = await supabase
      .from('records')
      .select('*, episodes!inner(id, show_id, season, episode, active_record_id, shows!inner(id, name, category, region, genres))')
      .eq('user_id', userId)

    for (const rec of (allRecords || [])) {
      const ep = rec.episodes
      const show = ep?.shows
      if (!ep || !show) continue
      if (categoryFilter && show.category !== categoryFilter) continue

      const epTags = (() => { try { return JSON.parse(rec.tags) } catch { return [] } })()
      if (tagFilter && !epTags.includes(tagFilter)) continue
      if (ratedOnly && (rec.rating || 0) < minRating.value) continue

      matches.push({
        type: 'episode',
        episodeId: ep.id,
        showId: ep.show_id,
        showName: show.name,
        episode: ep,
        rating: rec.rating,
        review: (rec.review || '').replace(/<[^>]*>/g, '').slice(0, 100),
        tags: epTags,
        score: 0,
        category: show.category,
      })
    }
  }

  matches.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return (b.rating || 0) - (a.rating || 0)
  })

  results.value = matches.slice(0, 50)
  searching.value = false
}

function goToEpisode(episodeId) {
  router.push(`/episode/${episodeId}`)
}

function goToShow(showId) {
  router.push(`/show/${showId}`)
}

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="max-w-2xl mx-auto p-4 md:p-6">
    <button @click="goBack" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm mb-6 block transition">
      ← 返回首页
    </button>

    <h1 class="text-2xl font-bold mb-6">搜索</h1>

    <div class="space-y-4 mb-8">
      <div class="relative">
        <input
          v-model="query"
          type="text"
          placeholder="搜索名称、评论、标签、地区、类型..."
          class="w-full bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 pr-10 outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 dark:border-gray-700"
          @input="debouncedSearch"
        />
        <div v-if="searching" class="absolute right-3 top-1/2 -translate-y-1/2">
          <div class="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"></div>
        </div>
      </div>

      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-500 dark:text-gray-400">分类</label>
          <select
            v-model="selectedCategory"
            class="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 dark:border-gray-700"
            @change="doSearch"
          >
            <option value="">全部</option>
            <option v-for="cat in CATEGORIES" :key="cat.key" :value="cat.key">{{ cat.label }}</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-500 dark:text-gray-400">最低评分</label>
          <input
            v-model.number="minRating"
            type="number"
            min="0"
            max="10"
            step="0.5"
            class="w-20 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 dark:border-gray-700"
            @input="debouncedSearch"
          />
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-500 dark:text-gray-400">按标签</label>
          <select
            v-model="selectedTag"
            class="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 dark:border-gray-700"
            @change="doSearch"
          >
            <option value="">全部</option>
            <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="results.length === 0 && (query || minRating > 0 || selectedTag || selectedCategory)" class="text-center text-gray-400 dark:text-gray-500 py-8">
      没有找到匹配结果
    </div>

    <div v-else-if="results.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-8">
      输入关键词开始搜索
    </div>

    <div v-else class="space-y-3">
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">找到 {{ results.length }} 条结果</p>

      <div
        v-for="item in results"
        :key="`${item.type}-${item.episodeId || item.showId}`"
        class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-750 transition"
        @click="item.type === 'show' ? goToShow(item.showId) : goToEpisode(item.episodeId)"
      >
        <div v-if="item.type === 'show'">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <span class="text-xs text-indigo-500 dark:text-indigo-400">{{ categoryLabel(item.category) || '条目' }}</span>
              <span
                v-if="item.category"
                class="px-1.5 py-0.5 text-xs rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              >
                {{ categoryLabel(item.category) }}
              </span>
            </div>
          </div>
          <span class="font-medium">{{ item.showName }}</span>
          <div v-if="item.region || item.genres?.length" class="flex items-center gap-2 mt-1 flex-wrap">
            <span v-if="item.region" class="text-xs text-gray-500 dark:text-gray-400">地区：{{ item.region }}</span>
            <span v-if="item.genres?.length" class="text-xs text-gray-500 dark:text-gray-400">类型：{{ item.genres.join(' / ') }}</span>
          </div>
        </div>

        <div v-else>
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <span class="text-xs text-indigo-500 dark:text-indigo-400">{{ item.showName }}</span>
              <span
                v-if="item.category"
                class="px-1.5 py-0.5 text-xs rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              >
                {{ categoryLabel(item.category) }}
              </span>
              <span class="text-sm text-gray-700 dark:text-gray-300">
                {{ episodeLabel(item.episode, item.category) }}
              </span>
            </div>
            <span v-if="item.rating > 0" class="text-lg font-bold text-amber-400">
              {{ Number(item.rating).toFixed(1) }}
            </span>
          </div>
          <p v-if="item.review" class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ item.review }}</p>
          <div v-if="item.tags.length > 0" class="flex flex-wrap gap-1 mt-2">
            <span
              v-for="tag in item.tags"
              :key="tag"
              class="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs"
            >
              {{ tag }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
