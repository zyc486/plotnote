<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useShowsStore } from '../stores/shows'
import { importFromJSON } from '../utils/exportImport'
import { searchShows as searchTvmaze, getShowEpisodes, buildEpisodesFromApi } from '../utils/tvmaze'
import { searchMovies, setTmdbApiKey, hasCustomTmdbKey, findTvPoster, findMoviePosterFallback } from '../utils/tmdb'
import { searchAnime } from '../utils/anilist'
import { searchAnime as searchAnimeJikan } from '../utils/jikan'

import { searchBooks } from '../utils/googleBooks'
import { getTerminology, progressLabel } from '../utils/terminology'
import { CATEGORIES, SHOW_STATUSES } from '../db'
import { debounce } from '../utils/debounce'
import { getBackupStatus, checkAndRestore, formatBackupTime, pullFromGitHub } from '../utils/autoBackup'
import GenreSelector from '../components/GenreSelector.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import CoverImage from '../components/CoverImage.vue'

const props = defineProps(['toast'])
const router = useRouter()
const store = useShowsStore()

const showForm = ref(false)
const activeCategory = ref('')
const activeStatus = ref('')
const sortBy = ref('name')

const selectedCategory = ref('')
const searchQuery = ref('')
const searchResults = ref([])
const searching = ref(false)
const searchError = ref('')
const selectedResult = ref(null)
const resultEpisodes = ref([])
const fetchingEpisodes = ref(false)
const addName = ref('')
const addAuthor = ref('')

const manualMode = ref(false)
const manualName = ref('')
const manualVolumes = ref(1)
const manualItemsPerVol = ref(10)

const showRegion = ref('')
const showGenres = ref([])

const showEditForm = ref(false)
const editingShow = ref(null)
const editName = ref('')
const editCategory = ref('')
const editRegion = ref('')
const editGenres = ref([])
const editSeriesId = ref(null)
const editCoverImage = ref('')
const editAuthor = ref('')
const editStatus = ref('')
const editStartDate = ref('')
const editFinishDate = ref('')
const seriesList = ref([])
const seriesInput = ref('')

const tmdbKeyInput = ref('')
const showTmdbSettings = ref(false)
const backupStatus = ref('none')
const showRestorePrompt = ref(false)
const pendingBackupData = ref(null)
const fetchingCovers = ref(false)
const confirmDialog = ref({ visible: false, title: '', message: '', onConfirm: null })

onMounted(async () => {
  await store.fetchShows()
  seriesList.value = await store.getAllSeries()
  backupStatus.value = getBackupStatus()

  const remoteData = await pullFromGitHub()
  if (remoteData) {
    await store.fetchShows()
    seriesList.value = await store.getAllSeries()
    props.toast?.('已从 GitHub 同步最新数据', 'success')
  }

  const backup = await checkAndRestore()
  if (backup) {
    pendingBackupData.value = backup
    showRestorePrompt.value = true
  }
  document.addEventListener('click', closeStatusDropdown)

  window.addEventListener('plotnote-sync-down', handleSyncDown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeStatusDropdown)
  window.removeEventListener('plotnote-sync-down', handleSyncDown)
})

async function handleSyncDown() {
  await store.fetchShows()
  seriesList.value = await store.getAllSeries()
  props.toast?.('已从 GitHub 同步最新数据', 'success')
}

function closeStatusDropdown() {
  statusDropdownId.value = null
}

async function confirmRestore() {
  if (!pendingBackupData.value) return
  try {
    await importFromJSON(pendingBackupData.value)
    await store.fetchShows()
    seriesList.value = await store.getAllSeries()
    showRestorePrompt.value = false
    pendingBackupData.value = null
    props.toast?.('数据已从自动备份恢复', 'success')
  } catch (e) {
    props.toast?.('恢复失败: ' + e.message, 'error')
  }
}

function dismissRestore() {
  showRestorePrompt.value = false
  pendingBackupData.value = null
}

const seriesMap = computed(() => {
  const map = {}
  for (const s of seriesList.value) map[s.id] = s.name
  return map
})


const debouncedSearch = debounce(async (query) => {
  if (!query.trim()) { searchResults.value = []; return }
  searching.value = true
  searchError.value = ''
  try {
    const cat = selectedCategory.value
    const q = query.trim()
    if (cat === 'movie') {
      const results = await searchMovies(q)
      const missing = results.filter(r => !r.image)
      if (missing.length > 0) {
        const fbImage = await findMoviePosterFallback(q)
        if (fbImage) missing.forEach(r => { if (!r.image) r.image = fbImage })
      }
      searchResults.value = results
    } else if (cat === 'animation') {
      let results = await searchAnime(q)
      if (results.length === 0) {
        results = await searchAnimeJikan(q)
      }
      searchResults.value = results
    } else if (cat === 'book') {
      searchResults.value = await searchBooks(q)
    } else {
      const results = await searchTvmaze(q)
      const missing = results.filter(r => !r.image)
      if (missing.length > 0) {
        const fbImage = await findTvPoster(q)
        if (fbImage) missing.forEach(r => { if (!r.image) r.image = fbImage })
      }
      searchResults.value = results
    }
  } catch (e) {
    searchError.value = e.message || '搜索失败，请检查网络'
    searchResults.value = []
  } finally {
    searching.value = false
  }
}, 400)

