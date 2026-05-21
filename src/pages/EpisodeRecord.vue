<script setup>
import { ref, watch, computed, nextTick, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useRecordsStore } from '../stores/records'
import { useEpisodesStore } from '../stores/episodes'
import { useShowsStore } from '../stores/shows'
import { debounce } from '../utils/debounce'
import { saveDraft, clearDraft, loadDraft } from '../utils/draftCache'
import { getTerminology } from '../utils/terminology'
import ImageManager from '../components/ImageManager.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import RatingPanel from '../components/RatingPanel.vue'
import ExternalRatings from '../components/ExternalRatings.vue'
import ReviewEditor from '../components/ReviewEditor.vue'
import RewatchList from '../components/RewatchList.vue'
import EpisodeGrid from '../components/EpisodeGrid.vue'
import BottomNav from '../components/BottomNav.vue'
import { renderMarkdown } from '../utils/markdown'
import { useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { getRatingsByTitle, hasOmdbKey } from '../utils/omdb'
import { handleError } from '../utils/errorHandler'
import { useTheme } from '../utils/theme'

const props = defineProps(['toast'])

const route = useRoute()
const { isDark } = useTheme()
const router = useRouter()

const episode = ref(null)
const show = ref(null)
const rating = ref(0)
const images = ref([])
const tags = ref([])
const watchedDate = ref('')
const loaded = ref(false)
const dirty = ref(false)
const currentRecordId = ref(null)
const episodeRecords = ref([])
const ratingAnimation = ref(false)
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

const showSidebarMobile = ref(false)
const rightSeason = ref(0)
const episodeScores = ref({})

const seasonLabel = computed(() => {
  const cat = show.value?.category || 'tv'
  const t = getTerminology(cat)
  return t.seasonLabel || '季'
})

const availableSeasons = computed(() => {
  const seasons = new Set()
  for (const ep of episodesStore.episodes) {
    seasons.add(ep.season)
  }
  return [...seasons].sort((a, b) => a - b)
})

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit.configure({ heading: { levels: [1, 2] } }),
    Underline,
    Link.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder: '写下你的想法...' }),
  ],
  editorProps: {
    attributes: {
      class: 'flex-1 min-h-[200px] md:min-h-[360px] w-full bg-white dark:bg-zinc-900 rounded-2xl px-5 py-4 border border-zinc-200/60 dark:border-zinc-800 text-sm md:text-base leading-relaxed text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-800 transition-shadow overflow-y-auto prose prose-zinc dark:prose-invert prose-sm max-w-none',
    },
  },
  onUpdate: () => {
    dirty.value = true
  },
})

let skipWatchers = false
let lastRating = 0

function parseJsonSafe(str) {
  try { return JSON.parse(str) } catch { return [] }
}

async function forceSave() {
  if (!currentRecordId.value || !episode.value) return
  try {
    await recordsStore.updateRecord(currentRecordId.value, {
      rating: rating.value,
      review: getReviewHTML(),
      images: images.value,
      tags: tags.value,
      watchedDate: watchedDate.value || null,
    })
    dirty.value = false
  } catch (e) {
    handleError(e, 'ForceSave')
  }
}

function saveToDraft() {
  if (!episode.value) return
  saveDraft(episode.value.id, {
    rating: rating.value,
    review: getReviewHTML(),
    images: images.value,
    tags: tags.value,
    watchedDate: watchedDate.value,
  })
}

async function ensureRecordExists() {
  if (!episode.value || !loaded.value) return
  if (!currentRecordId.value) {
    const id = await recordsStore.createRecord(
      episode.value.id, rating.value, getReviewHTML(), images.value, tags.value, watchedDate.value
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
    if (episode.value) {
      episodeScores.value = {
        ...episodeScores.value,
        [episode.value.id]: { rating: val, count: Math.max(episodeScores.value[episode.value.id]?.count || 1, 1) },
      }
    }
  }
  saveToDraft()
}, 300)

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

const debouncedUndoToast = debounce((oldVal, newVal) => {
  if (oldVal === 0 || oldVal === newVal) return
  props.toast?.(`评分: ${Number(oldVal).toFixed(1)} → ${Number(newVal).toFixed(1)}`, () => {
    skipWatchers = true
    rating.value = oldVal
    skipWatchers = false
  })
}, 600)

