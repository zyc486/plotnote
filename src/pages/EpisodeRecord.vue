<script setup>
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useRecordsStore } from '../stores/records'
import { useEpisodesStore } from '../stores/episodes'
import { useShowsStore } from '../stores/shows'
import { debounce } from '../utils/debounce'
import { saveDraft, clearDraft, loadDraft } from '../utils/draftCache'
import { getTerminology } from '../utils/terminology'
import ImageManager from '../components/ImageManager.vue'
import TagSelector from '../components/TagSelector.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { getUserId } from '../utils/helpers'

import { renderMarkdown } from '../utils/markdown'

import { getRatingsByTitle, hasOmdbKey } from '../utils/omdb'

const props = defineProps(['toast'])

const route = useRoute()
const router = useRouter()

const episode = ref(null)
const show = ref(null)
const rating = ref(0)
const review = ref('')
const images = ref([])
const tags = ref([])
const watchedDate = ref('')
const loaded = ref(false)
const dirty = ref(false)
const currentRecordId = ref(null)
const episodeRecords = ref([])
const ratingAnimation = ref(false)
const showPreview = ref(false)
const confirmDialog = ref({ visible: false, title: '', message: '', onConfirm: null })
const externalRatings = ref(null)
const loadingRatings = ref(false)

const recordsStore = useRecordsStore()
const episodesStore = useEpisodesStore()
const showsStore = useShowsStore()

const episodeLabel = ref('')
const prevEpisode = ref(null)
const nextEpisode = ref(null)

const epTerm = computed(() => {
  const cat = show.value?.category || 'tv'
  return getTerminology(cat).episodeLabel
})

const showPicker = ref(false)
const pickerSeason = ref(0)
const showSidebarMobile = ref(false)
const rightSeason = ref(0)
const episodeScores = ref({})
const showRightPanel = ref(true)

const seasonLabel = computed(() => {
  const cat = show.value?.category || 'tv'
  const t = getTerminology(cat)
  return t.seasonLabel || ''
})

const availableSeasons = computed(() => {
  const seasons = new Set()
  for (const ep of episodesStore.episodes) {
    seasons.add(ep.season)
  }
  return [...seasons].sort((a, b) => a - b)
})

const episodesInPickerSeason = computed(() => {
  if (!pickerSeason.value) return []
  return episodesStore.episodes.filter(e => e.season === pickerSeason.value)
})

let skipWatchers = false

function parseJsonSafe(str) {
  try { return JSON.parse(str) } catch { return [] }
}

async function forceSave() {
  if (!currentRecordId.value || !episode.value) return
  try {
    await recordsStore.updateRecord(currentRecordId.value, {
      rating: rating.value,
      review: review.value,
      images: images.value,
      tags: tags.value,
      watchedDate: watchedDate.value || null,
    })
    dirty.value = false
  } catch (e) {
    console.warn('Force save failed:', e)
  }
}

function saveToDraft() {
  if (!episode.value) return
  saveDraft(episode.value.id, {
    rating: rating.value,
    review: review.value,
    images: images.value,
    tags: tags.value,
    watchedDate: watchedDate.value,
  })
}

async function ensureRecordExists() {
  if (!episode.value || !loaded.value) return
  if (!currentRecordId.value) {
    const id = await recordsStore.createRecord(
      episode.value.id, rating.value, review.value, images.value, tags.value, watchedDate.value
    )
    currentRecordId.value = id
    await loadEpisodeRecords()
  }
}

const debouncedSaveRating = debounce(async (val) => {
  if (skipWatchers) return
  await ensureRecordExists()
  if (currentRecordId.value) {
    await recordsStore.updateRecord(currentRecordId.value, { rating: val })
    dirty.value = false
    // 更新右侧选集面板的评分
    if (episode.value) {
      episodeScores.value = {
        ...episodeScores.value,
        [episode.value.id]: { rating: val, count: Math.max(episodeScores.value[episode.value.id]?.count || 1, 1) },
      }
    }
  }
  saveToDraft()
}, 300)

const debouncedSaveReview = debounce(async (val) => {
  if (skipWatchers) return
  await ensureRecordExists()
  if (currentRecordId.value) {
    await recordsStore.updateRecord(currentRecordId.value, { review: val })
    dirty.value = false
  }
  saveToDraft()
}, 500)