function onSearchInput() {
  selectedResult.value = null
  resultEpisodes.value = []
  debouncedSearch(searchQuery.value)
}

function switchCategory(cat) {
  selectedCategory.value = cat
  selectedResult.value = null
  resultEpisodes.value = []
  searchResults.value = []
  searchQuery.value = ''
}

async function selectResult(item) {
  selectedResult.value = item
  const cat = selectedCategory.value

  if (cat === 'movie') {
    showRegion.value = item.region || item.language || ''
    showGenres.value = item.genres || []
    resultEpisodes.value = [{ season: 1, episode: 1 }]
    addName.value = item.name
  } else if (cat === 'animation') {
    showGenres.value = item.genres || []
    resultEpisodes.value = [{ season: 1, episode: 1 }]
    addName.value = item.name
  } else if (cat === 'book') {
    showGenres.value = item.genres || []
    resultEpisodes.value = [{ season: 1, episode: 1 }]
    addName.value = item.name
    addAuthor.value = item.authors?.length ? item.authors.join(', ') : ''
  } else {
    showRegion.value = item.language || ''
    showGenres.value = item.genres || []
    addName.value = item.cnName || item.name
    fetchingEpisodes.value = true
    try {
      const eps = await getShowEpisodes(item.id)
      resultEpisodes.value = buildEpisodesFromApi(eps)
    } catch { resultEpisodes.value = [] }
    finally { fetchingEpisodes.value = false }
  }
}

function pickTitle(title) {
  addName.value = title
}

function epSummary() {
  const cat = selectedCategory.value
  const t = getTerminology(cat)
  if (!resultEpisodes.value.length) return ''
  if (cat === 'movie') {
    return `共 ${resultEpisodes.value.length} 部`
  }
  const seasons = {}
  for (const ep of resultEpisodes.value) seasons[ep.season] = true
  const count = Object.keys(seasons).length
  if (count <= 1) return `共 ${resultEpisodes.value.length} ${t.plural}`
  return `${count} ${t.seasonLabel}，共 ${resultEpisodes.value.length} ${t.plural}`
}

function confirmAdd() {
  const name = addName.value.trim()
  if (!name || !selectedResult.value) return
  if (!resultEpisodes.value.length) return
  store.addShow(name, resultEpisodes.value, {
    category: selectedCategory.value,
    region: showRegion.value,
    genres: showGenres.value,
    coverImage: selectedResult.value?.image || '',
    author: addAuthor.value.trim(),
  }).then(() => {
    closeForm()
    props.toast?.('添加成功', 'success')
  }).catch((e) => {
    props.toast?.('添加失败: ' + e.message, 'error')
  })
}

async function confirmManualAdd() {
  const name = manualName.value.trim()
  if (!name) return
  const cat = selectedCategory.value
  let eps = []
  if (cat === 'tv') {
    for (let s = 1; s <= manualVolumes.value; s++) {
      for (let e = 1; e <= manualItemsPerVol.value; e++) {
        eps.push({ season: s, episode: e })
      }
    }
  } else {
    eps = [{ season: 1, episode: 1 }]
  }
  try {
    let coverImage = ''
    if (cat === 'tv') {
      const results = await searchTvmaze(name)
      if (results.length > 0) coverImage = results[0].image || ''
      if (!coverImage) coverImage = await findTvPoster(name) || ''
    } else if (cat === 'movie') {
      try {
        const results = await searchMovies(name)
        if (results.length > 0) coverImage = results[0].image || ''
      } catch {}
      if (!coverImage) {
        try { coverImage = await findMoviePosterFallback(name) || '' } catch {}
      }
    } else if (cat === 'animation') {
      let results = await searchAnime(name)
      if (results.length === 0) results = await searchAnimeJikan(name)
      if (results.length > 0) coverImage = results[0].image || ''
    } else if (cat === 'book') {
      const results = await searchBooks(name)
      if (results.length > 0) coverImage = results[0].image || ''
    }
    await store.addShow(name, eps, {
      category: cat,
      region: showRegion.value,
      genres: showGenres.value,
      coverImage,
      author: cat === 'book' ? addAuthor.value.trim() : '',
    })
    closeForm()
    props.toast?.('添加成功', 'success')
  } catch (e) {
    props.toast?.('添加失败: ' + e.message, 'error')
  }
}

function openForm() {
  showForm.value = true
  selectedCategory.value = ''
  searchQuery.value = ''
  searchResults.value = []
  selectedResult.value = null
  resultEpisodes.value = []
  manualMode.value = false
  manualName.value = ''
  manualVolumes.value = 1
  manualItemsPerVol.value = 10
  showRegion.value = ''
  showGenres.value = []
  addAuthor.value = ''
  showTmdbSettings.value = false
  tmdbKeyInput.value = ''
}

function closeForm() { showForm.value = false }

