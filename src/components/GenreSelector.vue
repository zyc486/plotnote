<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { CATEGORIES, PREDEFINED_GENRES, GAME_GENRES, REGION_SUGGESTIONS } from '../constants'
import { useShowsStore } from '../stores/shows'

const props = defineProps({
  category: { type: String, default: '' },
  region: { type: String, default: '' },
  genres: { type: Array, default: () => [] },
  hideCategory: { type: Boolean, default: false },
})

const emit = defineEmits(['update:category', 'update:region', 'update:genres'])

const showsStore = useShowsStore()

const selectedCategory = ref(props.category)
const regionInput = ref(props.region)
const selectedGenres = ref([...props.genres])
const genreSearchQuery = ref('')
const showGenreSearch = ref(false)
const customGenreInput = ref('')
const showCustomInput = ref(false)
const genreHistory = ref([])
const showRegionSuggestions = ref(false)

const filteredRegionSuggestions = computed(() => {
  const q = regionInput.value.trim().toLowerCase()
  if (!q) return REGION_SUGGESTIONS.slice(0, 8)
  return REGION_SUGGESTIONS.filter(r => r.toLowerCase().includes(q)).slice(0, 8)
})

const genreSearchResults = computed(() => {
  const q = genreSearchQuery.value.trim().toLowerCase()
  const baseGenres = selectedCategory.value === 'game' ? GAME_GENRES : PREDEFINED_GENRES
  const all = [...baseGenres, ...genreHistory.value.map(g => g.name)]
  const unique = [...new Set(all)]
  if (!q) return unique.filter(g => !selectedGenres.value.includes(g)).slice(0, 12)
  return unique.filter(g =>
    g.toLowerCase().includes(q) && !selectedGenres.value.includes(g)
  ).slice(0, 12)
})

const suggestedGenres = computed(() => {
  const baseGenres = selectedCategory.value === 'game' ? GAME_GENRES : PREDEFINED_GENRES
  return baseGenres.filter(g => !selectedGenres.value.includes(g)).slice(0, 10)
})

onMounted(async () => {
  const history = await showsStore.getGenreHistory()
  genreHistory.value = history
})

watch(() => props.category, (val) => { selectedCategory.value = val })
watch(() => props.region, (val) => { regionInput.value = val })
watch(() => props.genres, (val) => { selectedGenres.value = [...val] })

function selectCategory(key) {
  selectedCategory.value = key
  emit('update:category', key)
}

function onRegionInput() {
  showRegionSuggestions.value = true
  emit('update:region', regionInput.value)
}

function selectRegion(name) {
  regionInput.value = name
  showRegionSuggestions.value = false
  emit('update:region', name)
}

function onRegionBlur() {
  setTimeout(() => { showRegionSuggestions.value = false }, 200)
}

function toggleGenre(genre) {
  if (selectedGenres.value.includes(genre)) {
    selectedGenres.value = selectedGenres.value.filter(g => g !== genre)
  } else {
    selectedGenres.value = [...selectedGenres.value, genre]
  }
  emit('update:genres', selectedGenres.value)
}

function removeGenre(genre) {
  selectedGenres.value = selectedGenres.value.filter(g => g !== genre)
  emit('update:genres', selectedGenres.value)
}

function addCustomGenre() {
  const name = customGenreInput.value.trim()
  if (!name) return
  if (selectedGenres.value.includes(name)) {
    customGenreInput.value = ''
    showCustomInput.value = false
    return
  }
  selectedGenres.value = [...selectedGenres.value, name]
  emit('update:genres', selectedGenres.value)
  customGenreInput.value = ''
  showCustomInput.value = false
}

function onGenreSearch() {
  showGenreSearch.value = true
}

function closeGenreSearch() {
  showGenreSearch.value = false
  genreSearchQuery.value = ''
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="!hideCategory">
      <label class="block text-sm text-gray-500 dark:text-gray-400 mb-2">分类</label>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="cat in CATEGORIES"
          :key="cat.key"
          @click="selectCategory(cat.key)"
          class="px-4 py-1.5 rounded-full text-sm transition"
          :class="selectedCategory === cat.key
            ? 'bg-gray-800 text-white dark:bg-indigo-600'
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <div class="relative">
      <label class="block text-sm text-gray-500 dark:text-gray-400 mb-2">地区</label>
      <input
        v-model="regionInput"
        type="text"
        placeholder="输入或选择地区，如 美国、日本..."
        class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        @input="onRegionInput"
        @focus="showRegionSuggestions = true"
        @blur="onRegionBlur"
      />
      <div
        v-if="showRegionSuggestions && filteredRegionSuggestions.length > 0"
        class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto"
      >
        <div
          v-for="r in filteredRegionSuggestions"
          :key="r"
          @mousedown.prevent="selectRegion(r)"
          class="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          :class="regionInput === r ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'"
        >
          {{ r }}
        </div>
      </div>
    </div>

    <div>
      <label class="block text-sm text-gray-500 dark:text-gray-400 mb-2">类型标签</label>

      <div v-if="selectedGenres.length > 0" class="flex flex-wrap gap-2 mb-3">
        <button
          v-for="genre in selectedGenres"
          :key="genre"
          @click="removeGenre(genre)"
          class="px-3 py-1 bg-indigo-100 text-indigo-600 dark:bg-indigo-600/30 dark:text-indigo-300 rounded-full text-sm flex items-center gap-1 hover:bg-indigo-200 dark:hover:bg-indigo-600/50 transition"
        >
          {{ genre }}
          <span class="text-xs">×</span>
        </button>
      </div>

      <div v-if="showGenreSearch || showCustomInput" class="space-y-2 mb-3">
        <input
          v-if="showCustomInput"
          v-model="customGenreInput"
          type="text"
          placeholder="输入自定义类型..."
          class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          @keyup.enter="addCustomGenre"
          autofocus
        />
        <div class="relative">
          <input
            v-model="genreSearchQuery"
            type="text"
            placeholder="搜索类型标签..."
            class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            @input="onGenreSearch"
            @blur="closeGenreSearch"
          />
          <div
            v-if="genreSearchQuery && genreSearchResults.length > 0"
            class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto"
          >
            <div
              v-for="genre in genreSearchResults"
              :key="genre"
              @mousedown.prevent="toggleGenre(genre)"
              class="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300"
            >
              {{ genre }}
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-1.5 mb-2">
        <button
          v-for="genre in suggestedGenres"
          :key="genre"
          @click="toggleGenre(genre)"
          class="px-2 py-1 rounded-full text-xs transition bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          {{ genre }}
        </button>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click="showGenreSearch = !showGenreSearch; showCustomInput = false"
          class="text-xs text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 dark:hover:text-indigo-300 transition"
        >
          {{ showGenreSearch ? '收起搜索' : '搜索类型' }}
        </button>
        <button
          @click="showCustomInput = !showCustomInput; showGenreSearch = false"
          class="text-xs text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 dark:hover:text-indigo-300 transition"
        >
          {{ showCustomInput ? '取消' : '+ 自定义类型' }}
        </button>
      </div>
    </div>
  </div>
</template>
