<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../utils/supabase'
import { CATEGORIES } from '../db'
import { episodeLabel as epLabel } from '../utils/terminology'
import { debounce } from '../utils/debounce'

const router = useRouter()

const query = ref('')
const minRating = ref(0)
const selectedTag = ref('')
const selectedCategory = ref('')
const allTags = ref([])
const results = ref([])

function episodeLabel(ep, category) {
  return epLabel(ep, category || 'tv')
}

function parseGenres(show) {
  if (Array.isArray(show.genres)) return show.genres
  try { return JSON.parse(show.genres) } catch { return [] }
}

function categoryLabel(key) {
  const cat = CATEGORIES.find(c => c.key === key)
  return cat ? cat.label : ''
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: tags } = await supabase.from('tags').select('name').eq('user_id', user.id)
  allTags.value = (tags || []).map(t => t.name)
})

const debouncedSearch = debounce(doSearch, 300)

async function doSearch() {
  const q = query.value.trim().toLowerCase()
  const ratedOnly = minRating.value > 0
  const tagFilter = selectedTag.value
  const categoryFilter = selectedCategory.value

  if (!q && !ratedOnly && !tagFilter && !categoryFilter) {
    results.value = []
    return
  }

  const { data: { user } } = await supabase.auth.getUser()
  const { data: shows } = await supabase.from('shows').select('*').eq('user_id', user.id)
  const { data: episodes } = await supabase.from('episodes').select('*').eq('user_id', user.id)
  const { data: records } = await supabase.from('records').select('*').eq('user_id', user.id)

  const matches = []

  for (const show of (shows || [])) {
    if (categoryFilter && show.category !== categoryFilter) continue

    const showEpisodes = (episodes || []).filter(ep => ep.show_id === show.id)
    const showGenres = parseGenres(show)

    if (q && show.name.toLowerCase().includes(q)) {
      matches.push({
        type: 'show',
        showId: show.id,
        showName: show.name,
        score: 3,
        text: `剧集: ${show.name}`,
        category: show.category,
        region: show.region,
        genres: showGenres,
      })
    }

    if (q && show.region && show.region.toLowerCase().includes(q)) {
      if (!matches.find(m => m.type === 'show' && m.showId === show.id)) {
        matches.push({
          type: 'show',
          showId: show.id,
          showName: show.name,
          score: 2,
          text: `地区匹配: ${show.region}`,
          category: show.category,
          region: show.region,
          genres: showGenres,
        })
      }
    }

    if (q && showGenres.some(g => g.toLowerCase().includes(q))) {
      if (!matches.find(m => m.type === 'show' && m.showId === show.id)) {
        matches.push({
          type: 'show',
          showId: show.id,
          showName: show.name,
          score: 2,
          text: `类型匹配`,
          category: show.category,
          region: show.region,
          genres: showGenres,
        })
      }
    }

    for (const ep of showEpisodes) {
      const epRecords = (records || []).filter(r => r.episode_id === ep.id)
      const activeRecord = epRecords.find(r => r.id === ep.active_record_id)
      if (!activeRecord) continue

      const epTags = (() => { try { return JSON.parse(activeRecord.tags) } catch { return [] } })()
      const review = activeRecord.review || ''

      let match = false
      let score = 0

      if (tagFilter && epTags.includes(tagFilter)) {
        match = true
        score = 2
      }

      if (q && epTags.some(t => t.toLowerCase().includes(q))) {
        match = true
        score = Math.max(score, 2)
      }

      if (q && review.toLowerCase().includes(q)) {
        match = true
        score = Math.max(score, 1)
      }

      if (ratedOnly && (activeRecord.rating < minRating.value)) {
        match = false
      } else if (ratedOnly) {
        match = true
        score = Math.max(score, 0)
      }

      if (match) {
        matches.push({
          type: 'episode',
          episodeId: ep.id,
          showId: ep.show_id,
          showName: show.name,
          episode: ep,
          rating: activeRecord.rating,
          review: review.slice(0, 100),
          tags: epTags,
          score,
          category: show.category,
        })
      }
    }
  }

  matches.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return (b.rating || 0) - (a.rating || 0)
  })

  results.value = matches.slice(0, 50)
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
      <div class="flex gap-3">
        <input
          v-model="query"
          type="text"
          placeholder="搜索名称、评论、标签、地区、类型..."
          class="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 dark:border-gray-700"
          @input="debouncedSearch"
        />
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