function saveTmdbKey() {
  setTmdbApiKey(tmdbKeyInput.value.trim())
  showTmdbSettings.value = false
  props.toast?.('TMDB API Key 已保存', 'success')
  if (searchQuery.value) debouncedSearch(searchQuery.value)
}

function clearTmdbKey() {
  setTmdbApiKey('')
  tmdbKeyInput.value = ''
  showTmdbSettings.value = false
  props.toast?.('已恢复使用默认 Key', 'success')
}

function goToShow(id) { router.push(`/show/${id}`) }
function goToStats() { router.push('/statistics') }
function goToSearch() { router.push('/search') }

async function handleDelete(id, e) {
  e.stopPropagation()
  confirmDialog.value = {
    visible: true,
    title: '删除确认',
    message: '确定要删除该作品及其所有记录吗？此操作不可撤销。',
    onConfirm: async () => {
      confirmDialog.value.visible = false
      await store.deleteShow(id)
      props.toast?.('已删除', 'info')
    },
  }
}

function parseGenres(show) {
  try { return JSON.parse(show.genres) } catch { return [] }
}

function categoryLabel(key) {
  const cat = CATEGORIES.find(c => c.key === key)
  return cat ? cat.label : ''
}

function statusLabel(key) {
  const s = SHOW_STATUSES.find(st => st.key === key)
  return s ? s.label : ''
}

function statusColor(key) {
  const s = SHOW_STATUSES.find(st => st.key === key)
  return s ? s.color : ''
}

const expandedSeries = ref({})
const statusDropdownId = ref(null)

const displayItems = computed(() => {
  let shows = activeCategory.value
    ? store.shows.filter(s => s.category === activeCategory.value)
    : [...store.shows]

  if (activeStatus.value) {
    shows = shows.filter(s => (s.status || null) === activeStatus.value)
  }

  if (sortBy.value === 'avgRating') {
    shows.sort((a, b) => (Number(b.avgRating) || 0) - (Number(a.avgRating) || 0))
  } else if (sortBy.value === 'lastWatchedAt') {
    shows.sort((a, b) => (b.lastWatchedAt || 0) - (a.lastWatchedAt || 0))
  }

  const grouped = {}
  const standalone = []

  for (const show of shows) {
    if (show.seriesId) {
      if (!grouped[show.seriesId]) grouped[show.seriesId] = []
      grouped[show.seriesId].push(show)
    } else {
      standalone.push(show)
    }
  }

  const items = []
  for (const show of standalone) {
    items.push({ type: 'show', show })
  }
  for (const [seriesId, shows] of Object.entries(grouped)) {
    const name = seriesMap.value[Number(seriesId)] || shows[0].name
    const coverImage = shows.find(s => s.coverImage)?.coverImage || ''
    const totalEpisodes = shows.reduce((sum, s) => sum + (s.totalEpisodes || 0), 0)
    const ratedCount = shows.reduce((sum, s) => sum + (s.ratedCount || 0), 0)
    const ratings = shows.filter(s => s.avgRating > 0).map(s => s.avgRating)
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 0
    items.push({
      type: 'series',
      seriesId: Number(seriesId),
      seriesName: name,
      coverImage,
      category: shows[0].category,
      shows,
      totalEpisodes,
      ratedCount,
      avgRating,
    })
  }
  return items
})

function toggleSeries(seriesId) {
  expandedSeries.value[seriesId] = !expandedSeries.value[seriesId]
}

const categoryCount = computed(() => {
  const counts = {}
  for (const cat of CATEGORIES) counts[cat.key] = store.shows.filter(s => s.category === cat.key).length
  return counts
})

const statusCount = computed(() => {
  const counts = { all: store.shows.length }
  for (const st of SHOW_STATUSES) counts[st.key] = store.shows.filter(s => (s.status || null) === st.key).length
  return counts
})

function showProgressLabel(show) { return progressLabel(show) }

function progressPercent(show) {
  if (!show.totalEpisodes) return 0
  return Math.round(((show.ratedCount || 0) / show.totalEpisodes) * 100)
}

function toggleStatusDropdown(showId, e) {
  e.stopPropagation()
  statusDropdownId.value = statusDropdownId.value === showId ? null : showId
}

async function quickChangeStatus(showId, status, e) {
  e.stopPropagation()
  await store.updateShowStatus(showId, status)
  statusDropdownId.value = null
  props.toast?.('状态已更新', 'success')
}

async function fetchMissingCovers() {
  const missing = store.shows.filter(s => !s.coverImage)
  if (missing.length === 0) {
    props.toast?.('所有条目都有封面', 'success')
    return
  }
  fetchingCovers.value = true
  let filled = 0
  try {
    for (const show of missing) {
      const cat = show.category || 'tv'
      let image = ''
      try {
        if (cat === 'tv') {
          image = await findTvPoster(show.name) || ''
        } else if (cat === 'movie') {
          image = await findMoviePosterFallback(show.name) || ''
        } else if (cat === 'animation') {
          let results = await searchAnime(show.name)
          if (results.length === 0) results = await searchAnimeJikan(show.name)
          if (results.length > 0) image = results[0].image || ''
        } else if (cat === 'book') {
          const results = await searchBooks(show.name)
          if (results.length > 0) image = results[0].image || ''
        }
      } catch {}
      if (image) {
        await store.updateShowCover(show.id, image)
        filled++
      }
    }
    await store.fetchShows()
    props.toast?.(`已补全 ${filled}/${missing.length} 个封面`, filled > 0 ? 'success' : 'info')
  } catch (e) {
    props.toast?.('补全封面失败: ' + e.message, 'error')
  } finally {
    fetchingCovers.value = false
  }
}