const debouncedSaveImages = debounce(async (val) => {
  if (skipWatchers) return
  await ensureRecordExists()
  if (currentRecordId.value) {
    await recordsStore.updateRecord(currentRecordId.value, { images: val })
    dirty.value = false
  }
  saveToDraft()
}, 1000)

const debouncedSaveTags = debounce(async (val) => {
  if (skipWatchers) return
  await ensureRecordExists()
  if (currentRecordId.value) {
    await recordsStore.updateRecord(currentRecordId.value, { tags: val })
    dirty.value = false
  }
  saveToDraft()
}, 500)

const debouncedSaveWatchedDate = debounce(async (val) => {
  if (skipWatchers) return
  if (currentRecordId.value) {
    await recordsStore.updateRecord(currentRecordId.value, { watchedDate: val })
    dirty.value = false
  }
}, 500)

watch(rating, (val) => {
  if (skipWatchers) return
  dirty.value = true
  ratingAnimation.value = true
  setTimeout(() => ratingAnimation.value = false, 300)
  debouncedSaveRating(val)
})

watch(review, (val) => {
  if (skipWatchers) return
  dirty.value = true
  debouncedSaveReview(val)
})

watch(images, (val) => {
  if (skipWatchers) return
  dirty.value = true
  debouncedSaveImages(val)
}, { deep: true })

watch(tags, (val) => {
  if (skipWatchers) return
  dirty.value = true
  debouncedSaveTags(val)
}, { deep: true })

watch(watchedDate, (val) => {
  if (skipWatchers) return
  dirty.value = true
  debouncedSaveWatchedDate(val)
})