watch(rating, (val, oldVal) => {
  if (skipWatchers) return
  if (lastRating === 0 && oldVal > 0) lastRating = oldVal
  dirty.value = true
  ratingAnimation.value = true
  setTimeout(() => ratingAnimation.value = false, 300)
  debouncedSaveRating(val)
  if (lastRating > 0 && val !== lastRating) {
    debouncedUndoToast(lastRating, val)
    lastRating = 0
  }
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

async function fetchEpisodeScores() {
  if (!show.value) return
  try {
    episodeScores.value = await episodesStore.fetchAllEpisodeScores()
  } catch (e) {
    handleError(e, 'FetchEpisodeScores')
  }
}

async function initPage({ skipFetchEpisodes = false } = {}) {
  loaded.value = false
  skipWatchers = true
  lastRating = 0

  try {
    const episodeId = Number(route.params.id)
    episode.value = await episodesStore.getEpisode(episodeId)

    if (!episode.value) {
      router.push('/')
      return
    }

    const prevShowId = show.value?.id
    const showChanged = episode.value.show_id !== prevShowId

    if (showChanged) {
      show.value = await showsStore.getShow(episode.value.show_id)
    }
    episode.value._category = show.value?.category || 'tv'
    episodeLabel.value = episodesStore.episodeLabel(episode.value)

    if (!skipFetchEpisodes || showChanged) {
      await episodesStore.fetchEpisodes(episode.value.show_id)
      await fetchEpisodeScores()
    }
    rightSeason.value = episode.value.season || availableSeasons.value[0] || 0

    const { prev, next } = episodesStore.getAdjacentEpisodes(episodeId)
    prevEpisode.value = prev
    nextEpisode.value = next

    currentRecordId.value = null
    rating.value = 0
    editor.value?.commands.setContent('')
    images.value = []
    tags.value = []
    watchedDate.value = new Date().toISOString().split('T')[0]
    dirty.value = false

    const activeRecord = await recordsStore.getActiveRecord(episodeId)

    if (activeRecord) {
      currentRecordId.value = activeRecord.id
      rating.value = activeRecord.rating ?? 0
      setEditorContent(activeRecord.review ?? '')
      images.value = parseJsonSafe(activeRecord.images)
      tags.value = parseJsonSafe(activeRecord.tags)
      watchedDate.value = activeRecord.watchedDate || new Date().toISOString().split('T')[0]
    } else {
      const draft = loadDraft(episodeId)
      if (draft) {
        rating.value = draft.rating ?? 0
        setEditorContent(draft.review ?? '')
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

    if (editor.value && !editor.value.getText().trim()) {
      editor.value.commands.focus()
    }
  } catch (e) {
    handleError(e, 'InitPage', props.toast)
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
  editor.value?.commands.setContent('')
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
    setEditorContent(record.review ?? '')
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
          editor.value?.commands.setContent('')
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
  showSidebarMobile.value = false
  router.push(`/episode/${episodeData.id}`)
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/')
}

function selectEpisode(ep) {
  jumpToEpisode(ep)
}

function getReviewHTML() {
  return editor.value?.getHTML() || ''
}

function setLink() {
  const previousUrl = editor.value?.getAttributes('link').href || ''
  const url = window.prompt('链接地址', previousUrl)
  if (url === null) return
  if (url === '') {
    editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.value?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

function setEditorContent(content) {
  const text = content || ''
  if (!text) { editor.value?.commands.setContent(''); return }
  if (/<\/?[a-z][\s\S]*>/i.test(text)) {
    editor.value?.commands.setContent(text)
  } else {
    editor.value?.commands.setContent(renderMarkdown(text))
  }
}

async function shareReview() {
  const el = document.querySelector('.review-share-card')
  if (!el) return

  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(el, {
      backgroundColor: isDark.value ? '#18181b' : '#ffffff',
      scale: 2,
    })

    if (navigator.share && navigator.canShare) {
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], 'review.png', { type: 'image/png' })
        try {
          await navigator.share({
            title: `${show.value?.name} - ${episodeLabel.value}`,
            text: `评分：${rating.value}/10`,
            files: [file],
          })
        } catch {
          // 用户取消分享，降级为下载
          downloadCanvas(canvas)
        }
      })
    } else {
      downloadCanvas(canvas)
    }
  } catch (e) {
    handleError(e, 'ShareReview', props.toast)
  }
}

function downloadCanvas(canvas) {
  const link = document.createElement('a')
  link.download = `review-${episode.value?.id}.png`
  link.href = canvas.toDataURL()
  link.click()
}

watch(() => route.params.id, async (newId, oldId) => {
  if (!newId || newId === oldId) return

  // 同 show 下切换集，复用 episodes 缓存
  const newEp = await episodesStore.getEpisode(Number(newId))
  const sameShow = newEp && newEp.show_id === episode.value?.show_id
  await initPage({ skipFetchEpisodes: sameShow })
})

onMounted(() => {
  initPage()
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  debouncedSaveRating.cancel()
  debouncedSaveImages.cancel()
  debouncedSaveTags.cancel()
  debouncedSaveWatchedDate.cancel()
  debouncedUndoToast.cancel()
  saveToDraft()
})

onBeforeRouteLeave(async (to, from, next) => {
  await forceSave()
  saveToDraft()
  next()
})
</script>

<template>
  <div class="h-[100dvh] flex flex-col bg-zinc-50 dark:bg-zinc-950">
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
        <button @click="showSidebarMobile = true" class="md:hidden flex items-center gap-1 text-xs text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
          选集 ({{ episodesStore.episodes.length }})
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
      <aside class="w-full md:w-72 flex-shrink-0 border-t md:border-t-0 md:border-r border-zinc-200/60 dark:border-zinc-800 overflow-y-auto hidden md:block">
        <div class="p-4 space-y-4">
          <RatingPanel v-model:rating="rating" :animation="ratingAnimation" />
          <ExternalRatings :ratings="externalRatings" />

          <div class="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/60 dark:border-zinc-800">
            <p class="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium mb-2">观看日期</p>
            <input
              v-model="watchedDate"
              type="date"
              class="w-full bg-zinc-50 dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-700 border border-zinc-200/60 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
            />
          </div>

          <RewatchList
            :records="episodeRecords"
            :current-record-id="currentRecordId"
            :active-record-id="episode?.activeRecordId"
            @create="createNewRecord"
            @switch="switchActiveRecord"
            @delete="deleteRecord"
          />
        </div>
      </aside>

      <!-- 主编辑区 -->
      <main class="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div class="flex-1 flex flex-col p-4 md:p-8">
          <div class="review-share-card bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200/60 dark:border-zinc-800 mb-4">
            <div class="flex items-center gap-2 mb-3">
              <span class="text-sm font-medium text-zinc-800 dark:text-zinc-200">{{ show?.name }}</span>
              <span class="text-xs text-zinc-400 dark:text-zinc-500">·</span>
              <span class="text-xs text-zinc-500 dark:text-zinc-400">{{ episodeLabel }}</span>
              <span v-if="rating > 0" class="ml-auto text-amber-400 font-bold text-sm">{{ Number(rating).toFixed(1) }}/10</span>
            </div>
            <ReviewEditor :editor="editor" @set-link="setLink" />
          </div>
          <div class="flex items-center gap-2">
            <div class="flex-1">
              <ImageManager v-model="images" />
            </div>
            <button
              @click="shareReview"
              class="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 rounded-lg transition-colors"
              title="分享感想"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
              分享
            </button>
          </div>
        </div>
      </main>

      <!-- 右侧选集面板 (桌面) -->
      <aside
        class="w-56 xl:w-60 flex-shrink-0 border-l border-zinc-200/60 dark:border-zinc-800 overflow-hidden hidden xl:flex flex-col"
      >
        <div class="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200/60 dark:border-zinc-800 flex-shrink-0">
          <span class="text-[11px] text-zinc-400 dark:text-zinc-500 tracking-wider font-medium uppercase">选集</span>
        </div>
        <EpisodeGrid
          :episodes="episodesStore.episodes"
          :current-episode-id="episode?.id"
          :episode-scores="episodeScores"
          :available-seasons="availableSeasons"
          :season-label="seasonLabel"
          v-model:season="rightSeason"
          @select="selectEpisode"
        />
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

    <!-- 移动端底部选集面板 (2.1) -->
    <Transition name="fade">
      <div v-if="showSidebarMobile" @click="showSidebarMobile = false" class="fixed inset-0 bg-black/50 z-30 md:hidden"></div>
    </Transition>
    <Transition name="slide-up">
      <div v-if="showSidebarMobile" class="fixed inset-x-0 bottom-0 z-40 max-h-[60vh] bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl border-t border-zinc-200 dark:border-zinc-800 overflow-y-auto md:hidden">
        <div class="flex justify-center pt-2 pb-1">
          <div class="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
        </div>
        <EpisodeGrid
          :episodes="episodesStore.episodes"
          :current-episode-id="episode?.id"
          :episode-scores="episodeScores"
          :available-seasons="availableSeasons"
          :season-label="seasonLabel"
          v-model:season="rightSeason"
          @select="selectEpisode"
        />
      </div>
    </Transition>

    <!-- 底部导航 -->
    <BottomNav
      :prev-episode="prevEpisode"
      :next-episode="nextEpisode"
      :current-episode="episode"
      :ep-term="epTerm"
      @jump="jumpToEpisode"
    />

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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active {
  transition: transform 0.3s ease-out;
}
.slide-up-leave-active {
  transition: transform 0.2s ease-in;
}
.slide-up-enter-from {
  transform: translateY(100%);
}
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