const filteredSeries = computed(() => {
  const q = seriesInput.value.trim().toLowerCase()
  if (!q) return seriesList.value
  return seriesList.value.filter(s => s.name.toLowerCase().includes(q))
})

function selectSeries(series) {
  editSeriesId.value = series.id
  seriesInput.value = series.name
}

async function createNewSeries() {
  const name = seriesInput.value.trim()
  if (!name) return
  const id = await store.createSeries(name)
  editSeriesId.value = id
  seriesList.value = await store.getAllSeries()
}

function openEditMeta(show, e) {
  e.stopPropagation()
  editingShow.value = show
  editName.value = show.name
  editCategory.value = show.category || ''
  editRegion.value = show.region || ''
  editGenres.value = parseGenres(show)
  editSeriesId.value = show.seriesId || null
  editCoverImage.value = show.coverImage || ''
  editAuthor.value = show.author || ''
  editStatus.value = show.status || ''
  editStartDate.value = show.startDate || ''
  editFinishDate.value = show.finishDate || ''
  seriesInput.value = show.seriesId ? (seriesMap.value[show.seriesId] || '') : ''
  showEditForm.value = true
}

function closeEditForm() {
  showEditForm.value = false
  editingShow.value = null
  editAuthor.value = ''
  editStatus.value = ''
  editStartDate.value = ''
  editFinishDate.value = ''
}

async function saveEditMeta() {
  if (!editingShow.value) return
  try {
    await store.updateShowMeta(editingShow.value.id, {
      name: editName.value.trim(),
      category: editCategory.value,
      region: editRegion.value,
      genres: editGenres.value,
      seriesId: editSeriesId.value,
      coverImage: editCoverImage.value.trim(),
      author: editAuthor.value.trim(),
      status: editStatus.value || null,
      startDate: editStartDate.value || null,
      finishDate: editFinishDate.value || null,
    })
    closeEditForm()
    seriesList.value = await store.getAllSeries()
    props.toast?.('信息已更新', 'success')
  } catch (e) { props.toast?.('更新失败: ' + e.message, 'error') }
}

const manualVolLabel = computed(() => {
  const t = getTerminology(selectedCategory.value)
  return t.seasonLabel || '卷/部'
})
const manualItemLabel = computed(() => {
  const t = getTerminology(selectedCategory.value)
  return t.addLabel || '数量'
})
</script>

