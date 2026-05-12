<script setup>
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { db } from '../db'
import { useRecordsStore } from '../stores/records'
import { useEpisodesStore } from '../stores/episodes'
import { debounce } from '../utils/debounce'
import { saveDraft, clearDraft, loadDraft } from '../utils/draftCache'
import { getTerminology } from '../utils/terminology'
import ImageManager from '../components/ImageManager.vue'
import TagSelector from '../components/TagSelector.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { renderMarkdown } from '../utils/markdown'

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

const recordsStore = useRecordsStore()
const episodesStore = useEpisodesStore()

const episodeLabel = ref('')
const prevEpisode = ref(null)
const nextEpisode = ref(null)

const epTerm = computed(() => {
  const cat = show.value?.category || 'tv'
  return getTerminology(cat).episodeLabel
})

const showPicker = ref(false)
const pickerSeason = ref(0)

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
    await db.records.update(currentRecordId.value, {
      rating: rating.value,
      review: review.value,
      images: JSON.stringify(images.value),
      tags: JSON.stringify(tags.value),
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
  if (currentRecordId.value) {
    await recordsStore.updateRecord(currentRecordId.value, { images: val })
    dirty.value = false
  }
  saveToDraft()
}, 1000)

const debouncedSaveTags = debounce(async (val) => {
  if (skipWatchers) return
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

async function initPage() {
  loaded.value = false
  skipWatchers = true

  const episodeId = Number(route.params.id)
  episode.value = await episodesStore.getEpisode(episodeId)

  if (!episode.value) {
    router.push('/')
    return
  }

  show.value = await db.shows.get(episode.value.showId)
  episode.value._category = show.value?.category || 'tv'
  episodeLabel.value = episodesStore.episodeLabel(episode.value)

  await episodesStore.fetchEpisodes(episode.value.showId)
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
  loaded.value = true

  await nextTick()
  skipWatchers = false

  const textarea = document.querySelector('textarea')
  if (textarea && !review.value) {
    textarea.focus()
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

  const record = await db.records.get(recordId)
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
  forceSave()
  saveToDraft()
})

onBeforeRouteLeave(async (to, from, next) => {
  await forceSave()
  saveToDraft()
  next()
})
</script>

<template>
  <div class="h-screen flex flex-col">
    <div class="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
      <button @click="goBack" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm transition flex items-center gap-1">
        <span>←</span>
        <span>返回</span>
      </button>
      <div v-if="show && episode" class="flex items-center gap-2">
        <span class="font-semibold text-sm">{{ show.name }}</span>
        <span class="text-gray-400 dark:text-gray-500 text-sm">{{ episodeLabel }}</span>
        <span v-if="episodeRecords.length > 1" class="text-xs text-gray-400 dark:text-gray-500">
          (第{{ watchCount(episode.id) }}次)
        </span>
      </div>
      <div class="flex items-center gap-3">
          <span v-if="dirty" class="text-xs text-amber-400">未保存</span>
          <span v-else class="text-xs text-emerald-400">已保存</span>
        </div>
    </div>

    <div v-if="loaded" class="flex flex-1 min-h-0">
      <div class="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-y-auto">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800">
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-2">评分</label>
          <div
            class="text-4xl font-bold text-amber-400 text-center mb-3 transition-transform duration-300"
            :class="{ 'scale-110': ratingAnimation }"
          >
            {{ Number(rating).toFixed(1) }}
          </div>
          <input
            v-model.number="rating"
            type="range"
            min="0"
            max="10"
            step="0.1"
            class="w-full accent-indigo-500"
          />
          <div class="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
            <span>0</span>
            <input
              :value="rating"
              @input="rating = Number($event.target.value)"
              type="number"
              min="0"
              max="10"
              step="0.1"
              class="w-16 text-center bg-gray-200 dark:bg-gray-700 rounded px-1 py-0.5 text-xs font-bold text-amber-400 outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span>10</span>
          </div>
        </div>

        <div class="p-4 border-b border-gray-200 dark:border-gray-800">
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-2">观看日期</label>
          <input
            v-model="watchedDate"
            type="date"
            class="w-full bg-gray-200 dark:bg-gray-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div class="p-4 flex-1">
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-gray-500 dark:text-gray-400">多刷记录</label>
            <button
              @click="createNewRecord"
              class="text-[10px] text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 dark:hover:text-indigo-300 transition"
            >
              + 新建
            </button>
          </div>

          <div v-if="episodeRecords.length > 0" class="space-y-1.5">
            <div
              v-for="(record, index) in episodeRecords"
              :key="record.id"
              class="rounded-lg px-3 py-2 cursor-pointer transition text-sm"
              :class="record.id === currentRecordId ? 'bg-indigo-100 dark:bg-indigo-600/20 border border-indigo-300 dark:border-indigo-500/30' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-medium">第{{ episodeRecords.length - index }}次</span>
                  <span v-if="record.id === episode?.activeRecordId" class="text-[10px] bg-gray-800 text-gray-100 dark:bg-indigo-600 dark:text-indigo-100 px-1.5 py-0.5 rounded-full">主</span>
                </div>
                <span v-if="record.rating > 0" class="text-sm font-bold text-amber-400">{{ Number(record.rating).toFixed(1) }}</span>
                <span v-else class="text-[10px] text-gray-400">—</span>
              </div>
              <div class="flex items-center justify-between mt-1">
                <span class="text-[10px] text-gray-400 dark:text-gray-500">{{ record.watchedDate || formatDate(record.createdAt) }}</span>
                <div class="flex gap-1">
                  <button
                    v-if="record.id !== episode?.activeRecordId"
                    @click.stop="switchActiveRecord(record.id)"
                    class="text-[10px] text-indigo-500 hover:text-indigo-400 px-1 rounded transition"
                  >主</button>
                  <button
                    v-if="record.id !== currentRecordId"
                    @click.stop="deleteRecord(record.id)"
                    class="text-[10px] text-red-400 hover:text-red-300 px-1 rounded transition"
                  >删</button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-[10px] text-gray-400 dark:text-gray-500 text-center py-4">
            评分后自动创建
          </div>
        </div>
      </div>

      <div class="flex-1 flex flex-col min-w-0">
        <div class="flex-1 flex flex-col p-6 overflow-y-auto">
          <div class="flex-1 flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <label class="block text-sm text-gray-500 dark:text-gray-400">感想</label>
              <div class="flex items-center gap-1">
                <button @click="showPreview = false" class="px-2 py-0.5 text-xs rounded transition" :class="!showPreview ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'">编辑</button>
                <button @click="showPreview = true" class="px-2 py-0.5 text-xs rounded transition" :class="showPreview ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'">预览</button>
              </div>
            </div>
            <textarea
              v-if="!showPreview"
              v-model="review"
              placeholder="写下你的感想..."
              class="flex-1 min-h-[200px] w-full bg-white dark:bg-gray-800 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500 resize-none border border-gray-200 dark:border-gray-700 text-sm leading-relaxed"
            ></textarea>
            <div
              v-else
              class="flex-1 min-h-[200px] w-full bg-white dark:bg-gray-800 rounded-xl px-5 py-4 border border-gray-200 dark:border-gray-700 text-sm leading-relaxed overflow-y-auto markdown-body"
              v-html="renderMarkdown(review || '*暂无感想*')"
            ></div>
            <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">支持 Markdown 语法，停止输入 500ms 后自动保存</p>
          </div>

          <div class="mt-4">
            <TagSelector v-model="tags" />
          </div>

          <div class="mt-4">
            <ImageManager v-model="images" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">加载中...</div>

    <div class="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
      <div class="max-w-4xl mx-auto flex items-center justify-between">
        <button
          :disabled="!prevEpisode"
          @click="jumpToEpisode(prevEpisode)"
          class="px-3 py-1.5 rounded-lg text-sm transition"
          :class="prevEpisode ? 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200' : 'bg-gray-100 text-gray-300 dark:bg-gray-800/50 dark:text-gray-600 cursor-not-allowed'"
        >
          ← 上一{{ epTerm }}
        </button>

        <button
          @click="openPicker"
          class="text-sm text-gray-500 hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400 transition px-3 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {{ episodeLabel }} ▾
        </button>

        <button
          :disabled="!nextEpisode"
          @click="jumpToEpisode(nextEpisode)"
          class="px-3 py-1.5 rounded-lg text-sm transition"
          :class="nextEpisode ? 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200' : 'bg-gray-100 text-gray-300 dark:bg-gray-800/50 dark:text-gray-600 cursor-not-allowed'"
        >
          下一{{ epTerm }} →
        </button>
      </div>
    </div>

    <div
      v-if="showPicker"
      class="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
      @click.self="showPicker = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-t-2xl w-full max-w-lg max-h-[70vh] flex flex-col border-t border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="font-medium">快速跳转</h3>
          <button @click="showPicker = false" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">✕</button>
        </div>

        <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <div class="flex items-center gap-2">
            <button
              v-for="s in availableSeasons"
              :key="s"
              @click="pickerSeason = s"
              class="px-3 py-1.5 text-xs rounded-full transition whitespace-nowrap"
              :class="pickerSeason === s ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'"
            >
              第{{ s }}{{ seasonLabel }}
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="ep in episodesInPickerSeason"
              :key="ep.id"
              @click="selectEpisode(ep)"
              class="py-2.5 rounded-lg text-sm font-medium transition text-center"
              :class="ep.id === episode?.id
                ? 'bg-gray-800 text-white dark:bg-indigo-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700/50 dark:text-gray-400 dark:hover:bg-gray-700'"
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