function handleBeforeUnload(e) {
  if (dirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
  forceSave()
  saveToDraft()
}

async function loadEpisodeRecords() {
  if (!episode.value) return
  await recordsStore.fetchEpisodeRecords(episode.value.id)
  episodeRecords.value = recordsStore.episodeRecords.map(r => ({
    ...r,
    images: parseJsonSafe(r.images),
    tags: parseJsonSafe(r.tags),
  }))
}

function watchCount(episodeId) {
  return episodeRecords.value.filter(r => r.episodeId === episodeId).length
}

async function fetchEpisodeScores() {
  if (!show.value) return
  const userId = await getUserId()
  if (!userId) return
  const episodeIds = episodesStore.episodes.map(e => e.id)
  if (!episodeIds.length) { episodeScores.value = {}; return }
  try {
    const { data: records, error } = await supabase
      .from('records')
      .select('id, episode_id, rating')
      .in('episode_id', episodeIds)
      .eq('user_id', userId)
    if (error) { console.warn('fetchEpisodeScores:', error.message); return }
    const scores = {}
    for (const ep of episodesStore.episodes) {
      const epRecords = (records || []).filter(r => r.episode_id === ep.id)
      const rated = epRecords.find(r => r.rating > 0)
      scores[ep.id] = { rating: rated?.rating || 0, count: epRecords.length }
    }
    episodeScores.value = scores
  } catch (e) {
    console.warn('fetchEpisodeScores failed:', e)
  }
}

function scrollToCurrent() {
  nextTick(() => {
    const el = document.getElementById(`ep-nav-${episode.value?.id}`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

async function initPage() {
  loaded.value = false
  skipWatchers = true

  try {
    const episodeId = Number(route.params.id)
    episode.value = await episodesStore.getEpisode(episodeId)

    if (!episode.value) {
      router.push('/')
      return
    }

    show.value = await showsStore.getShow(episode.value.show_id)
    episode.value._category = show.value?.category || 'tv'
    episodeLabel.value = episodesStore.episodeLabel(episode.value)

    await episodesStore.fetchEpisodes(episode.value.show_id)
    await fetchEpisodeScores()
    rightSeason.value = episode.value.season || availableSeasons.value[0] || 0

    const { prev, next } = episodesStore.getAdjacentEpisodes(episodeId)
    prevEpisode.value = prev
    nextEpisode.value = next

    currentRecordId.value = null
    rating.value = 0
    review.value = ''
    images.value = []
    tags.value = []
    watchedDate.value = new Date().toISOString().split('T')[0]
    dirty.value = false

    const activeRecord = await recordsStore.getActiveRecord(episodeId)

    if (activeRecord) {
      currentRecordId.value = activeRecord.id
      rating.value = activeRecord.rating ?? 0
      review.value = activeRecord.review ?? ''
      images.value = parseJsonSafe(activeRecord.images)
      tags.value = parseJsonSafe(activeRecord.tags)
      watchedDate.value = activeRecord.watchedDate || new Date().toISOString().split('T')[0]
    } else {
      const draft = loadDraft(episodeId)
      if (draft) {
        rating.value = draft.rating ?? 0
        review.value = draft.review ?? ''
        images.value = draft.images ?? []
        tags.value = draft.tags ?? []
        if (draft.watchedDate) watchedDate.value = draft.watchedDate
      }
    }

    await loadEpisodeRecords()

    if (hasOmdbKey() && show.value) {
      loadingRatings.value = true
      const cat = show.value.category || 'tv'
      const type = cat === 'book' ? '' : cat === 'movie' ? 'movie' : 'series'
      if (type) {
        externalRatings.value = await getRatingsByTitle(show.value.name, type)
      }
      loadingRatings.value = false
    }

    await nextTick()
    skipWatchers = false

    const textarea = document.querySelector('textarea')
    if (textarea && !review.value) {
      textarea.focus()
    }
  } catch (e) {
    console.error('initPage failed:', e)
  } finally {
    loaded.value = true
  }
}

async function createNewRecord() {
  if (!episode.value) return
  await forceSave()
  clearDraft(episode.value.id)

  const id = await recordsStore.createRecord(episode.value.id, 0, '', [], [])
  currentRecordId.value = id
  rating.value = 0
  review.value = ''
  images.value = []
  tags.value = []
  dirty.value = false

  await loadEpisodeRecords()
  props.toast?.('新记录已创建', 'success')
}

async function switchActiveRecord(recordId) {
  if (!episode.value) return
  await forceSave()
  clearDraft(episode.value.id)

  await recordsStore.setActiveRecord(episode.value.id, recordId)
  currentRecordId.value = recordId

  const record = await recordsStore.getRecord(recordId)
  if (record) {
    skipWatchers = true
    rating.value = record.rating ?? 0
    review.value = record.review ?? ''
    images.value = parseJsonSafe(record.images)
    tags.value = parseJsonSafe(record.tags)
    watchedDate.value = record.watchedDate || new Date().toISOString().split('T')[0]
    await nextTick()
    skipWatchers = false
  }
  dirty.value = false
  props.toast?.('已切换主记录', 'info')
}

async function deleteRecord(recordId) {
  confirmDialog.value = {
    visible: true,
    title: '删除记录',
    message: '确定要删除这条观看记录吗？',
    onConfirm: async () => {
      confirmDialog.value.visible = false
      if (recordId === currentRecordId.value) {
        const idx = episodeRecords.value.findIndex(r => r.id === recordId)
        const nextRecord = episodeRecords.value[idx + 1] || episodeRecords.value[idx - 1]
        if (nextRecord) {
          await switchActiveRecord(nextRecord.id)
        } else {
          skipWatchers = true
          rating.value = 0
          review.value = ''
          images.value = []
          tags.value = []
          watchedDate.value = new Date().toISOString().split('T')[0]
          currentRecordId.value = null
          await nextTick()
          skipWatchers = false
        }
      }
      await recordsStore.deleteRecord(recordId)
      await loadEpisodeRecords()
      props.toast?.('记录已删除', 'info')
    },
  }
}

async function jumpToEpisode(episodeData) {
  if (!episodeData) return
  await forceSave()
  if (episode.value) clearDraft(episode.value.id)
  router.push(`/episode/${episodeData.id}`)
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/')
}

function openPicker() {
  if (episode.value) {
    pickerSeason.value = episode.value.season
  }
  showPicker.value = true
}

function selectEpisode(ep) {
  showPicker.value = false
  jumpToEpisode(ep)
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

watch(() => route.params.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    initPage()
  }
})

onMounted(() => {
  initPage()
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  // 先保存草稿（同步操作），forceSave 在路由守卫中已处理
  saveToDraft()
})

onBeforeRouteLeave(async (to, from, next) => {
  await forceSave()
  saveToDraft()
  next()
})
</script>

<template>
  <div class="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
    <!-- 顶栏 -->
    <header class="flex items-center justify-between px-5 py-3 flex-shrink-0">
      <button @click="goBack" class="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        <span class="hidden sm:inline">返回</span>
      </button>

      <div v-if="show && episode" class="flex items-center gap-2 min-w-0">
        <span class="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]">{{ show.name }}</span>
        <span class="text-xs text-zinc-400 dark:text-zinc-500">·</span>
        <span class="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{{ episodeLabel }}</span>
      </div>

      <div class="flex items-center gap-3">
        <button @click="showSidebarMobile = !showSidebarMobile" class="md:hidden text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
          {{ showSidebarMobile ? '收起' : '面板' }}
        </button>
        <span class="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
          <span class="w-1.5 h-1.5 rounded-full" :class="dirty ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'"></span>
          {{ dirty ? '未保存' : '已保存' }}
        </span>
      </div>
    </header>

    <!-- 主区域 -->
    <div v-if="loaded" class="flex flex-col md:flex-row flex-1 min-h-0">
      <!-- 侧边栏 -->
      <aside class="w-full md:w-72 flex-shrink-0 border-t md:border-t-0 md:border-r border-zinc-200/60 dark:border-zinc-800 overflow-y-auto" :class="showSidebarMobile ? 'block' : 'hidden md:block'">
        <div class="p-4 space-y-4">

          <!-- 评分卡片 -->
          <div class="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200/60 dark:border-zinc-800">
            <div class="text-center mb-4">
              <span
                class="inline-block text-5xl font-bold tracking-tight transition-all duration-300"
                :class="rating > 0 ? 'text-amber-500' : 'text-zinc-300 dark:text-zinc-600'"
                :style="{ transform: ratingAnimation ? 'scale(1.15)' : 'scale(1)' }"
              >{{ Number(rating).toFixed(1) }}</span>
              <p class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">/ 10</p>
            </div>

            <!-- 星标快捷评分 -->
            <div class="flex justify-center gap-1 mb-4">
              <button
                v-for="star in 5" :key="star"
                @click="rating = star * 2"
                class="text-2xl transition-all duration-150 hover:scale-110"
                :class="rating >= star * 2 ? 'text-amber-400' : 'text-zinc-200 dark:text-zinc-700'"
              >★</button>
            </div>

            <!-- 精度滑块 -->
            <div class="relative">
              <input
                v-model.number="rating"
                type="range" min="0" max="10" step="0.1"
                class="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                :class="rating > 0 ? 'accent-amber-400' : 'accent-zinc-300 dark:accent-zinc-600'"
              />
            </div>

            <!-- 快捷分档 + 数字输入 -->
            <div class="flex items-center justify-between gap-1 mt-3">
              <button
                v-for="n in [0,2,4,6,8,10]" :key="n"
                @click="rating = n"
                class="w-8 h-6 rounded-md text-[10px] font-medium transition-colors"
                :class="rating === n ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-500'"
              >{{ n }}</button>
              <input
                :value="rating"
                @input="rating = Number($event.target.value)"
                type="number" min="0" max="10" step="0.1"
                class="w-14 text-center bg-transparent text-sm font-bold outline-none border-b-2 transition-colors"
                :class="rating > 0 ? 'text-amber-500 border-amber-300' : 'text-zinc-400 border-zinc-200 dark:border-zinc-700'"
              />
            </div>
          </div>

          <!-- 外部评分 -->
          <div v-if="externalRatings" class="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/60 dark:border-zinc-800 space-y-2">
            <p class="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">外部评分</p>
            <div v-if="externalRatings.imdbRating" class="flex items-center justify-between text-sm">
              <span class="text-zinc-600 dark:text-zinc-400">IMDb</span>
              <span class="font-semibold text-yellow-600 dark:text-yellow-500">{{ externalRatings.imdbRating }}/10</span>
            </div>
            <div v-if="externalRatings.rtRating" class="flex items-center justify-between text-sm">
              <span class="text-zinc-600 dark:text-zinc-400">烂番茄</span>
              <span class="font-semibold text-red-500">{{ externalRatings.rtRating }}</span>
            </div>
            <div v-if="externalRatings.metacritic" class="flex items-center justify-between text-sm">
              <span class="text-zinc-600 dark:text-zinc-400">Metacritic</span>
              <span class="font-semibold text-blue-500">{{ externalRatings.metacritic }}</span>
            </div>
          </div>

          <!-- 观看日期 -->
          <div class="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/60 dark:border-zinc-800">
            <p class="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium mb-2">观看日期</p>
            <input
              v-model="watchedDate"
              type="date"
              class="w-full bg-zinc-50 dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-700 border border-zinc-200/60 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
            />
          </div>

          <!-- 多刷记录 -->
          <div class="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/60 dark:border-zinc-800">
            <div class="flex items-center justify-between mb-3">
              <p class="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">多刷记录</p>
              <button @click="createNewRecord" class="text-xs text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 transition-colors font-medium">+ 新建</button>
            </div>
            <div v-if="episodeRecords.length > 0" class="space-y-1.5">
              <div
                v-for="(record, index) in episodeRecords" :key="record.id"
                @click="record.id !== currentRecordId && switchActiveRecord(record.id)"
                class="group rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200"
                :class="record.id === currentRecordId ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-transparent'"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300">第{{ episodeRecords.length - index }}次</span>
                    <span v-if="record.id === episode?.activeRecordId" class="text-[10px] bg-amber-400/20 text-amber-600 dark:text-amber-400 px-1.5 py-px rounded-full font-medium">主</span>
                  </div>
                  <span v-if="record.rating > 0" class="text-sm font-bold text-amber-500">{{ Number(record.rating).toFixed(1) }}</span>
                  <span v-else class="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                </div>
                <div class="flex items-center justify-between mt-1">
                  <span class="text-[10px] text-zinc-400 dark:text-zinc-500">{{ record.watchedDate || formatDate(record.createdAt) }}</span>
                  <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      v-if="record.id !== currentRecordId"
                      @click.stop="deleteRecord(record.id)"
                      class="text-[10px] text-red-400 hover:text-red-500 px-1 transition-colors"
                    >删除</button>
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="text-xs text-zinc-400 dark:text-zinc-500 text-center py-4">评分后自动创建</p>
          </div>
        </div>
      </aside>

      <!-- 主编辑区 -->
      <main class="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div class="flex-1 flex flex-col p-4 md:p-8 max-w-3xl">
          <!-- 标签 -->
          <div class="mb-5">
            <TagSelector v-model="tags" />
          </div>

          <!-- 感想编辑器 -->
          <div class="flex-1 flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <label class="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">感想</label>
              <div class="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
                <button @click="showPreview = false" class="px-3 py-1 text-xs rounded-md font-medium transition-colors" :class="!showPreview ? 'bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'">编辑</button>
                <button @click="showPreview = true" class="px-3 py-1 text-xs rounded-md font-medium transition-colors" :class="showPreview ? 'bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'">预览</button>
              </div>
            </div>

            <textarea
              v-if="!showPreview"
              v-model="review"
              placeholder="写下你的想法..."
              class="flex-1 min-h-[200px] md:min-h-[280px] w-full bg-white dark:bg-zinc-900 rounded-2xl px-5 py-4 outline-none resize-none border border-zinc-200/60 dark:border-zinc-800 text-sm md:text-base leading-relaxed text-zinc-800 dark:text-zinc-200 placeholder-zinc-300 dark:placeholder-zinc-600 focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-800 transition-shadow"
            ></textarea>
            <div
              v-else
              class="flex-1 min-h-[200px] md:min-h-[280px] w-full bg-white dark:bg-zinc-900 rounded-2xl px-5 py-4 border border-zinc-200/60 dark:border-zinc-800 text-sm md:text-base leading-relaxed overflow-y-auto markdown-body text-zinc-800 dark:text-zinc-200"
              v-html="renderMarkdown(review || '*暂无感想*')"
            ></div>
            <p class="text-[10px] text-zinc-300 dark:text-zinc-600 mt-2">支持 Markdown · 停止输入后自动保存</p>
          </div>

          <!-- 图片 -->
          <div class="mt-6">
            <ImageManager v-model="images" />
          </div>
        </div>
      </main>

      <!-- 右侧选集面板 -->
      <aside class="w-48 flex-shrink-0 border-l border-zinc-200/60 dark:border-zinc-800 overflow-hidden flex flex-col hidden xl:flex" :class="{ '!hidden': !showRightPanel }">
        <div class="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200/60 dark:border-zinc-800">
          <span class="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">选集</span>
          <button @click="showRightPanel = false" class="text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 text-xs leading-none">×</button>
        </div>

        <!-- 季标签 -->
        <div v-if="availableSeasons.length > 1" class="flex gap-0.5 px-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800 overflow-x-auto">
          <button
            v-for="s in availableSeasons" :key="s"
            @click="rightSeason = s"
            class="px-2 py-0.5 text-[10px] rounded-md font-medium transition-colors whitespace-nowrap flex-shrink-0"
            :class="rightSeason === s ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-500'"
          >S{{ s }}</button>
        </div>

        <!-- 集数列表 -->
        <div class="flex-1 overflow-y-auto">
          <template v-for="ep in episodesStore.episodes.filter(e => rightSeason === 0 || e.season === rightSeason)" :key="ep.id">
            <button
              :id="`ep-nav-${ep.id}`"
              @click="selectEpisode(ep)"
              class="w-full flex items-center gap-2.5 px-3 py-2 transition-colors text-left group"
              :class="ep.id === episode?.id
                ? 'bg-amber-50 dark:bg-amber-900/20 border-l-2 border-amber-400'
                : 'border-l-2 border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'"
            >
              <span
                class="text-xs font-medium tabular-nums w-5 text-right flex-shrink-0"
                :class="ep.id === episode?.id ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'"
              >{{ String(ep.episode).padStart(2, '0') }}</span>
              <span
                v-if="episodeScores[ep.id]?.rating > 0"
                class="text-[11px] font-bold text-amber-500 tabular-nums"
              >{{ Number(episodeScores[ep.id].rating).toFixed(1) }}</span>
              <span
                v-else-if="episodeScores[ep.id]?.count > 0"
                class="text-[11px] text-zinc-300 dark:text-zinc-600"
              >—</span>
              <span
                v-else
                class="text-[11px] text-zinc-200 dark:text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums"
              >—</span>
              <span
                v-if="episodeScores[ep.id]?.count > 1"
                class="text-[9px] text-zinc-300 dark:text-zinc-600 ml-auto"
              >×{{ episodeScores[ep.id].count }}</span>
            </button>
          </template>
        </div>
      </aside>
    </div>

    <!-- 加载状态 -->
    <div v-else class="flex-1 flex items-center justify-center">
      <div class="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
        <div class="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 animate-bounce" style="animation-delay: 0ms"></div>
        <div class="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 animate-bounce" style="animation-delay: 150ms"></div>
        <div class="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 animate-bounce" style="animation-delay: 300ms"></div>
      </div>
    </div>

    <!-- 底部导航 -->
    <footer class="flex-shrink-0 border-t border-zinc-200/60 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-4 py-2.5">
      <div class="max-w-3xl mx-auto flex items-center justify-between">
        <button
          :disabled="!prevEpisode"
          @click="jumpToEpisode(prevEpisode)"
          class="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all"
          :class="prevEpisode ? 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95' : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          上一{{ epTerm }}
        </button>

        <button
          @click="openPicker"
          class="text-xs text-zinc-500 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors px-4 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          第 {{ episode?.episode }} {{ epTerm }}
        </button>

        <button
          :disabled="!nextEpisode"
          @click="jumpToEpisode(nextEpisode)"
          class="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all"
          :class="nextEpisode ? 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95' : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'"
        >
          下一{{ epTerm }}
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    </footer>

    <!-- 集数选择弹窗 -->
    <div
      v-if="showPicker"
      class="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
      @click.self="showPicker = false"
    >
      <div class="bg-white dark:bg-zinc-900 rounded-t-2xl w-full max-w-lg max-h-[70vh] flex flex-col animate-slide-up">
        <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-200/60 dark:border-zinc-800">
          <h3 class="font-medium text-zinc-800 dark:text-zinc-200">快速跳转</h3>
          <button @click="showPicker = false" class="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">✕</button>
        </div>
        <div class="px-5 py-3 border-b border-zinc-200/60 dark:border-zinc-800 overflow-x-auto">
          <div class="flex items-center gap-1.5">
            <button
              v-for="s in availableSeasons" :key="s"
              @click="pickerSeason = s"
              class="px-3 py-1.5 text-xs rounded-lg transition-colors font-medium whitespace-nowrap"
              :class="pickerSeason === s ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-400'"
            >
              第{{ s }}{{ seasonLabel }}
            </button>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="ep in episodesInPickerSeason" :key="ep.id"
              @click="selectEpisode(ep)"
              class="py-3 rounded-xl text-sm font-medium transition-all active:scale-95"
              :class="ep.id === episode?.id
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
            >
              {{ ep.episode }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :visible="confirmDialog.visible"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :danger="true"
      confirm-text="删除"
      @confirm="confirmDialog.onConfirm?.()"
      @cancel="confirmDialog.visible = false"
    />
  </div>
</template>

<style scoped>
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.animate-slide-up {
  animation: slide-up 0.25s ease-out;
}

textarea::placeholder {
  color: inherit;
  opacity: 0.4;
}
</style>