<template>
  <div class="max-w-2xl mx-auto p-4 md:p-6">
    <header class="flex items-center justify-between mb-6 md:mb-8">
      <h1 class="text-xl md:text-2xl font-bold">PlotNote</h1>
      <div class="flex items-center gap-1 md:gap-2">
        <button @click="goToSearch" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xs md:text-sm px-2 md:px-3 py-2 transition">搜索</button>
        <button @click="goToStats" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xs md:text-sm px-2 md:px-3 py-2 transition">统计</button>
        <router-link to="/timeline" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xs md:text-sm px-2 md:px-3 py-2 transition">时间线</router-link>
        <router-link to="/settings" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xs md:text-sm px-2 md:px-3 py-2 transition hidden sm:inline">设置</router-link>
        <button @click="openForm" class="bg-gray-800 hover:bg-gray-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition">+ 添加</button>
      </div>
    </header>

    <div v-if="store.shows.length > 0" class="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
      <button @click="activeCategory = ''" class="px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition" :class="activeCategory === '' ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'">全部 ({{ store.shows.length }})</button>
      <button v-for="cat in CATEGORIES" :key="cat.key" @click="activeCategory = cat.key" class="px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition" :class="activeCategory === cat.key ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'">{{ cat.label }} ({{ categoryCount[cat.key] || 0 }})</button>
    </div>

    <div v-if="store.shows.length > 0" class="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
      <button @click="activeStatus = ''" class="px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition" :class="activeStatus === '' ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'">全部状态</button>
      <button v-for="st in SHOW_STATUSES" :key="st.key" @click="activeStatus = st.key" class="px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition" :class="activeStatus === st.key ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'">{{ st.label }} ({{ statusCount[st.key] || 0 }})</button>
    </div>

    <div v-if="store.shows.length > 0" class="flex items-center gap-2 mb-6">
      <span class="text-xs text-gray-500 dark:text-gray-400">排序:</span>
      <button @click="sortBy = 'name'" class="px-2.5 py-1 text-xs rounded-full transition" :class="sortBy === 'name' ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'">名称</button>
      <button @click="sortBy = 'avgRating'" class="px-2.5 py-1 text-xs rounded-full transition" :class="sortBy === 'avgRating' ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'">评分</button>
      <button @click="sortBy = 'lastWatchedAt'" class="px-2.5 py-1 text-xs rounded-full transition" :class="sortBy === 'lastWatchedAt' ? 'bg-gray-800 text-white dark:bg-indigo-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'">最近观看</button>
      <span class="flex-1"></span>
      <button v-if="store.shows.some(s => !s.coverImage)" @click="fetchMissingCovers" :disabled="fetchingCovers" class="px-2.5 py-1 text-xs rounded-full transition flex items-center gap-1" :class="fetchingCovers ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'">
        <span v-if="fetchingCovers" class="inline-block animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent"></span>
        {{ fetchingCovers ? '补全中...' : '补全封面' }}
      </button>
    </div>

    <div v-if="store.loading" class="text-center text-gray-400 dark:text-gray-500 py-12">加载中...</div>
    <div v-else-if="store.shows.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-12">
      <p class="text-lg mb-2">还没有添加任何内容</p>
      <p class="text-sm">点击右上角按钮开始添加</p>
    </div>
    <div v-else-if="displayItems.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-12">
      <p class="text-sm">该分类下暂无内容</p>
    </div>

    <div v-else class="space-y-3">
      <template v-for="item in displayItems" :key="item.type === 'series' ? 'series-' + item.seriesId : 'show-' + item.show.id">

        <div v-if="item.type === 'show'" @click="goToShow(item.show.id)" class="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 rounded-xl p-3 md:p-5 cursor-pointer transition border border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600">
          <div class="flex items-start gap-3 md:items-center md:gap-4">
            <CoverImage :src="item.show.coverImage" :name="item.show.name" size="md" />
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                    <h2 class="text-base md:text-lg font-medium truncate">{{ item.show.name }}</h2>
                    <div class="relative flex-shrink-0">
                      <span
                        v-if="item.show.status"
                        @click="toggleStatusDropdown(item.show.id, $event)"
                        class="px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded-full whitespace-nowrap cursor-pointer hover:opacity-80 transition"
                        :class="statusColor(item.show.status)"
                      >{{ statusLabel(item.show.status) }} ▾</span>
                      <span
                        v-else
                        @click="toggleStatusDropdown(item.show.id, $event)"
                        class="px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded-full whitespace-nowrap cursor-pointer bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:opacity-80 transition"
                      >设置状态 ▾</span>
                      <div
                        v-if="statusDropdownId === item.show.id"
                        class="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 min-w-[90px]"
                      >
                        <button
                          v-for="st in SHOW_STATUSES"
                          :key="st.key"
                          @click="quickChangeStatus(item.show.id, st.key, $event)"
                          class="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                          :class="item.show.status === st.key ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300'"
                        >{{ st.label }}</button>
                      </div>
                    </div>
                    <span v-if="item.show.category" class="px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400 whitespace-nowrap hidden sm:inline">{{ categoryLabel(item.show.category) }}</span>
                  </div>
                  <div v-if="item.show.region || parseGenres(item.show).length > 0 || (item.show.category === 'book' && item.show.author)" class="hidden md:flex items-center gap-2 mb-2 flex-wrap">
                    <span v-if="item.show.category === 'book' && item.show.author" class="text-xs text-gray-500 dark:text-gray-400">作者：{{ item.show.author }}</span>
                    <span v-if="item.show.region" class="text-xs text-gray-500 dark:text-gray-400">地区：{{ item.show.region }}</span>
                    <span v-if="parseGenres(item.show).length > 0" class="text-xs text-gray-500 dark:text-gray-400">类型：{{ parseGenres(item.show).join(' / ') }}</span>
                  </div>
                  <div class="flex items-center gap-2 md:gap-4 text-xs md:text-sm">
                    <span class="text-gray-500 dark:text-gray-400">{{ showProgressLabel(item.show) }}</span>
                    <div class="flex items-center gap-1">
                      <div class="w-16 md:w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div class="h-full bg-indigo-500 rounded-full transition-all duration-500" :style="{ width: progressPercent(item.show) + '%' }"></div>
                      </div>
                      <span class="text-[10px] md:text-xs text-gray-400 dark:text-gray-500">{{ progressPercent(item.show) }}%</span>
                    </div>
                  </div>
                </div>
                <div class="flex flex-col md:flex-row items-end md:items-center gap-1 md:gap-3 ml-2 flex-shrink-0">
                  <div v-if="item.show.avgRating > 0" class="text-right">
                    <span class="text-lg md:text-2xl font-bold text-amber-400">{{ item.show.avgRating }}</span>
                    <span class="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 ml-0.5 hidden sm:inline">均分</span>
                  </div>
                  <div v-else class="text-[10px] md:text-sm text-gray-400 dark:text-gray-500 hidden md:block">点击开始记录</div>
                  <div class="flex gap-1 md:gap-2">
                    <button @click="openEditMeta(item.show, $event)" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-xs md:text-sm transition" title="编辑">编辑</button>
                    <button @click="handleDelete(item.show.id, $event)" class="text-red-400 hover:text-red-300 text-xs md:text-sm transition">删除</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else>
          <div @click="toggleSeries(item.seriesId)" class="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 rounded-xl p-3 md:p-5 cursor-pointer transition border border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600">
            <div class="flex items-center gap-3 md:gap-4">
              <CoverImage :src="item.coverImage" :name="item.seriesName" size="md" />
              <div class="flex-1 min-w-0">
                <div class="flex items-start md:items-center justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                      <h2 class="text-base md:text-lg font-medium truncate">{{ item.seriesName }}</h2>
                      <span class="px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-600/30 dark:text-indigo-300 whitespace-nowrap">系列</span>
                      <span v-if="item.category" class="px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400 whitespace-nowrap hidden sm:inline">{{ categoryLabel(item.category) }}</span>
                    </div>
                    <div class="flex items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      <span>共 {{ item.shows.length }} 部</span>
                      <span v-if="item.totalEpisodes" class="hidden sm:inline">{{ item.ratedCount }} / {{ item.totalEpisodes }} 集已评</span>
                    </div>
                  </div>
                  <div class="flex flex-col md:flex-row items-end md:items-center gap-1 md:gap-3 ml-2 flex-shrink-0">
                    <div v-if="item.avgRating > 0" class="text-right">
                      <span class="text-lg md:text-2xl font-bold text-amber-400">{{ item.avgRating }}</span>
                      <span class="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 ml-0.5 hidden sm:inline">均分</span>
                    </div>
                    <span class="text-gray-400 dark:text-gray-500 text-xs md:text-sm transition-transform duration-200" :class="{ 'rotate-90': expandedSeries[item.seriesId] }">▶</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="expandedSeries[item.seriesId]" class="ml-3 md:ml-6 mt-1 space-y-1">
            <div v-for="show in item.shows" :key="show.id" @click="goToShow(show.id)" class="bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-lg px-3 md:px-4 py-2.5 md:py-3 cursor-pointer transition border border-gray-200 dark:border-gray-800 flex items-center gap-2 md:gap-3">
              <CoverImage :src="show.coverImage" :name="show.name" size="sm" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="text-xs md:text-sm font-medium truncate">{{ show.name }}</span>
                    <span v-if="show.status" class="px-1.5 py-0.5 text-[10px] md:text-xs rounded-full whitespace-nowrap" :class="statusColor(show.status)">{{ statusLabel(show.status) }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 md:gap-2 ml-2 flex-shrink-0">
                    <span v-if="show.avgRating > 0" class="text-xs md:text-sm font-bold text-amber-400">{{ show.avgRating }}</span>
                    <span v-else class="text-[10px] md:text-xs text-gray-400 dark:text-gray-500">未评</span>
                    <button @click="openEditMeta(show, $event)" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-[10px] md:text-xs transition">编辑</button>
                    <button @click="handleDelete(show.id, $event)" class="text-red-400 hover:text-red-300 text-[10px] md:text-xs transition">删</button>
                  </div>
                </div>
                <div class="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ showProgressLabel(show) }}</div>
              </div>
            </div>
          </div>
        </div>

      </template>
    </div>

    <div v-if="showForm" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="closeForm">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4 border border-gray-200 dark:border-gray-700 max-h-[85vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium">添加</h3>
          <button v-if="selectedCategory && !manualMode" @click="manualMode = true" class="text-xs text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 dark:hover:text-indigo-300 transition">手动添加</button>
          <button v-if="manualMode" @click="manualMode = false" class="text-xs text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 dark:hover:text-indigo-300 transition">搜索添加</button>
        </div>

        <div v-if="!selectedCategory" class="space-y-3">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">请选择要添加的内容类型</p>
          <button v-for="cat in CATEGORIES" :key="cat.key" @click="switchCategory(cat.key)" class="w-full py-3 rounded-lg text-sm font-medium transition bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-300">{{ cat.label }}</button>
        </div>

        <div v-else-if="!manualMode">
          <div class="flex items-center gap-2 mb-4">
            <button @click="selectedCategory = ''; searchResults = []; selectedResult = null; resultEpisodes = []" class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">← 返回</button>
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ categoryLabel(selectedCategory) }}</span>
          </div>

          <div class="mb-4">
            <input v-model="searchQuery" type="text" :placeholder="selectedCategory === 'book' ? '搜索书名...' : selectedCategory === 'movie' ? '搜索电影名...' : selectedCategory === 'animation' ? '搜索动画名...' : '搜索剧名...'" class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" @input="onSearchInput" autofocus />
          </div>

          <div v-if="selectedCategory === 'movie'" class="mb-3">
            <button @click="showTmdbSettings = !showTmdbSettings" class="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition">
              {{ hasCustomTmdbKey() ? 'TMDB Key (自定义)' : 'TMDB 设置' }}
            </button>
            <div v-if="showTmdbSettings" class="mt-2 bg-gray-50 dark:bg-gray-750 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">已内置默认 Key，如失效可自行配置：<a href="https://www.themoviedb.org/settings/api" target="_blank" class="text-indigo-500 underline">获取 Key</a></p>
              <div class="flex gap-2">
                <input v-model="tmdbKeyInput" type="text" placeholder="API Key 或 Read Access Token 均可" class="flex-1 bg-white dark:bg-gray-600 rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                <button @click="saveTmdbKey" class="px-3 py-1.5 bg-gray-800 text-white dark:bg-indigo-600 rounded text-xs">保存</button>
                <button v-if="hasCustomTmdbKey()" @click="clearTmdbKey" class="px-3 py-1.5 bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-300 rounded text-xs">恢复默认</button>
              </div>
            </div>
          </div>

          <div v-if="searching" class="text-center text-gray-400 dark:text-gray-500 py-6">
            <div class="inline-block animate-spin rounded-full h-5 w-5 border-2 border-gray-400 dark:border-gray-500 border-t-transparent mb-2"></div>
            <p class="text-sm">搜索中...</p>
          </div>

          <div v-else-if="searchResults.length > 0 && !selectedResult" class="space-y-2 max-h-60 overflow-y-auto">
            <div v-for="item in searchResults" :key="item.id" @click="selectResult(item)" class="flex items-center gap-3 p-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 cursor-pointer transition">
              <CoverImage :src="item.image" :name="item.name" size="sm" />
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ item.name }}</p>
                <p v-if="item.cnName || item.nativeName || item.englishName" class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ item.cnName || item.nativeName || item.englishName }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                  <span v-if="item.language">{{ item.language }}</span>
                  <span v-if="item.authors?.length"> · {{ item.authors.join(', ') }}</span>
                  <span v-if="item.genres?.length"> · {{ item.genres.join(', ') }}</span>
                  <span v-if="item.status"> · {{ item.status }}</span>
                </p>
              </div>
            </div>
          </div>

          <div v-else-if="searchQuery && !searching" class="text-center text-gray-400 dark:text-gray-500 py-4 text-sm">{{ searchError || '未找到相关结果' }}</div>

          <div v-if="selectedResult" class="mt-4 space-y-4">
            <div class="flex items-center gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
              <img v-if="selectedResult.image" :src="selectedResult.image" class="w-12 h-16 object-cover rounded" />
              <div class="flex-1 min-w-0">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">名称（可修改）</p>
                <input v-model="addName" type="text" class="w-full bg-white dark:bg-gray-600 rounded px-2 py-1 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" />
                <div v-if="selectedCategory === 'animation' && (selectedResult.nativeName || selectedResult.englishName)" class="flex flex-wrap gap-1.5 mt-2">
                  <button v-if="selectedResult.name && selectedResult.name !== addName" @click="pickTitle(selectedResult.name)" class="px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500 transition">{{ selectedResult.name }}</button>
                  <button v-if="selectedResult.nativeName && selectedResult.nativeName !== addName" @click="pickTitle(selectedResult.nativeName)" class="px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500 transition">{{ selectedResult.nativeName }}</button>
                  <button v-if="selectedResult.englishName && selectedResult.englishName !== addName" @click="pickTitle(selectedResult.englishName)" class="px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500 transition">{{ selectedResult.englishName }}</button>
                </div>
                <p v-if="selectedCategory !== 'animation'" class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ selectedResult.name }}</p>
                <template v-if="selectedCategory === 'book'">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 mb-1">作者（可修改）</p>
                  <input v-model="addAuthor" type="text" placeholder="输入作者名" class="w-full bg-white dark:bg-gray-600 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </template>
              </div>
              <button @click="selectedResult = null; resultEpisodes = []; addName = ''; addAuthor = ''" class="ml-auto text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">重新选择</button>
            </div>

            <template v-if="selectedCategory === 'tv'">
              <div v-if="fetchingEpisodes" class="text-center text-gray-400 dark:text-gray-500 py-4">
                <div class="inline-block animate-spin rounded-full h-5 w-5 border-2 border-gray-400 dark:border-gray-500 border-t-transparent mb-2"></div>
                <p class="text-sm">获取剧集信息...</p>
              </div>
              <div v-else-if="resultEpisodes.length > 0" class="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                <p class="text-sm text-gray-600 dark:text-gray-300 mb-1">已获取数据：</p>
                <p class="text-lg font-medium text-indigo-500 dark:text-indigo-400">{{ epSummary() }}</p>
              </div>
              <div v-else class="text-sm text-gray-400 dark:text-gray-500 text-center py-2">未获取到剧集数据</div>
            </template>

            <div class="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              <GenreSelector :hide-category="true" v-model:region="showRegion" v-model:genres="showGenres" />
            </div>

            <div class="flex gap-3">
              <button @click="selectedResult = null; resultEpisodes = []; addName = ''" class="flex-1 py-3 rounded-lg text-sm font-medium transition bg-gray-200 hover:bg-gray-300 text-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300">← 返回搜索</button>
              <button :disabled="!resultEpisodes.length" @click="confirmAdd" class="flex-1 py-3 rounded-lg text-sm font-medium transition" :class="resultEpisodes.length ? 'bg-gray-800 hover:bg-gray-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'">确认添加</button>
            </div>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div class="flex items-center gap-2 mb-2">
            <button @click="manualMode = false" class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">← 返回</button>
            <span class="text-xs text-gray-400 dark:text-gray-500">手动添加 · {{ categoryLabel(selectedCategory) }}</span>
          </div>

          <div>
            <label class="block text-sm text-gray-500 dark:text-gray-400 mb-1">名称</label>
            <input v-model="manualName" type="text" placeholder="输入名称" class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div v-if="selectedCategory === 'book'">
            <label class="block text-sm text-gray-500 dark:text-gray-400 mb-1">作者</label>
            <input v-model="addAuthor" type="text" placeholder="输入作者名" class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div v-if="selectedCategory === 'tv'" class="flex gap-3">
            <div class="flex-1">
              <label class="block text-sm text-gray-500 dark:text-gray-400 mb-1">{{ manualVolLabel }}数</label>
              <input v-model.number="manualVolumes" type="number" min="1" class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div class="flex-1">
              <label class="block text-sm text-gray-500 dark:text-gray-400 mb-1">{{ manualItemLabel }}</label>
              <input v-model.number="manualItemsPerVol" type="number" min="1" class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div v-else class="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg p-3">将作为一条记录添加，如有多部续集请通过系列功能管理</div>

          <div class="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
            <GenreSelector :hide-category="true" v-model:region="showRegion" v-model:genres="showGenres" />
          </div>

          <div class="flex justify-end gap-3">
            <button @click="closeForm" class="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">取消</button>
            <button @click="confirmManualAdd" class="px-4 py-2 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 font-medium transition">添加</button>
          </div>
        </div>

        <div v-if="!manualMode && selectedCategory" class="flex justify-end mt-4">
          <button @click="closeForm" class="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">取消</button>
        </div>
      </div>
    </div>

    <div v-if="showEditForm" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="closeEditForm">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4 border border-gray-200 dark:border-gray-700 max-h-[85vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium">编辑</h3>
          <button @click="closeEditForm" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">✕</button>
        </div>

        <div class="mb-4">
          <label class="block text-sm text-gray-500 dark:text-gray-400 mb-1">名称</label>
          <input v-model="editName" type="text" class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div class="mb-4">
          <label class="block text-sm text-gray-500 dark:text-gray-400 mb-1">封面图片</label>
          <div class="flex items-start gap-3">
            <CoverImage :src="editCoverImage" :name="editName" size="md" />
            <div class="flex-1">
              <div class="flex gap-2">
                <input v-model="editCoverImage" type="text" placeholder="输入封面图片URL，留空显示作品名" class="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">留空或链接失效时显示作品名称作为封面</p>
            </div>
          </div>
        </div>

        <div v-if="editCategory === 'book'" class="mb-4">
          <label class="block text-sm text-gray-500 dark:text-gray-400 mb-1">作者</label>
          <input v-model="editAuthor" type="text" placeholder="输入作者名" class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <GenreSelector v-model:category="editCategory" v-model:region="editRegion" v-model:genres="editGenres" />

        <div class="mt-5">
          <label class="block text-sm text-gray-500 dark:text-gray-400 mb-2">所属系列</label>
          <div class="relative">
            <input v-model="seriesInput" type="text" placeholder="输入或搜索系列名称..." class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" @input="editSeriesId = null" />
            <div v-if="seriesInput && !editSeriesId" class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-32 overflow-y-auto">
              <div v-for="s in filteredSeries" :key="s.id" @mousedown.prevent="selectSeries(s)" class="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">{{ s.name }}</div>
              <div @mousedown.prevent="createNewSeries" class="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition text-indigo-500">+ 创建新系列「{{ seriesInput }}」</div>
            </div>
          </div>
          <div v-if="editSeriesId" class="flex items-center gap-2 mt-2">
            <span class="px-2 py-1 bg-indigo-100 text-indigo-600 dark:bg-indigo-600/30 dark:text-indigo-300 rounded text-xs">{{ seriesInput }}</span>
            <button @click="editSeriesId = null; seriesInput = ''" class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">移除</button>
          </div>
        </div>

        <div class="mt-5">
          <label class="block text-sm text-gray-500 dark:text-gray-400 mb-2">观看状态</label>
          <select v-model="editStatus" class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">未设置</option>
            <option v-for="st in SHOW_STATUSES" :key="st.key" :value="st.key">{{ st.label }}</option>
          </select>
        </div>

        <div v-if="editStatus" class="mt-3 flex gap-3">
          <div class="flex-1">
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">开始日期</label>
            <input v-model="editStartDate" type="date" class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div class="flex-1">
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">完成日期</label>
            <input v-model="editFinishDate" type="date" class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button @click="closeEditForm" class="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">取消</button>
          <button @click="saveEditMeta" class="px-4 py-2 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 font-medium transition">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showRestorePrompt" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h3 class="text-lg font-semibold mb-2">发现自动备份</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          检测到本地有自动备份（{{ formatBackupTime() }}），当前数据库为空。是否恢复？
        </p>
        <div class="flex justify-end gap-3">
          <button @click="dismissRestore" class="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">跳过</button>
          <button @click="confirmRestore" class="px-4 py-2 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 font-medium transition">恢复</button>
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
